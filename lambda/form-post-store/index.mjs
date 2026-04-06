import pg from 'pg';

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

const debugEnabled = String(process.env.DEBUG || '').toLowerCase() === 'true';
const connectTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS) || 3000;
const queryTimeoutMs = Number(process.env.DB_QUERY_TIMEOUT_MS) || 3000;

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

const parseEvent = (event) => {
  if (!event) return null;
  if (typeof event === 'string') return JSON.parse(event);
  if (typeof event.body === 'string') return JSON.parse(event.body);
  if (event.body && typeof event.body === 'object') return event.body;
  return event;
};

const response = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

const buildSubject = (formName, firstName, lastName) => {
  const namePart = `${lastName} ${firstName}`.trim();
  return namePart ? `${formName}:${namePart}` : formName;
};

const stringifyValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const buildExtraDataLines = ({ data, includeResults }) => {
  if (!includeResults) return '';
  const baseKeys = new Set(['first_name', 'last_name']);
  const entries = Object.entries(data || {}).filter(([key]) => !baseKeys.has(key));
  if (!entries.length) return '';
  return entries.map(([key, value]) => `${key}: ${stringifyValue(value)}`).join('\n');
};

const buildTemplateData = ({ formName, firstName, lastName, confirmationCode, data, includeResults }) =>
  JSON.stringify({
    subject: buildSubject(formName, firstName, lastName),
    form_name: formName || '',
    first_name: firstName || '',
    last_name: lastName || '',
    confirmation_code: confirmationCode || '',
    extra_data_lines: buildExtraDataLines({ data, includeResults })
  });

const buildPlainTextBody = ({ formName, firstName, lastName, confirmationCode, data, includeResults }) => {
  const lines = [
    formName ? `Form: ${formName}` : '',
    firstName || lastName ? `Applicant: ${`${firstName} ${lastName}`.trim()}` : '',
    confirmationCode ? `Confirmation code: ${confirmationCode}` : ''
  ].filter(Boolean);
  const extraDataLines = buildExtraDataLines({ data, includeResults });
  if (extraDataLines) lines.push('', extraDataLines);
  return lines.join('\n');
};

const loadRecipients = async (client, formId) => {
  const result = await client.query(
    `select u.email,
            ntn.include_results
     from publish.notifications n
     join publish.notification_type_notifications ntn on ntn.notification_id = n.id
     join orgs.users u on u.id = n.user_id
     where n.form_id = $1
       and ntn.notification_type = 'EMAIL'`,
    [formId]
  );
  return result.rows || [];
};

export const handler = async (event) => {
  const payload = parseEvent(event);
  const requestId = payload?.requestId || null;
  const normalizedPath = String(payload?.normalizedPath || '').trim();
  const submissionId = String(payload?.submissionId || '').trim();
  const confirmationCode = String(payload?.confirmationCode || '').trim();
  const submissionData = payload?.submissionData && typeof payload.submissionData === 'object' ? payload.submissionData : null;

  if (!normalizedPath || !submissionId || !confirmationCode || !submissionData) {
    logError('Store payload missing required fields', { requestId });
    return response(400, { ok: false, error: 'INVALID_PAYLOAD' });
  }

  const client = await withTimeout(pool.connect(), connectTimeoutMs, 'DB connect');
  try {
    const formResult = await withTimeout(
      client.query(
        `select id,
                name
         from forms.forms
         where code = $1
         limit 1`,
        [normalizedPath]
      ),
      queryTimeoutMs,
      'DB form lookup'
    );

    if (formResult.rowCount === 0) {
      logDebug('Form path not found', { requestId, normalizedPath });
      return response(404, { ok: false, error: 'FORM_NOT_FOUND' });
    }

    const formId = formResult.rows[0].id;
    const formName = formResult.rows[0].name || '';
    await withTimeout(
      client.query(
        `insert into publish.submissions (id, form_id, data, confirmation_code)
         values ($1, $2, $3, $4)`,
        [submissionId, formId, submissionData, confirmationCode]
      ),
      queryTimeoutMs,
      'DB submission insert'
    );

    const recipients = await withTimeout(
      loadRecipients(client, formId),
      queryTimeoutMs,
      'DB recipients lookup'
    );
    const firstName = submissionData.first_name || '';
    const lastName = submissionData.last_name || '';
    const emailJobs = recipients
      .filter((recipient) => recipient?.email)
      .map((recipient) => {
        const includeResults = Boolean(recipient.include_results);
        return {
          to: recipient.email,
          subject: buildSubject(formName, firstName, lastName),
          body: buildPlainTextBody({
            formName,
            firstName,
            lastName,
            confirmationCode,
            data: submissionData,
            includeResults
          }),
          templateData: buildTemplateData({
            formName,
            firstName,
            lastName,
            confirmationCode,
            data: submissionData,
            includeResults
          })
        };
      });

    logDebug('Submission stored', { requestId, submissionId, formId });
    return response(200, { ok: true, submissionId, formId, emailJobs });
  } catch (err) {
    logError('Submission store failed', { requestId, error: err?.message });
    return response(500, { ok: false, error: 'STORE_FAILED' });
  } finally {
    client.release();
  }
};
