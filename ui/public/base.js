const submitBtn = document.getElementById('submit-btn');
const form = document.querySelector('form');
const FORM_API_URL = 'https://api.publicbase.com/form';
const FORM_UPLOAD_GRANT_API_URL = 'https://api.publicbase.com/form/upload/grant';
const FORM_UPLOAD_API_URL = 'https://api.publicbase.com/form/upload';
const FORM_CODE_API_BASE = 'https://api.publicbase.com/form/code';
const FORM_ALTCHA_CHALLENGE_URL = 'https://api.publicbase.com/form/challenge';
const ALTCHA_SCRIPT_URL = '/altcha.min.js';
const CONTENT_MAX_WIDTH_QUERY_PARAM = 'max-width';
const EMBED_QUERY_PARAM = 'embed';
const CONTENT_MAX_WIDTH_PATTERN = /^\d+(?:\.\d+)?(?:px|%|pt|em|rem|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pc)$/i;
let issuedFormCode = null;
let altchaScriptPromise = null;
let altchaContextPromise = Promise.resolve(null);
let formCodePromise = Promise.resolve(null);
let isSubmitting = false;
const NEW_WINDOW_WARNING = 'Opens in a new window';

const normalizeFieldKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

const getNewWindowLinkFromEvent = (event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const item of path) {
        if (item?.matches?.('a[target="_blank"]')) return item;
    }
    return event.target?.closest?.('a[target="_blank"]') || null;
};

const applyNewWindowLinkWarning = (link) => {
    if (!link?.matches?.('a[target="_blank"]')) return;
    if (!String(link.getAttribute('title') || '').includes(NEW_WINDOW_WARNING)) {
        link.setAttribute('title', NEW_WINDOW_WARNING);
    }

    const currentLabel = String(link.getAttribute('aria-label') || '').trim();
    if (currentLabel && !currentLabel.includes(NEW_WINDOW_WARNING)) {
        link.setAttribute('aria-label', `${currentLabel}. ${NEW_WINDOW_WARNING}.`);
    }
};

const applyNewWindowLinkWarnings = (root = document) => {
    root.querySelectorAll?.('a[target="_blank"]').forEach(applyNewWindowLinkWarning);
};

const initNewWindowLinkWarnings = () => {
    applyNewWindowLinkWarnings();
    document.addEventListener(
        'click',
        (event) => {
            const link = getNewWindowLinkFromEvent(event);
            if (!link) return;
            applyNewWindowLinkWarning(link);
            if (window.confirm('This link opens in a new window. Continue?')) return;
            event.preventDefault();
            event.stopPropagation();
        },
        true
    );

    const observer = new MutationObserver(() => applyNewWindowLinkWarnings());
    observer.observe(document.documentElement, { childList: true, subtree: true });
};

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

const isEmbedRequested = () => {
    try {
        const params = new URLSearchParams(window.location.search || '');
        return String(params.get(EMBED_QUERY_PARAM) || '').trim().toLowerCase() === 'true';
    } catch {
        return false;
    }
};

const applyRequestedContentMaxWidth = () => {
    const requestedMaxWidth = getRequestedContentMaxWidth();
    if (!requestedMaxWidth) return;
    document.documentElement.style.setProperty('--public-content-max-width', requestedMaxWidth);
};

const getEmbedRoot = () => {
    return document.querySelector('[data-embed-root]')
        || document.querySelector('body > main > form')
        || document.querySelector('body > main > section');
};

const applyEmbedMode = () => {
    if (!isEmbedRequested()) return;
    const embedRoot = getEmbedRoot();
    if (!embedRoot) return;
    document.documentElement.classList.add('public-embed');
    document.body.classList.add('public-embed');
    embedRoot.classList.add('public-embed-root');
    document.body.replaceChildren(embedRoot);
};

