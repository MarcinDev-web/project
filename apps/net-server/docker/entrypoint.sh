#!/bin/sh

# Fail fast
set -e

if [ "$NODE_ENV" = "production" ]; then
  # Require strong JWT secrets in production
  if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change-me-in-production" ] || [ "$JWT_SECRET" = "a683e811f626f81c3488a543a49fe2181d9dfc28754a0b31221d199369b4b0e6" ]; then
    echo "ERROR: JWT_SECRET is not set or uses a default value in production."
    echo "Set a strong, 32+ character secret via environment variable."
    echo "Current value: ${JWT_SECRET:-<not set>}"
    exit 1
  fi

  # Check minimum length
  if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "ERROR: JWT_SECRET must be at least 32 characters long."
    echo "Current length: ${#JWT_SECRET}"
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

# Run database migrations in production
if [ "$NODE_ENV" = "production" ] && [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  cd /app/apps/net-server
  if command -v prisma >/dev/null 2>&1; then
    prisma migrate deploy --schema=./prisma/schema.prisma || {
      echo "WARN: Migration failed or prisma not available, continuing..."
    }
  else
    echo "WARN: Prisma CLI not available, skipping migrations"
    echo "INFO: Make sure migrations are run manually or via CI/CD"
  fi
fi

# Exec the actual server command (from CMD)
exec "$@"


