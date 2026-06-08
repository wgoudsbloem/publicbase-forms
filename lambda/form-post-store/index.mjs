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

const formatFieldLabel = (name) =>
  String(name || '')
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Field';

const buildSubject = (formName, firstName, lastName) => {
  const namePart = `${lastName} ${firstName}`.trim();
  return namePart ? `${formName}:${namePart}` : formName;
};

const stringifyValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return '[Signature]';
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value.original_name && value.s3_url && value.mime_type) {
    return `${value.original_name} (${value.mime_type})`;
  }
  return JSON.stringify(value);
};

const normalizeUploadMaxSizeMb = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 25;
  return Math.min(100, parsed);
};

const validateUploadMetadata = ({ submissionData, formSchema }) => {
  const schemaFields = [
    ...(Array.isArray(formSchema?.contact) ? formSchema.contact : []),
    ...(Array.isArray(formSchema?.fields) ? formSchema.fields : [])
  ];
  const uploadFields = schemaFields.filter((field) => String(field?.type || '').toLowerCase() === 'upload');
  for (const field of uploadFields) {
    const fieldName = String(field?.name || '').trim();
    if (!fieldName) continue;
    const value = submissionData[fieldName];
    if (value === undefined || value === null || value === '') {
      if (field.required) {
        return { ok: false, error: 'UPLOAD_REQUIRED', fieldName };
      }
      continue;
    }
    if (
      typeof value !== 'object'
      || typeof value.original_name !== 'string'
      || typeof value.s3_url !== 'string'
      || typeof value.mime_type !== 'string'
    ) {
      return { ok: false, error: 'INVALID_UPLOAD_METADATA', fieldName };
    }
    if (!value.s3_url.startsWith('s3://publicbase-files/')) {
      return { ok: false, error: 'INVALID_UPLOAD_LOCATION', fieldName };
    }
    const maxBytes = normalizeUploadMaxSizeMb(field.maxFileSizeMb) * 1024 * 1024;
    const sizeBytes = Number(value.size_bytes);
    if (Number.isFinite(sizeBytes) && sizeBytes > maxBytes) {
      return { ok: false, error: 'UPLOAD_TOO_LARGE', fieldName };
    }
  }
  return { ok: true };
};

const buildFieldTypeMap = (formSchema) => {
  const fieldTypes = {};
  const schemaFields = [
    ...(Array.isArray(formSchema?.contact) ? formSchema.contact : []),
    ...(Array.isArray(formSchema?.fields) ? formSchema.fields : [])
  ];

  schemaFields.forEach((field) => {
    const type = String(field?.type || '').trim().toLowerCase();
    if (type === 'group' && Array.isArray(field?.groupFields)) {
      field.groupFields.forEach((groupField) => {
        const fieldName = String(
          typeof groupField === 'string' ? groupField : groupField?.name
        ).trim();
        if (fieldName) fieldTypes[fieldName] = 'group';
      });
      return;
    }
    const fieldName = String(field?.name || '').trim();
    if (fieldName && type) fieldTypes[fieldName] = type;
  });

  return fieldTypes;
};

const buildOrderedFieldEntries = ({ data, formSchema }) => {
  const submissionData = data && typeof data === 'object' ? data : {};
  const orderedEntries = [];
  const seenKeys = new Set();
  const schemaFields = [
    ...(Array.isArray(formSchema?.contact) ? formSchema.contact : []),
    ...(Array.isArray(formSchema?.fields) ? formSchema.fields : [])
  ];

  schemaFields.forEach((field) => {
    const fieldName = String(field?.name || '').trim();
    if (!fieldName || seenKeys.has(fieldName)) return;
    if (!Object.prototype.hasOwnProperty.call(submissionData, fieldName)) return;
    orderedEntries.push({
      key: fieldName,
      label: String(field?.label || '').trim() || formatFieldLabel(fieldName),
      value: submissionData[fieldName]
    });
    seenKeys.add(fieldName);
  });

  Object.entries(submissionData).forEach(([key, value]) => {
    if (seenKeys.has(key)) return;
    if (key === 'altcha' || key === '_field_types') return;
    orderedEntries.push({
      key,
      label: formatFieldLabel(key),
      value
    });
  });

  return orderedEntries;
};

const buildExtraDataLines = ({ data, formSchema, includeResults }) => {
  if (!includeResults) return '';
  const baseKeys = new Set(['first_name', 'last_name', 'altcha', '_field_types']);
  const entries = buildOrderedFieldEntries({ data, formSchema }).filter(({ key }) => !baseKeys.has(key));
  if (!entries.length) return '';
  return entries.map(({ label, value }) => `${label}: ${stringifyValue(value)}`).join('\n');
};

