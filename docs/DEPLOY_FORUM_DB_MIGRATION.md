# Forum Database Migration Guide

This guide explains how to migrate forum data from JSON file storage to PostgreSQL database.

## Overview

The forum system supports two storage backends:
- **JSON Storage** (default): Stores data in JSON files in the `data/` directory
- **PostgreSQL Storage**: Stores data in PostgreSQL database using Prisma ORM

When `DATABASE_URL` is set, the server automatically uses PostgreSQL storage. Otherwise, it falls back to JSON storage.

## Prerequisites

1. PostgreSQL database running and accessible
2. `DATABASE_URL` environment variable set
3. Prisma schema migrated (run `pnpm prisma migrate dev` or `pnpm prisma db push`)

## Migration Steps

### 1. Ensure Database Schema is Up to Date

```bash
cd apps/net-server
pnpm prisma migrate dev
# or
pnpm prisma db push
```

This will create the forum tables:
- `forum_categories`
- `forum_threads`
- `forum_posts`
- `forum_thread_reactions`
- `forum_post_reactions`
- `forum_thread_votes`
- `forum_post_votes`

### 2. Run Migration Script

```bash
cd apps/net-server
pnpm tsx src/scripts/migrateForumToDB.ts
```

The script will:
1. Check if JSON files exist
2. Create backups of all JSON files (with timestamp)
3. Load data from JSON files
4. Migrate categories, threads, posts, reactions, and votes to PostgreSQL
5. Verify migration by comparing counts

### 3. Verify Migration

After migration, verify the data:

```bash
# Check database directly
pnpm prisma studio

# Or check via API
curl http://localhost:3000/api/forum/categories
```

### 4. Update Server Configuration

Ensure `DATABASE_URL` is set in your environment:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

The server will automatically use PostgreSQL storage when `DATABASE_URL` is set.

## Rollback

If you need to rollback:

1. Stop the server
2. Remove or unset `DATABASE_URL` environment variable
3. Restore JSON files from backups (created during migration)
4. Restart the server

Backup files are created with pattern: `*.backup.<timestamp>`

## Data Structure

### Categories
- Stored in `forum_categories` table
- Default categories are created automatically if none exist

### Threads
- Stored in `forum_threads` table
- First post content is stored in `thread.content` field
- A separate post record is also created for the first post

### Posts
- Stored in `forum_posts` table
- Linked to threads via `thread_id` foreign key

### Reactions
- Thread reactions: `forum_thread_reactions` table
- Post reactions: `forum_post_reactions` table
- Composite primary key: `(thread_id/post_id, emoji, user_id)`

### Votes
- Thread votes: `forum_thread_votes` table
- Post votes: `forum_post_votes` table
- Composite primary key: `(thread_id/post_id, user_id)`

## Performance Considerations

PostgreSQL storage provides:
- Better performance for large datasets
- ACID transactions
- Better query performance with indexes
- Scalability for concurrent access

JSON storage is suitable for:
- Development/testing
- Small datasets
- Single-server deployments

## Troubleshooting

### Migration fails with "Category already exists"
- Categories are created automatically on initialization
- The migration script skips existing categories
- This is normal behavior

### Thread count mismatch
- The first post is counted separately in JSON storage
- In PostgreSQL, it's included in the post count
- This is expected behavior

### Missing reactions or votes
- Check backup files to verify original data
- Re-run migration if needed (it will skip existing data)

## Notes

- The migration script is idempotent - safe to run multiple times
- Existing data in database is preserved (skipped during migration)
- JSON files are backed up before migration
- Timestamps are preserved during migration

