#!/usr/bin/env bash

export AWS_PROFILE=publicbase
export AWS_REGION=ca-central-1
export AWS_PAGER=""

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$ROOT_DIR/lambda"
WEB_DIR="$ROOT_DIR/web/local_web"
PUBLISH_BUCKET="${PUBLISH_BUCKET:-forms.publicbase.com}"
FORMS_CLOUDFRONT_DISTRIBUTION_ID="${FORMS_CLOUDFRONT_DISTRIBUTION_ID:-E2SF38GJEOV2S8}"

echo "Deploying SAM stack (lambda-forms)..."
(
  cd "$LAMBDA_DIR"
  sam build
  sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
)

echo "Uploading shared public assets..."
aws s3 cp "$WEB_DIR/base.css" "s3://$PUBLISH_BUCKET/base.css" \
  --content-type 'text/css; charset=utf-8' \
  --cache-control 'public, max-age=300'
aws s3 cp "$WEB_DIR/base.js" "s3://$PUBLISH_BUCKET/base.js" \
  --content-type 'application/javascript; charset=utf-8' \
  --cache-control 'public, max-age=300'
aws s3 cp "$WEB_DIR/altcha.min.js" "s3://$PUBLISH_BUCKET/altcha.min.js" \
  --content-type 'application/javascript; charset=utf-8' \
  --cache-control 'public, max-age=300'

echo "Invalidating CloudFront shared assets..."
aws cloudfront create-invalidation \
  --distribution-id "$FORMS_CLOUDFRONT_DISTRIBUTION_ID" \
  --paths '/base.css' '/base.js' '/altcha.min.js'

echo "Done."
