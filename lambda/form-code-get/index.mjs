import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
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
const ttlSeconds = Number(process.env.CODE_TTL_SECONDS) || 900;
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

  const encodedPath = event?.queryStringParameters?.id || null;
  if (!encodedPath) {
    logDebug('Missing query parameter id', { requestId });
    return response(400);
  }

  let decodedPath;
  try {
    decodedPath = Buffer.from(encodedPath, 'base64').toString('utf-8');
  } catch (err) {
    logError('Failed to decode base64 id', { requestId, error: err?.message });
    return response(400);
  }
  const formPath = decodedPath;

  const code = crypto.randomBytes(24).toString('base64url');
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + ttlSeconds;

  try {
    logDebug('DynamoDB put start', { requestId });
    await withTimeout(
      client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            code,
            form_path: formPath,
            expires_at: expiresAt,
            created_at: createdAt
          }
        })
      ),
      ddbTimeoutMs,
      'DynamoDB put'
    );
    logDebug('DynamoDB put ok', { requestId });
    logDebug('Issued form code', { requestId, expiresAt });
    return response(200, { code });
  } catch (err) {
    logError('Failed to store form code', { requestId, error: err?.message });
    return response(500);
  }
};
