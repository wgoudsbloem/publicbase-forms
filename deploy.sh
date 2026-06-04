#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$ROOT_DIR/lambda"
UI_PUBLIC_DIR="$ROOT_DIR/ui/public"
PUBLICBASE_ENV="${PUBLICBASE_ENV:-prod}"
ENV_FILE="$ROOT_DIR/deploy/env/${PUBLICBASE_ENV}.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

export AWS_PROFILE="${AWS_PROFILE:-publicbase}"
export AWS_REGION="${AWS_REGION:-ca-central-1}"
export AWS_PAGER=""
export AWS_CLI_AUTO_PROMPT=off

STACK_NAME="${STACK_NAME:-lambda-forms}"
PUBLISH_BUCKET="${PUBLISH_BUCKET:?PUBLISH_BUCKET is required}"
PUBLIC_HTTP_API_ID="${PUBLIC_HTTP_API_ID:?PUBLIC_HTTP_API_ID is required}"
DB_HOST="${DB_HOST:?DB_HOST is required}"
DB_SECURITY_GROUP_ID="${DB_SECURITY_GROUP_ID:?DB_SECURITY_GROUP_ID is required}"
ADMIN_LAMBDA_SECURITY_GROUP_ID="${ADMIN_LAMBDA_SECURITY_GROUP_ID:-$DB_SECURITY_GROUP_ID}"
RESOURCE_SUFFIX="${RESOURCE_SUFFIX:-}"
DB_SECRET_NAME="${DB_SECRET_NAME:-admin-db-credentials}"
FORM_CODES_TABLE_NAME="${FORM_CODES_TABLE_NAME:-form_codes}"
FORM_UPLOAD_BUCKET="${FORM_UPLOAD_BUCKET:-publicbase-files}"
ALTCHA_HMAC_SECRET_NAME="${ALTCHA_HMAC_SECRET_NAME:-forms-altcha-hmac-key}"
FORM_UPLOAD_TOKEN_SECRET_NAME="${FORM_UPLOAD_TOKEN_SECRET_NAME:-forms-upload-token-key}"
SUBMISSION_EMAIL_TOPIC_NAME="${SUBMISSION_EMAIL_TOPIC_NAME:-admin-submission-email}"
FORM_API_ORIGIN="${FORM_API_ORIGIN:-https://${FORMS_API_DOMAIN:-api.publicbase.com}}"

for asset in base.css base.js altcha.min.js; do
  if [[ ! -f "$UI_PUBLIC_DIR/$asset" ]]; then
    echo "Required asset missing: $UI_PUBLIC_DIR/$asset" >&2
    exit 1
  fi
done

echo "Deploying SAM stack (${STACK_NAME}) for ${PUBLICBASE_ENV}..."
(
  cd "$LAMBDA_DIR"
  sam build
  sam deploy \
    --stack-name "$STACK_NAME" \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --parameter-overrides \
      "PublicHttpApiId=${PUBLIC_HTTP_API_ID}" \
      "DbHost=${DB_HOST}" \
      "DbSecurityGroupId=${DB_SECURITY_GROUP_ID}" \
      "AdminLambdaSecurityGroupId=${ADMIN_LAMBDA_SECURITY_GROUP_ID}" \
      "ResourceSuffix=${RESOURCE_SUFFIX}" \
      "DbSecretName=${DB_SECRET_NAME}" \
      "FormCodesTableName=${FORM_CODES_TABLE_NAME}" \
      "FormUploadBucket=${FORM_UPLOAD_BUCKET}" \
      "AltchaHmacSecretName=${ALTCHA_HMAC_SECRET_NAME}" \
      "FormUploadTokenSecretName=${FORM_UPLOAD_TOKEN_SECRET_NAME}" \
      "SubmissionEmailTopicName=${SUBMISSION_EMAIL_TOPIC_NAME}" \
    --tags \
      "Application=PublicBase" \
      "Component=Forms" \
      "Environment=${PUBLICBASE_ENV}"
)

echo "Uploading shared public assets to s3://${PUBLISH_BUCKET}..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cp "$UI_PUBLIC_DIR/base.css" "$TMP_DIR/base.css"
cp "$UI_PUBLIC_DIR/base.js" "$TMP_DIR/base.js"
cp "$UI_PUBLIC_DIR/altcha.min.js" "$TMP_DIR/altcha.min.js"
if [[ "$FORM_API_ORIGIN" != "https://api.publicbase.com" ]]; then
  perl -0pi -e "s|https://api\\.publicbase\\.com|$FORM_API_ORIGIN|g" "$TMP_DIR/base.js"
fi

aws s3 cp "$TMP_DIR/base.css" "s3://$PUBLISH_BUCKET/base.css" \
  --content-type 'text/css; charset=utf-8' \
  --cache-control 'public, max-age=300'
aws s3 cp "$TMP_DIR/base.js" "s3://$PUBLISH_BUCKET/base.js" \
  --content-type 'application/javascript; charset=utf-8' \
  --cache-control 'public, max-age=300'
aws s3 cp "$TMP_DIR/altcha.min.js" "s3://$PUBLISH_BUCKET/altcha.min.js" \
  --content-type 'application/javascript; charset=utf-8' \
  --cache-control 'public, max-age=300'

if [[ -n "${FORMS_CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  echo "Invalidating CloudFront shared assets..."
  aws cloudfront create-invalidation \
    --distribution-id "$FORMS_CLOUDFRONT_DISTRIBUTION_ID" \
    --paths '/base.css' '/base.js' '/altcha.min.js'
else
  echo "Skipping CloudFront invalidation; FORMS_CLOUDFRONT_DISTRIBUTION_ID is empty."
fi

echo "Done."
