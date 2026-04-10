const submitBtn = document.getElementById('submit-btn');
const form = document.querySelector('form');
const FORM_API_URL = 'https://api.publicbase.com/form';
const FORM_CODE_API_BASE = 'https://api.publicbase.com/form/code';
const FORM_ALTCHA_CHALLENGE_URL = 'https://api.publicbase.com/form/challenge';
const ALTCHA_SCRIPT_URL = 'https://cdn.jsdelivr.net/gh/altcha-org/altcha@main/dist/altcha.min.js';
const CONTENT_MAX_WIDTH_QUERY_PARAM = 'max-width';
const CONTENT_MAX_WIDTH_PATTERN = /^\d+(?:\.\d+)?(?:px|%|pt|em|rem|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pc)$/i;
let issuedFormCode = null;
let altchaScriptPromise = null;
let altchaContextPromise = Promise.resolve(null);
let formCodePromise = Promise.resolve(null);
let isSubmitting = false;

const normalizeFieldKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

const getFormPathFromUrl = () => {
    const path = window.location.pathname || '/';
    const normalized = path.replace(/\/+$/, '').replace(/\/index\.html$/, '');
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const getRequestedContentMaxWidth = () => {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const raw = String(params.get(CONTENT_MAX_WIDTH_QUERY_PARAM) || '').trim();
        if (!raw) return '';
        return CONTENT_MAX_WIDTH_PATTERN.test(raw) ? raw : '';
    } catch {
        return '';
    }
};

const applyRequestedContentMaxWidth = () => {
    const requestedMaxWidth = getRequestedContentMaxWidth();
    if (!requestedMaxWidth) return;
    document.documentElement.style.setProperty('--public-content-max-width', requestedMaxWidth);
};

const propagateRequestedContentMaxWidthToLinks = () => {
    const requestedMaxWidth = getRequestedContentMaxWidth();
    if (!requestedMaxWidth) return;
    document.querySelectorAll('body > main > section table a[href]').forEach((link) => {
        const rawHref = String(link.getAttribute('href') || '').trim();
        if (!rawHref || rawHref.startsWith('#')) return;
        let resolved;
        try {
            resolved = new URL(rawHref, window.location.href);
        } catch {
            return;
        }
        if (resolved.origin !== window.location.origin) return;
        if (resolved.searchParams.has(CONTENT_MAX_WIDTH_QUERY_PARAM)) return;
        resolved.searchParams.set(CONTENT_MAX_WIDTH_QUERY_PARAM, requestedMaxWidth);
        const nextHref = `${resolved.pathname}${resolved.search}${resolved.hash}`;
        link.setAttribute('href', nextHref);
    });
};

const attachInventoryFilter = () => {
    const filterInput = document.getElementById("form-number-filter");
    if (!filterInput) return;
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    filterInput.addEventListener("input", () => {
        const query = filterInput.value.trim().toLowerCase();
        rows.forEach((row) => {
            const formNumber = row.querySelector("[data-form-number]")?.getAttribute("data-form-number") || "";
            row.hidden = query !== "" && !formNumber.includes(query);
        });
    });
};

const collectFormData = (form) => {
    const values = {};
    const fields = form.querySelectorAll('input, select, textarea');
    fields.forEach((field) => {
        if (field.disabled) return;
        if (field.type === 'radio' && !field.checked) return;
        const label = field.closest('label');
        const labelTitle = label ? label.querySelector('.label-title') : null;
        const rawKey = field.name || (labelTitle ? labelTitle.textContent : '') || field.id || 'field';
        const key = normalizeFieldKey(rawKey);
        values[key] = field.type === 'checkbox' ? Boolean(field.checked) : field.value;
    });
    const submittedValues = new FormData(form);
    submittedValues.forEach((value, rawKey) => {
        const key = normalizeFieldKey(rawKey);
        if (!key || Object.prototype.hasOwnProperty.call(values, key)) return;
        values[key] = typeof value === 'string' ? value : value?.name || '';
    });
    return values;
};

const capitalizeFirstEntry = (value) => {
    if (!value) return value;
    const first = value.charAt(0);
    if (!first || first === first.toUpperCase()) return value;
    return first.toUpperCase() + value.slice(1);
};

