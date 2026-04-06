import crypto from 'crypto';
import { extractParams, verifySolution } from 'altcha-lib';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const ddbTimeoutMs = Number(process.env.DDB_REQUEST_TIMEOUT_MS) || 2000;
const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ca-central-1';
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: awsRegion,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: ddbTimeoutMs,
      requestTimeout: ddbTimeoutMs
    })
  })
);
const sns = new SNSClient({
  region: awsRegion,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: Number(process.env.SNS_REQUEST_TIMEOUT_MS) || 8000,
    requestTimeout: Number(process.env.SNS_REQUEST_TIMEOUT_MS) || 8000
  })
});
const lambda = new LambdaClient({
  region: awsRegion,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: Number(process.env.LAMBDA_INVOKE_TIMEOUT_MS) || 5000,
    requestTimeout: Number(process.env.LAMBDA_INVOKE_TIMEOUT_MS) || 5000
  })
});
const formCodesTable = process.env.FORM_CODES_TABLE;
const altchaHmacKey = process.env.ALTCHA_HMAC_KEY || '';
const formPostStoreFunctionName = String(process.env.FORM_POST_STORE_FUNCTION_NAME || '').trim();
const submissionEmailTopicArn = String(process.env.SUBMISSION_EMAIL_TOPIC_ARN || '').trim();
const debugEnabled = String(process.env.DEBUG || '').toLowerCase() === 'true';
const snsTimeoutMs = Number(process.env.SNS_REQUEST_TIMEOUT_MS) || 8000;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  },
  body: body ? JSON.stringify(body) : ''
});

const parseBody = (event) => {
  if (!event?.body) return null;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
  return JSON.parse(raw);
};

const logDebug = (message, meta = {}) => {
  if (!debugEnabled) return;
  console.log(message, meta);
};

const logError = (message, meta = {}) => {
  console.error(message, meta);
};

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);

const normalizeFormPath = (value) =>
  String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/index\.html$/, '')
    .replace(/^\/?/, '/');

const decodeLambdaPayload = (payload) => {
  if (!payload) return null;
  const raw = Buffer.from(payload).toString('utf-8').trim();
  if (!raw) return null;
  return JSON.parse(raw);
};

const storeSubmission = async ({ requestId, normalizedPath, submissionId, confirmationCode, submissionData }) => {
  if (!formPostStoreFunctionName) {
    throw new Error('FORM_POST_STORE_FUNCTION_NAME is not configured');
  }

  const invokeResult = await lambda.send(new InvokeCommand({
    FunctionName: formPostStoreFunctionName,
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(JSON.stringify({
      requestId,
      normalizedPath,
      submissionId,
      confirmationCode,
      submissionData
    }))
  }));

  if (invokeResult.FunctionError) {
    throw new Error(`Store function failed: ${invokeResult.FunctionError}`);
  }

  const parsed = decodeLambdaPayload(invokeResult.Payload);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Store function returned an empty response');
  }

  const statusCode = Number(parsed.statusCode) || 500;
  let body = parsed.body;
  if (typeof body === 'string') {
    body = body ? JSON.parse(body) : null;
  }

  return {
    statusCode,
    body: body && typeof body === 'object' ? body : null
  };
};

const publishEmailJobs = async ({ requestId, submissionId, emailJobs }) => {
  if (!submissionEmailTopicArn) {
    logDebug('Submission email topic is not configured', { requestId });
    return;
  }

  for (const job of emailJobs) {
    if (!job?.to) continue;
    try {
      await withTimeout(
        sns.send(
          new PublishCommand({
            TopicArn: submissionEmailTopicArn,
            Message: JSON.stringify(job)
          })
        ),
        snsTimeoutMs,
        'SNS publish'
      );
    } catch (err) {
      logError('Submission email job publish failed', {
        requestId,
        submissionId,
        to: job.to,
        error: err?.message
      });
    }
  }
};

