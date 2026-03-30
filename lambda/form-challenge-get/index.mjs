import { createChallenge } from 'altcha-lib';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const ddbTimeoutMs = Number(process.env.DDB_REQUEST_TIMEOUT_MS) || 2000;
const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ca-central-1';
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: awsRegion,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: ddbTimeoutMs,
      requestTimeout: ddbTimeoutMs
    })
  })
);
const tableName = process.env.FORM_CODES_TABLE;
const altchaHmacKey = process.env.ALTCHA_HMAC_KEY || '';
const altchaMaxNumber = Number(process.env.ALTCHA_MAX_NUMBER) || 50000;
const altchaExpireSeconds = Number(process.env.ALTCHA_EXPIRE_SECONDS) || 300;
const debugEnabled = String(process.env.DEBUG || '').toLowerCase() === 'true';

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  },
  body: body ? JSON.stringify(body) : ''
});

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

export const handler = async (event) => {
  const requestId = event?.requestContext?.requestId || null;
  const method = (event?.requestContext?.http?.method || event?.httpMethod || '').toUpperCase();
  logDebug('Request received', { requestId, method });
  logDebug('AWS region', { requestId, awsRegion });
  if (method === 'OPTIONS') {
    return response(204);
  }
  if (method !== 'GET') {
    return response(405);
  }
  if (!altchaHmacKey) {
    logError('ALTCHA HMAC key is not configured', { requestId });
    return response(500);
  }

  const code = String(event?.queryStringParameters?.code || '').trim();
  if (!code) {
    logDebug('Missing query parameter code', { requestId });
    return response(400);
  }

  try {
    const codeResult = await withTimeout(
      client.send(
        new GetCommand({
          TableName: tableName,
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
    const expiresAt = Math.min(codeItem.expires_at, now + altchaExpireSeconds);
    const challenge = await createChallenge({
      hmacKey: altchaHmacKey,
      maxNumber: altchaMaxNumber,
      maxnumber: altchaMaxNumber,
      expires: new Date(expiresAt * 1000),
      params: {
        code,
        form: normalizedPath
      }
    });

    logDebug('Issued ALTCHA challenge', { requestId, code, expiresAt });
    return response(200, challenge);
  } catch (err) {
    logError('Failed to create ALTCHA challenge', { requestId, error: err?.message });
    return response(500);
  }
};
