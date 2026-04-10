#!/usr/bin/env bash

export AWS_PROFILE="${AWS_PROFILE:-publicbase}"
export AWS_REGION="${AWS_REGION:-ca-central-1}"
export AWS_PAGER=""

set -euo pipefail

FORMS_CLOUDFRONT_DISTRIBUTION_ID="${FORMS_CLOUDFRONT_DISTRIBUTION_ID:-E2SF38GJEOV2S8}"

LATEST_INVALIDATION_ID="$(aws cloudfront list-invalidations \
  --distribution-id "$FORMS_CLOUDFRONT_DISTRIBUTION_ID" \
  --query 'InvalidationList.Items[0].Id' \
  --output text)"

if [[ -z "$LATEST_INVALIDATION_ID" || "$LATEST_INVALIDATION_ID" == "None" ]]; then
  echo "No CloudFront invalidations found for distribution $FORMS_CLOUDFRONT_DISTRIBUTION_ID."
  exit 0
fi

aws cloudfront get-invalidation \
  --distribution-id "$FORMS_CLOUDFRONT_DISTRIBUTION_ID" \
  --id "$LATEST_INVALIDATION_ID" \
  --query 'Invalidation.{Id:Id,Status:Status,CreateTime:CreateTime,Paths:InvalidationBatch.Paths.Items}' \
  --output table
