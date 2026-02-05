const baseEl = document.getElementById('form-base');
const submitBtn = document.getElementById('submit-form');
const FORM_API_URL = 'https://api.publicbase.com/form';

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

        const formId = baseEl ? baseEl.dataset.formId : null;
        const departmentId = baseEl ? baseEl.dataset.departmentId : null;
        // if (!formId || !departmentId) {
        //     console.warn('Missing formId or departmentId on #form-base data attributes.');
        //     return;
        // }

        const payload = {
            formId,
            departmentId,
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
