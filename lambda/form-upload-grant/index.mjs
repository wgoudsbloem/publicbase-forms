import crypto from 'crypto';
import path from 'path';
import { extractParams, verifySolution } from 'altcha-lib';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ca-central-1';
const ddbTimeoutMs = Number(process.env.DDB_REQUEST_TIMEOUT_MS) || 2000;
const formCodesTable = process.env.FORM_CODES_TABLE;
const altchaHmacKey = process.env.ALTCHA_HMAC_KEY || '';
const uploadTokenSecret = process.env.FORM_UPLOAD_TOKEN_SECRET || '';
const maxUploadBytes = 100 * 1024 * 1024;
const uploadBucket = process.env.FORM_UPLOAD_BUCKET || 'publicbase-files';
const debugEnabled = String(process.env.DEBUG || '').toLowerCase() === 'true';

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: awsRegion,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: ddbTimeoutMs,
      requestTimeout: ddbTimeoutMs
    })
  })
);

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

const getOrganizationRoot = (formPath) => {
  const parts = normalizeFormPath(formPath).split('/').filter(Boolean);
  return parts.length >= 3 ? parts.slice(0, 3).join('/') : '';
};

const sanitizeSegment = (value, fallback) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || fallback;

const getExtension = (fileName) => {
  const ext = path.extname(String(fileName || '')).replace(/^\./, '').toLowerCase();
  return /^[a-z0-9]{1,12}$/.test(ext) ? ext : 'bin';
};

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const signUploadToken = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', uploadTokenSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};

export const handler = async (event) => {
  const requestId = event?.requestContext?.requestId || null;
  const method = (event?.requestContext?.http?.method || event?.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return response(204);
  if (method !== 'POST') return response(405);

  if (!altchaHmacKey || !uploadTokenSecret) {
    console.error('Upload grant secret configuration missing', { requestId });
    return response(500, { ok: false, error: 'UPLOAD_NOT_CONFIGURED' });
  }

  let payload;
  try {
    payload = parseBody(event);
  } catch (err) {
    console.error('Invalid upload grant JSON payload', { requestId, error: err?.message });
    return response(400, { ok: false, error: 'INVALID_JSON' });
  }

  const code = String(payload?.code || '').trim();
  const altchaPayload = String(payload?.altcha || '').trim();
  const submissionId = String(payload?.submissionId || '').trim();
  const fieldName = sanitizeSegment(payload?.fieldName, '');
  const originalName = String(payload?.fileName || '').trim();
  const mimeType = String(payload?.mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
  const sizeBytes = Number(payload?.sizeBytes);

  if (!code || !altchaPayload || !isUuid(submissionId) || !fieldName || !originalName || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return response(400, { ok: false, error: 'INVALID_UPLOAD_REQUEST' });
  }
  if (sizeBytes > maxUploadBytes) {
    return response(413, { ok: false, error: 'UPLOAD_TOO_LARGE' });
  }

  try {
    const codeResult = await withTimeout(
      ddb.send(new GetCommand({
        TableName: formCodesTable,
        Key: { code }
      })),
      ddbTimeoutMs,
      'DynamoDB get'
    );
    const codeItem = codeResult?.Item || null;
    if (!codeItem?.form_path || !codeItem?.expires_at) {
      return response(404, { ok: false, error: 'FORM_CODE_NOT_FOUND' });
    }
    const now = Math.floor(Date.now() / 1000);
    if (codeItem.expires_at <= now) {
      return response(410, { ok: false, error: 'FORM_CODE_EXPIRED' });
    }

    const normalizedPath = normalizeFormPath(codeItem.form_path);
    let verified = false;
    let altchaParams = {};
    try {
      verified = await verifySolution(altchaPayload, altchaHmacKey);
      altchaParams = extractParams(altchaPayload);
    } catch (err) {
      logDebug('ALTCHA upload grant verification raised an error', { requestId, error: err?.message });
      return response(400, { ok: false, error: 'INVALID_ALTCHA' });
    }
    if (!verified || String(altchaParams.code || '') !== code || String(altchaParams.form || '') !== normalizedPath) {
      return response(403, { ok: false, error: 'ALTCHA_REQUIRED' });
    }

    const organizationRoot = getOrganizationRoot(normalizedPath);
    if (!organizationRoot) {
      return response(400, { ok: false, error: 'INVALID_FORM_PATH' });
    }

    const objectKey = `${organizationRoot}/${submissionId}/${fieldName}.${getExtension(originalName)}`;
    const tokenPayload = {
      code,
      formPath: normalizedPath,
      submissionId,
      fieldName,
      objectKey,
      originalName,
      mimeType,
      sizeBytes,
      exp: now + 15 * 60
    };

    return response(200, {
      ok: true,
      uploadToken: signUploadToken(tokenPayload),
      chunkSize: 5 * 1024 * 1024,
      s3Url: `s3://${uploadBucket}/${objectKey}`,
      originalName,
      mimeType,
      sizeBytes
    });
  } catch (err) {
    console.error('Upload grant failed', { requestId, error: err?.message });
    return response(500, { ok: false, error: 'UPLOAD_GRANT_FAILED' });
  }
};
