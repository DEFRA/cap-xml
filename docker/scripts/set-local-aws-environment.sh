#!/bin/sh
# Sourced (not executed) by scripts that call the AWS CLI, so that every call is
# guaranteed to target the local Floci emulator rather than a real AWS account.

AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localhost:4566}"

# Fail fast rather than provision resources in a real AWS account.
case "$AWS_ENDPOINT_URL" in
  http://localhost:* | http://127.0.0.1:* | http://floci:* | http://floci-main:*) ;;
  *)
    echo "Refusing to run: AWS_ENDPOINT_URL is '$AWS_ENDPOINT_URL', which is not a local Floci endpoint." >&2
    echo "Unset it, or set it to the local Floci endpoint (http://localhost:4566), before retrying." >&2
    exit 1
    ;;
esac

# Dummy values so the CLI can never fall back to a real profile or region.
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-eu-west-2}"
AWS_PROFILE=""

export AWS_ENDPOINT_URL AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION
unset AWS_PROFILE
