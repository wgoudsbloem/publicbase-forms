const baseEl = document.getElementById('form-base');
const submitBtn = document.getElementById('submit-form');
const FORM_API_URL = 'https://api.publicbase.com/form';
const FORM_CODE_API_BASE = 'https://api.publicbase.com/form/code';
let issuedFormCode = null;

const getFormPathFromUrl = () => {
    const path = window.location.pathname || '/';
    return path.replace(/^\/+/, '').replace(/\/+$/, '');
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

if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const form = baseEl ? baseEl.querySelector('form') : null;
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
            form.reset();
        } catch (err) {
            console.warn('Form submission error', err);
        } finally {
            submitBtn.disabled = false;
        }
    });
}

const initFormCode = async () => {
    if (!baseEl) return;
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

initFormCode();
