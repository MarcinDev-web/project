# Railway Migration Instructions

## Automatic Migration (Recommended)

Railway will automatically run migrations if you configure the start command:

1. Go to your Railway project settings
2. Set the **Start Command** to:
   ```bash
   cd apps/net-server && npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/server.js
   ```

Or add a `railway.toml` file in the root:

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "cd apps/net-server && npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/server.js"
```

## Manual Migration

If you prefer to run migrations manually:

1. Connect to Railway CLI: `railway link`
2. Run migration: `railway run --service net-server npx prisma migrate deploy --schema=apps/net-server/prisma/schema.prisma`

## Environment Variables

Make sure `DATABASE_URL` is set in Railway environment variables.

