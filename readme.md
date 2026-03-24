export AWS_PROFILE=publicbase
export AWS_REGION=ca-central-1
sam build && sam deploy --no-confirm-changeset
