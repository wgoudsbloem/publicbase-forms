PublicBase forms runtime.

This repository owns the public form API lambdas and the shared browser assets loaded by published forms.

Production pieces:

- `lambda/` deploys the forms SAM stack, currently `lambda-forms`.
- `ui/public/base.css` is served as `https://forms.publicbase.com/base.css`.
- `ui/public/base.js` is served as `https://forms.publicbase.com/base.js`.
- `ui/public/altcha.min.js` is served as `https://forms.publicbase.com/altcha.min.js`.

Deploy production:

```bash
PUBLICBASE_ENV=prod ./deploy.sh
```

The deploy script loads `deploy/env/prod.env`, deploys the SAM stack with Forms tags, uploads the three shared assets, and invalidates those CloudFront paths.

Run local forms UI:

```bash
cd ui
npm run dev
```

The forms dev server rewrites `https://api.publicbase.com` in JavaScript responses to the dev forms API by default.

Override the dev API when needed:

```bash
FORM_API_ORIGIN=https://6khgp8699k.execute-api.ca-central-1.amazonaws.com npm run dev
```
