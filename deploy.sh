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
    --tags \
      "Application=PublicBase" \
      "Component=Forms" \
      "Environment=${PUBLICBASE_ENV}"
)

echo "Uploading shared public assets to s3://${PUBLISH_BUCKET}..."
aws s3 cp "$UI_PUBLIC_DIR/base.css" "s3://$PUBLISH_BUCKET/base.css" \
  --content-type 'text/css; charset=utf-8' \
  --cache-control 'public, max-age=300'
aws s3 cp "$UI_PUBLIC_DIR/base.js" "s3://$PUBLISH_BUCKET/base.js" \
  --content-type 'application/javascript; charset=utf-8' \
  --cache-control 'public, max-age=300'
aws s3 cp "$UI_PUBLIC_DIR/altcha.min.js" "s3://$PUBLISH_BUCKET/altcha.min.js" \
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
