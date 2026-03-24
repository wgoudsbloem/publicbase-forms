import pg from 'pg';
import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'publicbase',
  port: Number(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 3000
});
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
const formCodesTable = process.env.FORM_CODES_TABLE;
const debugEnabled = String(process.env.DEBUG || '').toLowerCase() === 'true';
const connectTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS) || 3000;
const queryTimeoutMs = Number(process.env.DB_QUERY_TIMEOUT_MS) || 3000;
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
    logDebug('DB connect start', { requestId });
    const client = await withTimeout(pool.connect(), connectTimeoutMs, 'DB connect');
    logDebug('DB connect ok', { requestId });
    let formId;
    try {
      const rawPath = String(codeItem.form_path || '');
      const normalizedPath = rawPath
        .replace(/\/+$/, '')
        .replace(/\/index\.html$/, '')
        .replace(/^\/?/, '/');
      const result = await withTimeout(
        client.query(
          `select id
           from forms.forms
           where code = $1
           limit 1`,
          [normalizedPath]
        ),
        queryTimeoutMs,
        'DB query'
      );
      if (result.rowCount === 0) {
        logDebug('Form path not found', { requestId, formPath: codeItem.form_path });
        return response(404);
      }
      formId = result.rows[0].id;
    } finally {
      client.release();
    }
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
    const insertClient = await withTimeout(pool.connect(), connectTimeoutMs, 'DB connect');
    try {
      const submissionData = { ...data, confirmation_code: confirmationCode };
      await withTimeout(
        insertClient.query(
          `insert into publish.submissions (id, form_id, data, confirmation_code)
           values ($1, $2, $3, $4)`,
          [submissionId, formId, submissionData, confirmationCode]
        ),
        queryTimeoutMs,
        'DB query'
      );
    } finally {
      insertClient.release();
    }
    logDebug('Submission stored', { requestId, submissionId, formId });
    if (process.env.FORM_SUBMISSIONS_TOPIC_ARN) {
      try {
        logDebug('SNS publish start', { requestId });
        await withTimeout(
          sns.send(
            new PublishCommand({
              TopicArn: process.env.FORM_SUBMISSIONS_TOPIC_ARN,
              Message: JSON.stringify({
                submission_id: submissionId,
                form_id: formId,
                confirmation_code: confirmationCode,
                submitted_at: new Date().toISOString()
              })
            })
          ),
          snsTimeoutMs,
          'SNS publish'
        );
        logDebug('SNS publish ok', { requestId });
      } catch (err) {
        logError('SNS publish failed', { requestId, error: err?.message });
        throw err;
      }
    }
    return response(200, { ok: true, id: submissionId, confirmationCode });
  } catch (err) {
    logError('Submission failed', { requestId, error: err?.message });
    return response(500);
  }
};
