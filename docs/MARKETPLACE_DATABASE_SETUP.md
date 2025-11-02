# Marketplace Database Setup Guide

## Overview

This guide explains how to set up PostgreSQL for the marketplace system and migrate existing JSON data.

## Prerequisites

- PostgreSQL 12+ installed and running
- Node.js 18+ with pnpm

## Setup Steps

### 1. Install Dependencies

```bash
cd apps/net-server
pnpm install
```

This installs `pg` and `@types/pg` packages required for PostgreSQL connectivity.

### 2. Create Database

```sql
CREATE DATABASE forge_db;
```

Or use a different database name if preferred.

### 3. Configure Environment

Create a `.env` file in `apps/net-server/` (or set environment variables):

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/forge_db
```

For local development:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/forge_db
```

### 4. Run Migration

If you have existing marketplace data in JSON format, migrate it to PostgreSQL:

```bash
pnpm migrate:marketplace
```

This script will:
- Create a backup of `data/marketplace.json`
- Migrate all items to PostgreSQL
- Verify data integrity
- Preserve timestamps and metadata

**Note:** The migration script is idempotent - it can be run multiple times safely. Items that already exist will be skipped.

### 5. Start Server

```bash
pnpm dev
```

The server will:
- Connect to PostgreSQL if `DATABASE_URL` is set
- Create database schema automatically
- Fall back to JSON storage if database is not available

## Database Schema

### marketplace_items

Stores marketplace items (builds and avatars):

- `id` (TEXT PRIMARY KEY) - Unique item identifier
- `type` (TEXT) - 'build' or 'avatar'
- `title` (TEXT) - Item title
- `description` (TEXT) - Optional description
- `author_id` (TEXT) - User ID of creator
- `author_name` (TEXT) - Display name of creator
- `thumbnail_url` (TEXT) - URL to thumbnail image
- `file_url` (TEXT) - URL to item file
- `tags` (TEXT[]) - Array of tags
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp
- `downloads` (INTEGER) - Download count
- `likes` (INTEGER) - Like count
- `public` (BOOLEAN) - Public visibility flag

**Indexes:**
- `idx_marketplace_type` - On `type` column
- `idx_marketplace_author` - On `author_id` column
- `idx_marketplace_created` - On `created_at DESC`
- `idx_marketplace_tags` - GIN index on `tags` array

### marketplace_builds

Stores actual build/scene data:

- `marketplace_id` (TEXT PRIMARY KEY) - References `marketplace_items.id`
- `project_data` (BYTEA) - Serialized ProjectData JSON
- `version` (INTEGER) - Build version (increments on update)
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Foreign Key:**
- `marketplace_id` → `marketplace_items.id` ON DELETE CASCADE

### game_sessions

Tracks active player sessions (optional):

- `game_id` (TEXT) - Marketplace item ID
- `user_id` (TEXT) - User ID
- `joined_at` (TIMESTAMP) - Join timestamp
- PRIMARY KEY (game_id, user_id)

## Fallback Mode

If `DATABASE_URL` is not set, the system automatically falls back to JSON file storage (`data/marketplace.json`). This allows development without database setup.

## Verification

After migration, verify data:

```sql
-- Check item count
SELECT COUNT(*) FROM marketplace_items;

-- Check builds with data
SELECT COUNT(*) FROM marketplace_builds;

-- Sample items
SELECT id, type, title, author_name FROM marketplace_items LIMIT 10;
```

## Troubleshooting

### Connection Errors

**Error:** `DATABASE_URL is required`
- **Solution:** Set `DATABASE_URL` environment variable

**Error:** `Connection refused`
- **Solution:** Verify PostgreSQL is running: `pg_isready`
- **Solution:** Check connection string format

### Migration Errors

**Error:** `relation "marketplace_items" already exists`
- **Solution:** This is normal - schema already created. Migration continues.

**Error:** `duplicate key value violates unique constraint`
- **Solution:** Item already migrated. Script skips duplicates automatically.

### Performance Issues

If queries are slow:

1. **Check indexes:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM marketplace_items WHERE type = 'build';
   ```

2. **Update statistics:**
   ```sql
   ANALYZE marketplace_items;
   ```

3. **Check connection pool:**
   - Default pool size: 10 connections
   - Adjust in `createDbPool()` if needed

## Development Workflow

### Without Database (JSON Mode)

```bash
# No DATABASE_URL needed
pnpm dev
```

Uses `data/marketplace.json` for storage.

### With Database

```bash
# Set DATABASE_URL
export DATABASE_URL=postgresql://user:password@localhost:5432/forge_db

# Start server (schema auto-created)
pnpm dev

# Or migrate existing data
pnpm migrate:marketplace
```

## Production Deployment

1. **Set DATABASE_URL** in production environment
2. **Run migrations** before starting server:
   ```bash
   pnpm migrate:marketplace
   ```
3. **Monitor** connection pool usage
4. **Backup** database regularly (PostgreSQL `pg_dump`)

## Rollback

To rollback to JSON storage:

1. Stop server
2. Remove/unset `DATABASE_URL`
3. Restore `data/marketplace.json` from backup
4. Restart server

Backups are created with timestamp: `marketplace.json.backup.{timestamp}`

---

**Last Updated:** 2025-10-26  
**Maintained by:** Development Team