const buildTemplateData = ({ formName, firstName, lastName, confirmationCode, data, formSchema, includeResults }) =>
  JSON.stringify({
    subject: buildSubject(formName, firstName, lastName),
    form_name: formName || '',
    first_name: firstName || '',
    last_name: lastName || '',
    confirmation_code: confirmationCode || '',
    extra_data_lines: buildExtraDataLines({ data, formSchema, includeResults })
  });

const buildPlainTextBody = ({ formName, firstName, lastName, confirmationCode, data, formSchema, includeResults }) => {
  const lines = [
    formName ? `Form: ${formName}` : '',
    firstName || lastName ? `Applicant: ${`${firstName} ${lastName}`.trim()}` : '',
    confirmationCode ? `Confirmation code: ${confirmationCode}` : ''
  ].filter(Boolean);
  const extraDataLines = buildExtraDataLines({ data, formSchema, includeResults });
  if (extraDataLines) lines.push('', extraDataLines);
  return lines.join('\n');
};

const getFormLookupCandidates = (normalizedPath) => {
  const parts = String(normalizedPath || '').trim().split('/').filter(Boolean);
  if (parts.length < 3) {
    return {
      basePath: '',
      formNumber: '',
      formVersion: ''
    };
  }

  const formVersion = parts.at(-1) || '';
  const formNumber = parts.at(-2) || '';
  const basePath = `/${parts.slice(0, -2).join('/')}`;
  return {
    basePath,
    formNumber,
    formVersion
  };
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
    const lookup = getFormLookupCandidates(normalizedPath);
    const formResult = await withTimeout(
      client.query(
        `select id,
                name,
                user_id,
                schema
         from forms.forms
         where regexp_replace(code, '/+$', '') = $1
           and regexp_replace(
                 regexp_replace(lower(trim(number)), '\\s+', '_', 'g'),
                 '[^a-z0-9_-]',
                 '',
                 'g'
               ) = $2
           and regexp_replace(
                 regexp_replace(lower(trim(coalesce(version, 1)::text)), '\\s+', '_', 'g'),
                 '[^a-z0-9_-]',
                 '',
                 'g'
               ) = $3
         limit 1`,
        [lookup.basePath, lookup.formNumber, lookup.formVersion]
      ),
      queryTimeoutMs,
      'DB form lookup'
    );

    if (formResult.rowCount === 0) {
      logDebug('Form path not found', { requestId, normalizedPath, lookup });
      return response(404, { ok: false, error: 'FORM_NOT_FOUND' });
    }

    const formId = formResult.rows[0].id;
    const formName = formResult.rows[0].name || '';
    const formUserId = formResult.rows[0].user_id || null;
    const formSchema = formResult.rows[0].schema && typeof formResult.rows[0].schema === 'object'
      ? formResult.rows[0].schema
      : null;
    const uploadValidation = validateUploadMetadata({ submissionData, formSchema });
    if (!uploadValidation.ok) {
      logDebug('Upload metadata validation failed', { requestId, ...uploadValidation });
      return response(400, uploadValidation);
    }
    const storedSubmissionData = {
      ...submissionData,
      _field_types: buildFieldTypeMap(formSchema)
    };
    await withTimeout(
      client.query(
        `insert into publish.submissions (id, form_id, data, confirmation_code)
         values ($1, $2, $3, $4)`,
        [submissionId, formId, storedSubmissionData, confirmationCode]
      ),
      queryTimeoutMs,
      'DB submission insert'
    );
    if (formUserId) {
      try {
        await withTimeout(
          client.query(
            `insert into publish.submission_notes (id, submission_id, user_id, subject, body)
             values ($1, $2, $3, $4, $5)`,
            [
              crypto.randomUUID(),
              submissionId,
              formUserId,
              'Submission',
              'Form submitted for review.'
            ]
          ),
          queryTimeoutMs,
          'DB submission note insert'
        );
      } catch (err) {
        logError('Submission stored but initial review note failed', {
          requestId,
          submissionId,
          formId,
          error: err?.message
        });
      }
    }

    const recipients = await withTimeout(
      loadRecipients(client, formId),
      queryTimeoutMs,
      'DB recipients lookup'
    );
    const firstName = storedSubmissionData.first_name || '';
    const lastName = storedSubmissionData.last_name || '';
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
            data: storedSubmissionData,
            formSchema,
            includeResults
          }),
          templateData: buildTemplateData({
            formName,
            firstName,
            lastName,
            confirmationCode,
            data: storedSubmissionData,
            formSchema,
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
