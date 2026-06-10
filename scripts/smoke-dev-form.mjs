import { chromium } from '@playwright/test';

const url = process.env.PUBLICBASE_FORM_SMOKE_URL
  || 'https://dev-forms.publicbase.com/ca/on/acme_corp/dog_license_application/as-001/1';
const screenshotPath = process.env.PUBLICBASE_FORM_SMOKE_SCREENSHOT
  || '/tmp/publicbase-dog-form-smoke.png';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1
});
const errors = [];

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('form[data-embed-root="form"] > div:first-of-type', { timeout: 15000 });
await page.waitForSelector('publicbase-altcha', { timeout: 15000 });

const result = await page.evaluate(() => ({
  title: document.title,
  formSectionCount: document.querySelectorAll('form > section').length,
  generatedClassCount: (() => {
    const main = document.querySelector('main')?.cloneNode(true);
    main?.querySelectorAll('altcha-widget').forEach((element) => element.remove());
    return main?.querySelectorAll('[class]').length || 0;
  })(),
  generatedIdCount: (() => {
    const main = document.querySelector('main')?.cloneNode(true);
    main?.querySelectorAll('altcha-widget').forEach((element) => element.remove());
    return main?.querySelectorAll('[id]').length || 0;
  })(),
  hasAltchaWrapper: Boolean(document.querySelector('publicbase-altcha')),
  altchaState: document.querySelector('publicbase-altcha')?.dataset.altchaState || '',
  submitButtonText: document.querySelector('form button[type="submit"]')?.textContent?.trim() || '',
  firstFieldVisible: Boolean(document.querySelector('input[name="first_name"]')?.offsetParent),
  fieldWrapperBox: (() => {
    const element = document.querySelector('form > div:first-of-type');
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  })()
}));

await page.screenshot({ path: screenshotPath, fullPage: true });
await browser.close();

console.log(JSON.stringify({ url, result, errors, screenshot: screenshotPath }, null, 2));

if (
  errors.length
  || result.formSectionCount !== 0
  || result.generatedClassCount !== 0
  || result.generatedIdCount !== 0
  || !result.hasAltchaWrapper
  || !result.firstFieldVisible
  || result.submitButtonText !== 'Submit request'
) {
  process.exitCode = 1;
}
