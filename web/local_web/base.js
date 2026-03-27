const submitBtn = document.getElementById('submit-btn');
const form = document.querySelector('form');
const FORM_API_URL = 'https://api.publicbase.com/form';
const FORM_CODE_API_BASE = 'https://api.publicbase.com/form/code';
let issuedFormCode = null;

const getFormPathFromUrl = () => {
    const path = window.location.pathname || '/';
    const normalized = path.replace(/\/+$/, '').replace(/\/index\.html$/, '');
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
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
        const key = rawKey.trim().toLowerCase().replace(/\s+/g, '_');
        values[key] = field.type === 'checkbox' ? Boolean(field.checked) : field.value;
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
        if (!counter || !counter.classList.contains('textarea-word-count')) {
            counter = document.createElement('small');
            counter.className = 'textarea-word-count';
            counter.setAttribute('aria-live', 'polite');
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

if (submitBtn) {
    submitBtn.addEventListener('click', async () => {

        if (!form) return;
        if (typeof form.reportValidity === 'function') {
            if (!form.reportValidity()) return;
        } else if (!form.checkValidity()) {
            return;
        }

        if (!issuedFormCode) {
            console.warn('Missing issued form code.');
            return;
        }

        const payload = {
            code: issuedFormCode,
            data: collectFormData(form)
        };

        submitBtn.disabled = true;
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
            submitBtn.disabled = false;
        }
    });
}

const initFormCode = async () => {
    if (!form) return;
    const formPath = getFormPathFromUrl();
    if (!formPath) {
        console.warn('Missing form path in URL.');
        return;
    }
    try {
        const encodedPath = btoa(formPath);
        const res = await fetch(`${FORM_CODE_API_BASE}?id=${encodeURIComponent(encodedPath)}`, {
            method: 'GET'
        });
        if (!res.ok) {
            console.warn('Failed to fetch form code', { status: res.status });
            return;
        }
        const json = await res.json();
        issuedFormCode = json?.code || null;
    } catch (err) {
        console.warn('Form code request error', err);
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

initFormCode();
attachCapitalization();
attachTextareaCounters();

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