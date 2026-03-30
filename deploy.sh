#!/usr/bin/env bash

export AWS_PROFILE=publicbase
export AWS_REGION=ca-central-1

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$ROOT_DIR/lambda"

echo "Deploying SAM stack (lambda-admin)..."
(
  cd "$LAMBDA_DIR"
  sam build
  sam deploy --no-confirm-changeset
)

echo "Done."
