-- Create token_blacklist table and index (Prisma model: TokenBlacklist)
CREATE TABLE IF NOT EXISTS "public"."token_blacklist" (
  "jti" text PRIMARY KEY,
  "expires_at" bigint NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Index to allow efficient cleanup/queries by expiry
CREATE INDEX IF NOT EXISTS "token_blacklist_expires_at_idx"
  ON "public"."token_blacklist" ("expires_at");


