PublicBase forms runtime.

This repository owns the public form API lambdas and the shared browser assets loaded by published forms.

Production pieces:

- `lambda/` deploys the forms SAM stack, currently `lambda-forms`.
- `web/local_web/base.css` is served as `https://forms.publicbase.com/base.css`.
- `web/local_web/base.js` is served as `https://forms.publicbase.com/base.js`.
- `web/local_web/altcha.min.js` is served as `https://forms.publicbase.com/altcha.min.js`.

Deploy production:

```bash
PUBLICBASE_ENV=prod ./deploy.sh
```

The deploy script loads `deploy/env/prod.env`, deploys the SAM stack with Forms tags, uploads the three shared assets, and invalidates those CloudFront paths.