const attachCapitalization = () => {
    if (!form) return;
    const fields = form.querySelectorAll(
        'input[type="text"], input[type="search"], input[type="tel"], input[type="url"], input:not([type])'
    );
    fields.forEach((field) => {
        if (field.dataset.capFirst === 'true') return;
        field.dataset.capFirst = 'true';
        field.addEventListener('blur', () => {
            field.value = capitalizeFirstEntry(field.value);
        });
    });
};

const attachTextareaCounters = () => {
    if (!form) return;
    const fields = form.querySelectorAll('textarea[data-character-count="true"]');
    fields.forEach((field) => {
        if (field.dataset.charCountBound === 'true') return;
        field.dataset.charCountBound = 'true';

        let counter = field.nextElementSibling;
        if (!counter || !counter.hasAttribute('data-character-count-output')) {
            counter = document.createElement('small');
            counter.setAttribute('aria-live', 'polite');
            counter.setAttribute('data-character-count-output', '');
            field.insertAdjacentElement('afterend', counter);
        }

        const updateCounter = () => {
            const count = String(field.value || '').length;
            counter.textContent = `${count} character${count === 1 ? '' : 's'}`;
        };

        field.addEventListener('input', updateCounter);
        updateCounter();
    });
};

const initFormCode = async () => {
    if (!form) return null;
    const formPath = getFormPathFromUrl();
    if (!formPath) {
        console.warn('Missing form path in URL.');
        return null;
    }
    try {
        const encodedPath = btoa(formPath);
        const res = await fetch(`${FORM_CODE_API_BASE}?id=${encodeURIComponent(encodedPath)}`, {
            method: 'GET'
        });
        if (!res.ok) {
            console.warn('Failed to fetch form code', { status: res.status });
            return null;
        }
        const json = await res.json();
        issuedFormCode = json?.code || null;
        return issuedFormCode;
    } catch (err) {
        console.warn('Form code request error', err);
        return null;
    }
};

const showConfirmationModal = (code, redirectTo) => {
    const existing = document.getElementById('confirmation-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirmation-overlay';

    const modal = document.createElement('div');
    modal.id = 'confirmation-modal';

    const title = document.createElement('h2');
    title.textContent = 'Submission received';

    const message = document.createElement('p');
    message.textContent = 'Your confirmation code is:';

    const codeRow = document.createElement('div');
    codeRow.id = 'confirmation-code';

    const codeText = document.createElement('span');
    codeText.textContent = code;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.id = 'copy-confirmation';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(code);
            copyBtn.textContent = 'Copied';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 1500);
        } catch (err) {
            console.warn('Clipboard copy failed', err);
        }
    });

    codeRow.append(codeText, copyBtn);

    const actions = document.createElement('div');
    actions.id = 'confirmation-actions';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Continue';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        window.location.assign(redirectTo);
    });

    actions.appendChild(closeBtn);

    modal.append(title, message, codeRow, actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
};

const loadAltchaScript = async () => {
    if (window.customElements?.get('altcha-widget')) return;
    if (!altchaScriptPromise) {
        altchaScriptPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-altcha-script="true"]');
            if (existing) {
                resolve();
                existing.addEventListener(
                    'error',
                    () => {
                        altchaScriptPromise = null;
                        reject(new Error('ALTCHA script failed to load.'));
                    },
                    { once: true }
                );
                return;
            }
            const script = document.createElement('script');
            script.type = 'module';
            script.async = true;
            script.defer = true;
            script.src = ALTCHA_SCRIPT_URL;
            script.dataset.altchaScript = 'true';
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener(
                'error',
                () => {
                    altchaScriptPromise = null;
                    reject(new Error('ALTCHA script failed to load.'));
                },
                { once: true }
            );
            document.head.appendChild(script);
        });
    }
    await altchaScriptPromise;
    if (window.customElements?.whenDefined) {
        await window.customElements.whenDefined('altcha-widget');
    }
};

const setAltchaStatus = (context, message, tone = 'idle') => {
    if (!context?.status) return;
    context.status.textContent = message;
    context.status.dataset.tone = tone;
};