const propagateRequestedContentMaxWidthToLinks = () => {
    const requestedMaxWidth = getRequestedContentMaxWidth();
    const embedRequested = isEmbedRequested();
    if (!requestedMaxWidth && !embedRequested) return;
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
        if (requestedMaxWidth && !resolved.searchParams.has(CONTENT_MAX_WIDTH_QUERY_PARAM)) {
            resolved.searchParams.set(CONTENT_MAX_WIDTH_QUERY_PARAM, requestedMaxWidth);
        }
        if (embedRequested && !resolved.searchParams.has(EMBED_QUERY_PARAM)) {
            resolved.searchParams.set(EMBED_QUERY_PARAM, 'true');
        }
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
        if (field.type === 'file') return;
        if (field.type === 'radio' && !field.checked) return;
        const label = field.closest('label');
        const labelTitle = label ? label.querySelector('.label-title') : null;
        const rawKey = field.name || (labelTitle ? labelTitle.textContent : '') || field.id || 'field';
        const key = normalizeFieldKey(rawKey);
        values[key] = field.type === 'checkbox' ? Boolean(field.checked) : field.value;
    });
    form.querySelectorAll('canvas[data-signature-name]').forEach((canvas) => {
        const key = normalizeFieldKey(canvas.dataset.signatureName);
        if (!key) return;
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        values[key] = canvas.toDataURL() === blank.toDataURL() ? '' : canvas.toDataURL('image/png');
    });
    const submittedValues = new FormData(form);
    submittedValues.forEach((value, rawKey) => {
        const key = normalizeFieldKey(rawKey);
        if (!key || Object.prototype.hasOwnProperty.call(values, key)) return;
        if (value instanceof File) return;
        values[key] = typeof value === 'string' ? value : value?.name || '';
    });
    return values;
};

const getUploadFields = (form) => [...form.querySelectorAll('input[type="file"][data-upload-field="true"]')]
    .filter((field) => !field.disabled);

const validateUploadFields = (uploadFields) => {
    for (const field of uploadFields) {
        const file = field.files?.[0] || null;
        if (!file) continue;
        if (file.size <= 0) {
            field.setCustomValidity('Choose a file that is not empty.');
            field.reportValidity();
            return false;
        }
        const maxSizeBytes = Number(field.dataset.maxSizeBytes) || ((Number(field.dataset.maxSizeMb) || 25) * 1024 * 1024);
        if (file.size > maxSizeBytes) {
            const maxSizeMb = Number(field.dataset.maxSizeMb) || Math.round(maxSizeBytes / 1024 / 1024);
            field.setCustomValidity(`Choose a file ${maxSizeMb} MB or smaller.`);
            field.reportValidity();
            return false;
        }
        field.setCustomValidity('');
    }
    return true;
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const value = String(reader.result || '');
        resolve(value.includes(',') ? value.split(',').pop() : value);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read upload chunk'));
    reader.readAsDataURL(blob);
});

const uploadSubmissionFiles = async ({ formCode, submissionId, altchaPayload }) => {
    const uploads = {};
    const uploadFields = getUploadFields(form);
    if (!validateUploadFields(uploadFields)) {
        throw new Error('Upload field validation failed');
    }
    if (uploadFields.some((field) => field.files?.[0]) && !altchaPayload) {
        throw new Error('Complete verification before uploading files.');
    }

    for (const field of uploadFields) {
        const file = field.files?.[0] || null;
        if (!file) continue;
        const fieldName = normalizeFieldKey(field.name || field.id || 'upload');
        if (!fieldName) continue;

        const grantResponse = await fetch(FORM_UPLOAD_GRANT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: formCode,
                altcha: altchaPayload,
                submissionId,
                fieldName,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size
            })
        });
        if (!grantResponse.ok) {
            throw new Error(`Failed to prepare upload for ${fieldName}`);
        }
        const grant = await grantResponse.json();
        if (!grant?.uploadToken || !grant?.s3Url) {
            throw new Error(`Missing upload grant for ${fieldName}`);
        }

        const startResponse = await fetch(FORM_UPLOAD_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'start',
                uploadToken: grant.uploadToken
            })
        });
        if (!startResponse.ok) {
            throw new Error(`Failed to start upload for ${fieldName}`);
        }
        const started = await startResponse.json();
        const uploadId = started?.uploadId;
        if (!uploadId) {
            throw new Error(`Missing upload id for ${fieldName}`);
        }

        const chunkSize = Number(grant.chunkSize) || (5 * 1024 * 1024);
        const parts = [];
        let partNumber = 1;
        for (let offset = 0; offset < file.size; offset += chunkSize) {
            const chunk = file.slice(offset, Math.min(file.size, offset + chunkSize));
            const chunkBase64 = await blobToBase64(chunk);
            const chunkResponse = await fetch(FORM_UPLOAD_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chunk',
                    uploadToken: grant.uploadToken,
                    uploadId,
                    partNumber,
                    chunkBase64
                })
            });
            if (!chunkResponse.ok) {
                throw new Error(`Failed to upload ${file.name}`);
            }
            const uploadedPart = await chunkResponse.json();
            parts.push({ partNumber, etag: uploadedPart.etag });
            partNumber += 1;
        }

        const completeResponse = await fetch(FORM_UPLOAD_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'complete',
                uploadToken: grant.uploadToken,
                uploadId,
                parts
            })
        });
        if (!completeResponse.ok) {
            throw new Error(`Failed to upload ${file.name}`);
        }
        const completed = await completeResponse.json();

        uploads[fieldName] = {
            original_name: completed.originalName || file.name,
            s3_url: completed.s3Url || grant.s3Url,
            mime_type: completed.mimeType || file.type || 'application/octet-stream',
            size_bytes: completed.sizeBytes || file.size
        };
    }
    return uploads;
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