export const handler = async (event) => {
  const requestId = event?.requestContext?.requestId || null;
  const method = (event?.requestContext?.http?.method || event?.httpMethod || '').toUpperCase();
  logDebug('Request received', { requestId, method });
  logDebug('AWS region', { requestId, awsRegion });
  if (method === 'OPTIONS') {
    return response(204);
  }
  if (method !== 'POST') {
    return response(405);
  }

  let payload;
  try {
    payload = parseBody(event);
  } catch (err) {
    logError('Invalid JSON payload', { requestId, error: err?.message });
    return response(400);
  }

  const code = payload?.code ?? null;
  const data = payload?.data ?? null;
  if (!code || !data) {
    logDebug('Missing code or data in payload', { requestId });
    return response(400);
  }
  if (!altchaHmacKey) {
    logError('ALTCHA HMAC key is not configured', { requestId });
    return response(500);
  }
  const altchaPayload = typeof data?.altcha === 'string' ? data.altcha : null;
  if (!altchaPayload) {
    logDebug('Missing ALTCHA payload in submission', { requestId });
    return response(400);
  }

  const confirmationCode = (() => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  })();

  const submissionId = crypto.randomUUID();
  try {
    const codeResult = await withTimeout(
      ddb.send(
        new GetCommand({
          TableName: formCodesTable,
          Key: { code }
        })
      ),
      ddbTimeoutMs,
      'DynamoDB get'
    );
    const codeItem = codeResult?.Item || null;
    if (!codeItem?.form_path || !codeItem?.expires_at) {
      logDebug('Form code not found or missing fields', { requestId, code });
      return response(404);
    }
    const now = Math.floor(Date.now() / 1000);
    if (codeItem.expires_at <= now) {
      logDebug('Form code expired', { requestId, code, expiresAt: codeItem.expires_at });
      return response(410);
    }
    const normalizedPath = normalizeFormPath(codeItem.form_path);
    let altchaVerified = false;
    let altchaParams = {};
    try {
      altchaVerified = await verifySolution(altchaPayload, altchaHmacKey);
      altchaParams = extractParams(altchaPayload);
    } catch (err) {
      logDebug('ALTCHA verification raised an error', { requestId, error: err?.message });
      return response(400);
    }
    if (!altchaVerified) {
      logDebug('ALTCHA verification failed', { requestId, code });
      return response(403);
    }
    if (String(altchaParams.code || '') !== String(code) || String(altchaParams.form || '') !== normalizedPath) {
      logDebug('ALTCHA payload does not match the form code', {
        requestId,
        code,
        altchaCode: altchaParams.code,
        altchaForm: altchaParams.form
      });
      return response(403);
    }
    const { altcha, ...submissionFields } = data;
    const submissionData = { ...submissionFields, confirmation_code: confirmationCode };
    const storeResult = await storeSubmission({
      requestId,
      normalizedPath,
      submissionId,
      confirmationCode,
      submissionData
    });

    if (storeResult.statusCode === 404) {
      logDebug('Form path not found', { requestId, formPath: codeItem.form_path });
      return response(404);
    }
    if (storeResult.statusCode >= 400 || !storeResult.body?.ok || !storeResult.body?.formId) {
      logError('Store lambda rejected submission', { requestId, statusCode: storeResult.statusCode });
      return response(500);
    }

    const formId = storeResult.body.formId;
    const emailJobs = Array.isArray(storeResult.body.emailJobs) ? storeResult.body.emailJobs : [];
    logDebug('Submission stored', { requestId, submissionId, formId });
    if (emailJobs.length) {
      await publishEmailJobs({ requestId, submissionId, emailJobs });
    }
    try {
      await withTimeout(
        ddb.send(
          new UpdateCommand({
            TableName: formCodesTable,
            Key: { code },
            UpdateExpression: 'set expires_at = :expired',
            ExpressionAttributeValues: {
              ':expired': now - 1
            }
          })
        ),
        ddbTimeoutMs,
        'DynamoDB update'
      );
    } catch (err) {
      logError('DynamoDB code expiry failed', { requestId, code, error: err?.message });
    }
    return response(200, { ok: true, id: submissionId, confirmationCode });
  } catch (err) {
    logError('Submission failed', { requestId, error: err?.message });
    return response(500);
  }
};