const syncAltchaState = (context, state) => {
    if (!context?.shell) return;
    context.shell.dataset.altchaState = state;
    if (state === 'verified') {
        setAltchaStatus(context, 'Verification complete. You can submit the form.', 'success');
        return;
    }
    if (state === 'verifying') {
        setAltchaStatus(context, 'Verifying challenge...', 'warning');
        return;
    }
    if (state === 'error') {
        setAltchaStatus(context, 'Verification failed. Please try again.', 'error');
        return;
    }
    if (state === 'expired') {
        setAltchaStatus(context, 'Verification expired. Please verify again.', 'warning');
        return;
    }
    if (state === 'code') {
        setAltchaStatus(context, 'Complete the ALTCHA challenge to continue.', 'warning');
        return;
    }
    setAltchaStatus(context, 'Complete the verification step before submitting.', 'idle');
};

const isAltchaVerified = (context) => {
    if (!context?.widget) return true;
    try {
        return context.widget.getState?.() === 'verified';
    } catch {
        return context.shell?.dataset.altchaState === 'verified';
    }
};

const requestAltchaVerification = (context) => {
    if (!context?.widget) return;
    context.pendingSubmit = true;
    syncAltchaState(context, context.widget.getState?.() || 'unverified');
    context.shell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (context.widget.getState?.() === 'verifying') return;
    try {
        context.widget.verify();
    } catch (err) {
        console.warn('ALTCHA verification could not be started', err);
        syncAltchaState(context, 'error');
    }
};

const initAltcha = async () => {
    if (!form) return null;
    const configuredMode = String(form.dataset.altchaMode || '').trim().toLowerCase();
    const mode = ['off', 'false', 'disabled', 'none'].includes(configuredMode)
        ? ''
        : (configuredMode || 'server');
    if (!mode) return null;

    const shell = document.createElement('div');
    shell.className = 'altcha-shell';
    shell.dataset.altchaState = 'loading';

    const title = document.createElement('p');
    title.className = 'altcha-title';
    title.textContent = 'Human verification';

    const hint = document.createElement('p');
    hint.className = 'altcha-hint';
    hint.textContent = mode === 'test'
        ? 'This form uses ALTCHA test mode, so verification works without a live challenge endpoint.'
        : 'Complete the ALTCHA verification before submitting this form.';

    const widget = document.createElement('altcha-widget');
    widget.setAttribute('name', 'altcha');
    if (mode === 'test') {
        widget.setAttribute('test', '');
    }

    const status = document.createElement('small');
    status.className = 'altcha-status';
    status.setAttribute('aria-live', 'polite');

    shell.append(title, hint, widget, status);

    const submitControl = form.querySelector('#submit-btn, button[type="submit"], input[type="submit"]');
    form.insertBefore(shell, submitControl || null);

    const context = {
        mode,
        widget,
        shell,
        status,
        pendingSubmit: false,
        loadError: null
    };

    syncAltchaState(context, 'unverified');

    if (mode !== 'test') {
        const formCode = await formCodePromise;
        if (!formCode) {
            context.loadError = new Error('Missing form code for ALTCHA challenge.');
            syncAltchaState(context, 'error');
            setAltchaStatus(context, 'ALTCHA could not start because no form code was issued.', 'error');
            return context;
        }
        widget.setAttribute('challengeurl', `${FORM_ALTCHA_CHALLENGE_URL}?code=${encodeURIComponent(formCode)}`);
    }

    try {
        await loadAltchaScript();
    } catch (err) {
        context.loadError = err;
        console.warn('ALTCHA failed to initialize', err);
        syncAltchaState(context, 'error');
        setAltchaStatus(context, 'ALTCHA could not load. Submission is blocked until it is available.', 'error');
        return context;
    }

    widget.addEventListener('load', () => {
        if (!isAltchaVerified(context)) {
            syncAltchaState(context, widget.getState?.() || 'unverified');
        }
    });

    widget.addEventListener('statechange', (event) => {
        const state = String(event.detail?.state || 'unverified');
        syncAltchaState(context, state);
        if (state === 'verified' && context.pendingSubmit) {
            context.pendingSubmit = false;
            submitForm();
        }
    });

    widget.addEventListener('verified', () => {
        syncAltchaState(context, 'verified');
        if (!context.pendingSubmit) return;
        context.pendingSubmit = false;
        submitForm();
    });

    return context;
};

