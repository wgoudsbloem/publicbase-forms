import crypto from 'crypto';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ca-central-1';
const uploadBucket = process.env.FORM_UPLOAD_BUCKET || 'publicbase-files';
const uploadTokenSecret = process.env.FORM_UPLOAD_TOKEN_SECRET || '';
const s3TimeoutMs = Number(process.env.S3_REQUEST_TIMEOUT_MS) || 8000;
const maxChunkBytes = 6 * 1024 * 1024;

const s3 = new S3Client({
  region: awsRegion,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: s3TimeoutMs,
    requestTimeout: s3TimeoutMs
  })
});

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

const verifyUploadToken = (token) => {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature || !uploadTokenSecret) return null;
  const expected = crypto.createHmac('sha256', uploadTokenSecret).update(encoded).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (!payload?.objectKey || !payload?.submissionId || !payload?.fieldName || !payload?.exp) return null;
    if (Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

const decodeChunk = (value) => {
  const cleaned = String(value || '').replace(/^data:[^;]+;base64,/, '');
  if (!cleaned) return null;
  return Buffer.from(cleaned, 'base64');
};

export const handler = async (event) => {
  const requestId = event?.requestContext?.requestId || null;
  const method = (event?.requestContext?.http?.method || event?.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return response(204);
  if (method !== 'POST') return response(405);

  let payload;
  try {
    payload = parseBody(event);
  } catch (err) {
    console.error('Invalid upload JSON payload', { requestId, error: err?.message });
    return response(400, { ok: false, error: 'INVALID_JSON' });
  }

  const token = verifyUploadToken(payload?.uploadToken);
  if (!token) {
    return response(403, { ok: false, error: 'INVALID_UPLOAD_TOKEN' });
  }

  const action = String(payload?.action || '').trim().toLowerCase();
  try {
    if (action === 'start') {
      const result = await s3.send(new CreateMultipartUploadCommand({
        Bucket: uploadBucket,
        Key: token.objectKey,
        ContentType: token.mimeType || 'application/octet-stream'
      }));
      return response(200, {
        ok: true,
        uploadId: result.UploadId
      });
    }

    if (action === 'chunk') {
      const uploadId = String(payload?.uploadId || '').trim();
      const partNumber = Number(payload?.partNumber);
      const bytes = decodeChunk(payload?.chunkBase64);
      if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !bytes?.length) {
        return response(400, { ok: false, error: 'INVALID_UPLOAD_CHUNK' });
      }
      if (bytes.length > maxChunkBytes) {
        return response(413, { ok: false, error: 'UPLOAD_CHUNK_TOO_LARGE' });
      }
      const result = await s3.send(new UploadPartCommand({
        Bucket: uploadBucket,
        Key: token.objectKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: bytes
      }));
      return response(200, {
        ok: true,
        partNumber,
        etag: result.ETag
      });
    }

    if (action === 'complete') {
      const uploadId = String(payload?.uploadId || '').trim();
      const parts = Array.isArray(payload?.parts)
        ? payload.parts
          .map((part) => ({
            PartNumber: Number(part?.partNumber),
            ETag: String(part?.etag || '').trim()
          }))
          .filter((part) => Number.isInteger(part.PartNumber) && part.PartNumber > 0 && part.ETag)
          .sort((a, b) => a.PartNumber - b.PartNumber)
        : [];
      if (!uploadId || !parts.length) {
        return response(400, { ok: false, error: 'INVALID_UPLOAD_COMPLETION' });
      }
      await s3.send(new CompleteMultipartUploadCommand({
        Bucket: uploadBucket,
        Key: token.objectKey,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
      }));
      return response(200, {
        ok: true,
        originalName: token.originalName,
        s3Url: `s3://${uploadBucket}/${token.objectKey}`,
        mimeType: token.mimeType || 'application/octet-stream',
        sizeBytes: token.sizeBytes
      });
    }

    return response(400, { ok: false, error: 'UNSUPPORTED_UPLOAD_ACTION' });
  } catch (err) {
    console.error('Upload action failed', { requestId, action, error: err?.message });
    return response(500, { ok: false, error: 'UPLOAD_ACTION_FAILED' });
  }
};