const attachPatternValidation = () => {
    if (!form) return;
    form.querySelectorAll('textarea[data-pattern], input[pattern]').forEach((el) => {
        if (el.dataset.patternBound === 'true') return;
        el.dataset.patternBound = 'true';
        const raw = el.dataset.pattern || el.getAttribute('pattern');
        if (!raw) return;
        // Remove the pattern attribute so the browser's v-flag validation doesn't conflict
        if (el.hasAttribute('pattern')) el.removeAttribute('pattern');
        const re = (() => { try { return new RegExp(`^(?:${raw})$`); } catch { return null; } })();
        if (!re) return;
        const check = () => {
            const val = el.value;
            if (val && !re.test(val)) {
                el.setCustomValidity('Please match the requested format.');
            } else {
                el.setCustomValidity('');
            }
        };
        el.addEventListener('input', check);
        el.addEventListener('change', check);
    });
};

const attachTextareaPatterns = attachPatternValidation;

const attachGroupFieldInputs = () => {
    document.querySelectorAll('[data-group-field]').forEach((fieldRoot) => {
        if (fieldRoot.dataset.groupFieldBound === 'true') return;
        fieldRoot.dataset.groupFieldBound = 'true';

        const boxes = Array.from(fieldRoot.querySelectorAll('.group-char-input'));
        if (!boxes.length) return;

        const sync = () => {
            const filledCount = boxes.filter((input) => String(input.value || '') !== '').length;
            const isRequired = fieldRoot.hasAttribute('data-group-required');
            let message = '';
            if (isRequired && filledCount < boxes.length) {
                message = 'Complete all boxes.';
            } else if (!isRequired && filledCount > 0 && filledCount < boxes.length) {
                message = 'Complete all boxes or leave the field empty.';
            }
            boxes.forEach((input) => input.setCustomValidity(message));
        };

        const focusBox = (index) => {
            const target = boxes[index];
            if (!target) return;
            target.focus();
            target.select();
        };

        boxes.forEach((input, index) => {
            input.addEventListener('input', () => {
                const value = String(input.value || '');
                input.value = value ? value.slice(-1) : '';
                sync();
                if (input.value && index < boxes.length - 1) {
                    focusBox(index + 1);
                }
            });

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Backspace' && !input.value && index > 0) {
                    focusBox(index - 1);
                }
                if (event.key === 'ArrowLeft' && index > 0) {
                    event.preventDefault();
                    focusBox(index - 1);
                }
                if (event.key === 'ArrowRight' && index < boxes.length - 1) {
                    event.preventDefault();
                    focusBox(index + 1);
                }
            });

            input.addEventListener('paste', (event) => {
                const pasted = String(event.clipboardData?.getData('text') || '').replace(/\s+/g, '');
                if (!pasted) return;
                event.preventDefault();
                pasted.slice(0, boxes.length - index).split('').forEach((char, offset) => {
                    const target = boxes[index + offset];
                    if (target) target.value = char;
                });
                sync();
                focusBox(Math.min(index + pasted.length, boxes.length - 1));
            });
        });

        sync();
    });
};

const focusableSelector = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

const isHiddenFromAssistiveTech = (element) => {
    return Boolean(element.closest('[hidden], [aria-hidden="true"]'));
};

const getFocusableElements = (root = document) => {
    const elements = [];
    if (root instanceof Element && root.matches(focusableSelector)) {
        elements.push(root);
    }
    root.querySelectorAll(focusableSelector).forEach((element) => elements.push(element));
    return elements;
};

const syncHiddenFocusableControls = (root = document) => {
    getFocusableElements(root).forEach((element) => {
        const hidden = isHiddenFromAssistiveTech(element);
        if (hidden) {
            if (!element.hasAttribute('data-pb-hidden-original-tabindex')) {
                element.setAttribute('data-pb-hidden-original-tabindex', element.getAttribute('tabindex') ?? '');
            }
            if (element.getAttribute('tabindex') !== '-1') {
                element.setAttribute('tabindex', '-1');
            }
            if ('disabled' in element && !element.disabled) {
                element.setAttribute('data-pb-hidden-disabled', 'true');
                element.disabled = true;
            }
            return;
        }

        if (element.hasAttribute('data-pb-hidden-original-tabindex')) {
            const original = element.getAttribute('data-pb-hidden-original-tabindex') || '';
            if (original) {
                element.setAttribute('tabindex', original);
            } else {
                element.removeAttribute('tabindex');
            }
            element.removeAttribute('data-pb-hidden-original-tabindex');
        }
        if (element.getAttribute('data-pb-hidden-disabled') === 'true') {
            element.disabled = false;
            element.removeAttribute('data-pb-hidden-disabled');
        }
    });
};