const submitForm = async () => {
    if (!form || isSubmitting) return;
    if (typeof form.reportValidity === 'function') {
        if (!form.reportValidity()) return;
    } else if (!form.checkValidity()) {
        return;
    }

    const formCode = await formCodePromise;
    if (!formCode) {
        console.warn('Missing issued form code.');
        return;
    }
    issuedFormCode = formCode;

    const altcha = await altchaContextPromise;
    if (altcha?.loadError) {
        console.warn('ALTCHA is required but unavailable.');
        return;
    }
    if (altcha && !isAltchaVerified(altcha)) {
        requestAltchaVerification(altcha);
        return;
    }

    const payload = {
        code: formCode,
        data: collectFormData(form)
    };

    isSubmitting = true;
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    try {
        const res = await fetch(FORM_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            console.warn('Form submission failed', { status: res.status });
            return;
        }
        const json = await res.json().catch(() => null);
        const confirmationCode = json?.confirmationCode || null;
        const formPath = getFormPathFromUrl();
        const segments = formPath.split('/').filter(Boolean);
        const root = segments.length >= 3 ? `/${segments.slice(0, 3).join('/')}` : '/';
        if (confirmationCode) {
            showConfirmationModal(confirmationCode, root);
        } else {
            window.location.assign(root);
        }
    } catch (err) {
        console.warn('Form submission error', err);
    } finally {
        isSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
};

formCodePromise = initFormCode();
applyRequestedContentMaxWidth();
propagateRequestedContentMaxWidthToLinks();
attachInventoryFilter();
attachCapitalization();
attachTextareaCounters();
altchaContextPromise = initAltcha();

if (form) {
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitForm();
    });
}

// Date rule application logic
(() => {
    const parseDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim()) ? String(value).trim() : null;
    const formatDate = (date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const parseParts = (value) => {
        const normalized = parseDate(value);
        if (!normalized) return null;
        const [year, month, day] = normalized.split('-').map(Number);
        return { year, month, day };
    };
    const addDays = (value, delta) => {
        const parts = parseParts(value);
        if (!parts) return null;
        const date = new Date(parts.year, parts.month - 1, parts.day);
        date.setDate(date.getDate() + delta);
        return formatDate(date);
    };
    const addMonths = (value, delta) => {
        const parts = parseParts(value);
        if (!parts) return null;
        const totalMonths = (parts.year * 12) + (parts.month - 1) + delta;
        const year = Math.floor(totalMonths / 12);
        const monthIndex = ((totalMonths % 12) + 12) % 12;
        const maxDay = new Date(year, monthIndex + 1, 0).getDate();
        const day = Math.min(parts.day, maxDay);
        return formatDate(new Date(year, monthIndex, day));
    };
    const today = () => formatDate(new Date());
    const resolveRule = (fallbackValue, rawRule) => {
        let rule = null;
        try {
            rule = rawRule ? JSON.parse(rawRule) : null;
        } catch {
            rule = null;
        }
        const mode = String(rule?.mode || '').trim().toLowerCase();
        if (!mode) return parseDate(fallbackValue);
        if (mode === 'fixed') {
            return parseDate(rule.baseDate);
        }
        const amount = Number(rule.amount);
        if (!Number.isInteger(amount) || amount < 0) return parseDate(fallbackValue);
        const direction = String(rule.direction || '').trim().toLowerCase() === 'minus' ? -1 : 1;
        const unit = ['days', 'weeks', 'months'].includes(String(rule.unit || '').trim().toLowerCase())
            ? String(rule.unit).trim().toLowerCase()
            : 'days';
        const baseDate = mode === 'relative_today' ? today() : parseDate(rule.baseDate);
        if (!baseDate) return parseDate(fallbackValue);
        const delta = amount * direction;
        if (unit === 'months') return addMonths(baseDate, delta);
        return addDays(baseDate, unit === 'weeks' ? delta * 7 : delta);
    };
    const applyRules = () => {
        document.querySelectorAll('input[type="date"][data-date-rule-bound]').forEach((input) => {
            const minValue = resolveRule(input.getAttribute('data-min-value'), input.getAttribute('data-min-rule'));
            const maxValue = resolveRule(input.getAttribute('data-max-value'), input.getAttribute('data-max-rule'));
            if (minValue) input.min = minValue;
            if (maxValue) input.max = maxValue;
        });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyRules);
    } else {
        applyRules();
    }
})();
