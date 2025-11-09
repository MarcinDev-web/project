#!/bin/sh

# Fail fast
set -e

if [ "$NODE_ENV" = "production" ]; then
  # Require strong JWT secrets in production
  if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change-me-in-production" ]; then
    echo "ERROR: JWT_SECRET is not set or uses a default value in production."
    echo "Set a strong, 32+ character secret via environment variable."
    exit 1
  fi

  # Encourage explicit refresh secret, but allow fallback in app if omitted
  if [ -z "$JWT_REFRESH_SECRET" ]; then
    echo "WARN: JWT_REFRESH_SECRET is not set. Falling back to JWT_SECRET+'-refresh'."
  fi
fi

# Optional: surface rate limit config
if [ -n "$AUTH_RATE_LIMIT_MAX" ]; then
  echo "INFO: AUTH_RATE_LIMIT_MAX=$AUTH_RATE_LIMIT_MAX"
fi

# Exec the actual server command (from CMD)
exec "$@"


