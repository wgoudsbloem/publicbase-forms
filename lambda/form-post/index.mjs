import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'publicbase',
  port: Number(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
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

export const handler = async (event) => {
  const method = (event?.requestContext?.http?.method || event?.httpMethod || '').toUpperCase();
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
    return response(400);
  }

  const formId = payload?.formId ?? null;
  const departmentId = payload?.departmentId ?? null;
  const data = payload?.data ?? null;
  if (!formId || !departmentId || !data) {
    return response(400);
  }

  const submissionId = crypto.randomUUID();
  try {
    await pool.query(
      `insert into publish.submissions (id, form_id, department_id, data)
       values ($1, $2, $3, $4)`,
      [submissionId, formId, departmentId, data]
    );
    return response(200, { ok: true, id: submissionId });
  } catch (err) {
    return response(500);
  }
};