const initHiddenFocusableGuard = () => {
    syncHiddenFocusableControls();
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof Element) {
                        syncHiddenFocusableControls(node);
                    }
                });
                syncHiddenFocusableControls();
                return;
            }
            const target = mutation.target;
            if (target instanceof Element) {
                syncHiddenFocusableControls(target);
                syncHiddenFocusableControls();
            }
        });
    });
    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['hidden', 'aria-hidden']
    });
};

const initSignaturePads = () => {
    if (!form) return;
    form.querySelectorAll('canvas[data-signature-name]').forEach((canvas) => {
        if (canvas.dataset.sigBound === 'true') return;
        canvas.dataset.sigBound = 'true';
        canvas.dataset.signed = 'false';

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#1f2733';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) * (canvas.width / rect.width),
                y: (e.clientY - rect.top) * (canvas.height / rect.height),
            };
        };

        let drawing = false;
        canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            drawing = true;
            canvas.setPointerCapture(e.pointerId);
            const { x, y } = getPos(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!drawing) return;
            const { x, y } = getPos(e);
            ctx.lineTo(x, y);
            ctx.stroke();
            canvas.dataset.signed = 'true';
            canvas.classList.remove('signature-pad--error');
        });
        canvas.addEventListener('pointerup', () => { drawing = false; });
        canvas.addEventListener('pointercancel', () => { drawing = false; });

        const clearBtn = canvas.nextElementSibling;
        if (clearBtn && clearBtn.classList.contains('signature-clear')) {
            clearBtn.addEventListener('click', () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.dataset.signed = 'false';
            });
        }
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

const ensureSubmitOverlay = () => {
    let overlay = document.getElementById('form-submit-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'form-submit-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.hidden = true;

    const panel = document.createElement('div');
    panel.className = 'form-submit-overlay-panel';

    const spinner = document.createElement('div');
    spinner.className = 'form-submit-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const message = document.createElement('p');
    message.textContent = 'Please wait while we submit your form.';

    panel.append(spinner, message);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return overlay;
};

const showSubmitOverlay = () => {
    const overlay = ensureSubmitOverlay();
    overlay.hidden = false;
    document.body.classList.add('is-submitting-form');
};

const hideSubmitOverlay = () => {
    const overlay = document.getElementById('form-submit-overlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('is-submitting-form');
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
    setAltchaStatus(context, '', 'idle');
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
        applyNewWindowLinkWarnings(widget.shadowRoot || widget);
        if (!isAltchaVerified(context)) {
            syncAltchaState(context, widget.getState?.() || 'unverified');
        }
    });
    requestAnimationFrame(() => applyNewWindowLinkWarnings(widget.shadowRoot || widget));

    widget.addEventListener('statechange', (event) => {
        const state = String(event.detail?.state || 'unverified');
        applyNewWindowLinkWarnings(widget.shadowRoot || widget);
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

    const unsignedRequired = [...form.querySelectorAll('canvas[data-signature-required="true"]')]
        .filter((c) => c.dataset.signed !== 'true');
    if (unsignedRequired.length) {
        unsignedRequired.forEach((c) => c.classList.add('signature-pad--error'));
        unsignedRequired[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    if (!validateUploadFields(getUploadFields(form))) {
        return;
    }

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

    isSubmitting = true;
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    showSubmitOverlay();
    try {
        const submissionId = crypto.randomUUID();
        const baseFormData = collectFormData(form);
        const uploadMetadata = await uploadSubmissionFiles({
            formCode,
            submissionId,
            altchaPayload: typeof baseFormData.altcha === 'string' ? baseFormData.altcha : ''
        });
        const payload = {
            code: formCode,
            submissionId,
            data: {
                ...baseFormData,
                ...uploadMetadata
            }
        };
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
        hideSubmitOverlay();
        isSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
};

formCodePromise = initFormCode();
applyRequestedContentMaxWidth();
applyEmbedMode();
propagateRequestedContentMaxWidthToLinks();
initNewWindowLinkWarnings();
attachInventoryFilter();
attachCapitalization();
attachTextareaCounters();
attachTextareaPatterns();
attachGroupFieldInputs();
initHiddenFocusableGuard();
initSignaturePads();
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
