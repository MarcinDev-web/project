/**
 * Migration script to migrate forum data from JSON to PostgreSQL
 */

import { getPrismaClient, ensureSchema, disconnectPrisma } from '../lib/db.js';
import { ForumStorage } from '../storage/ForumStorage.js';
import { ForumStorageDB } from '../storage/ForumStorageDB.js';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CATEGORIES_FILE = path.join(DATA_DIR, 'forum_categories.json');
const THREADS_FILE = path.join(DATA_DIR, 'forum_threads.json');
const POSTS_FILE = path.join(DATA_DIR, 'forum_posts.json');
const THREAD_VOTES_FILE = path.join(DATA_DIR, 'forum_thread_votes.json');
const POST_VOTES_FILE = path.join(DATA_DIR, 'forum_post_votes.json');

async function migrateForum(): Promise<void> {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL to your PostgreSQL connection string');
    process.exit(1);
  }

  // Check if JSON files exist
  const filesExist = await Promise.all([
    fs.access(CATEGORIES_FILE).then(() => true).catch(() => false),
    fs.access(THREADS_FILE).then(() => true).catch(() => false),
    fs.access(POSTS_FILE).then(() => true).catch(() => false),
  ]);

  if (!filesExist.some((exists) => exists)) {
    console.log('No forum JSON files found. Nothing to migrate.');
    process.exit(0);
  }

  console.log('Starting forum migration...');
  console.log(`Source directory: ${DATA_DIR}`);
  console.log(`Database: ${process.env.DATABASE_URL.split('@')[1] || 'connected'}`);

  // Initialize database
  const prisma = await getPrismaClient();
  try {
    await ensureSchema();
    console.log('✓ Database schema ensured');
  } catch (error) {
    console.error('Failed to ensure database schema:', error);
    process.exit(1);
  }

  // Load JSON data
  let jsonStorage: ForumStorage;
  let categories: Awaited<ReturnType<ForumStorage['getCategories']>>;
  let threads: Awaited<ReturnType<ForumStorage['getAllThreads']>>;
  let posts: Awaited<ReturnType<ForumStorage['getAllPosts']>>;

  try {
    jsonStorage = new ForumStorage(DATA_DIR);
    await jsonStorage.initialize();
    categories = await jsonStorage.getCategories();
    threads = await jsonStorage.getAllThreads({ limit: 100000 });
    posts = await jsonStorage.getAllPosts({ limit: 100000 });
    console.log(`✓ Loaded data from JSON files`);
    console.log(`  Categories: ${categories.length}`);
    console.log(`  Threads: ${threads.total}`);
    console.log(`  Posts: ${posts.total}`);
  } catch (error) {
    console.error('Failed to load JSON data:', error);
    process.exit(1);
  }

  if (categories.length === 0 && threads.total === 0 && posts.total === 0) {
    console.log('No forum data to migrate.');
    await disconnectPrisma();
    process.exit(0);
  }

  // Backup JSON files
  const timestamp = Date.now();
  const backups = [];
  try {
    for (const file of [CATEGORIES_FILE, THREADS_FILE, POSTS_FILE, THREAD_VOTES_FILE, POST_VOTES_FILE]) {
      try {
        await fs.access(file);
        const backupFile = `${file}.backup.${timestamp}`;
        await fs.copyFile(file, backupFile);
        backups.push(backupFile);
      } catch {
        // File doesn't exist, skip backup
      }
    }
    if (backups.length > 0) {
      console.log(`✓ Backups created: ${backups.length} files`);
    }
  } catch (error) {
    console.error('Failed to create backups:', error);
    process.exit(1);
  }

  // Migrate to database
  const dbStorage = new ForumStorageDB(prisma);
  await dbStorage.initialize();

  let migratedCategories = 0;
  let skippedCategories = 0;
  let migratedThreads = 0;
  let skippedThreads = 0;
  let migratedPosts = 0;
  let skippedPosts = 0;
  let migratedReactions = 0;
  let migratedVotes = 0;
  let errors = 0;

  // Migrate categories
  console.log('\nMigrating categories...');
  for (const category of categories) {
    try {
      const existing = await dbStorage.getCategory(category.id);
      if (existing) {
        skippedCategories++;
        continue;
      }

      await dbStorage.createCategory({
        id: category.id,
        name: category.name,
        description: category.description,
        ...(category.icon !== undefined && { icon: category.icon }),
        ...(category.color !== undefined && { color: category.color }),
        order: category.order,
        isLocked: category.isLocked,
      });

      migratedCategories++;
    } catch (error) {
      console.error(`  ✗ Error migrating category ${category.id}:`, error);
      errors++;
    }
  }

  // Migrate threads
  console.log('\nMigrating threads...');
  for (const thread of threads.threads) {
    try {
      const existing = await dbStorage.getThread(thread.id);
      if (existing) {
        skippedThreads++;
        continue;
      }

      // Create thread directly with Prisma to preserve ID
      const createdThread = await prisma.forumThread.create({
        data: {
          id: thread.id,
          categoryId: thread.categoryId,
          authorId: thread.authorId,
          title: thread.title,
          content: thread.content,
          isPinned: thread.isPinned,
          isLocked: thread.isLocked,
          tags: thread.tags || [],
          marketplaceItemId: thread.marketplaceItemId ?? null,
          projectToken: thread.projectToken ?? null,
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt),
        },
      });

      // Create first post (thread content)
      const firstPost = await jsonStorage.getPosts(thread.id, 'new');
      if (firstPost.length > 0) {
        const originalFirstPost = firstPost[0]!; // Non-null assertion: length check guarantees existence
        await prisma.forumPost.create({
          data: {
            id: originalFirstPost.id,
            threadId: createdThread.id,
            authorId: originalFirstPost.authorId,
            content: originalFirstPost.content,
            mentions: originalFirstPost.mentions || [],
            createdAt: new Date(originalFirstPost.createdAt),
            editedAt: originalFirstPost.editedAt ? new Date(originalFirstPost.editedAt) : null,
          },
        });
      } else {
        // Create first post if it doesn't exist
        await prisma.forumPost.create({
          data: {
            id: `post_${thread.createdAt}_${Math.random().toString(36).substring(7)}`,
            threadId: createdThread.id,
            authorId: thread.authorId,
            content: thread.content,
            mentions: [],
            createdAt: new Date(thread.createdAt),
          },
        });
      }

      // Migrate reactions
      for (const reaction of thread.reactions) {
        try {
          await dbStorage.addReaction(thread.id, null, reaction.emoji, reaction.userId);
          migratedReactions++;
        } catch (error) {
          console.error(`  ✗ Error migrating reaction for thread ${thread.id}:`, error);
        }
      }

      // Migrate votes
      const threadVotesData = await fs.readFile(THREAD_VOTES_FILE, 'utf-8').catch(() => '[]');
      const threadVotes: Array<{ threadId: string; userId: string; vote: 'up' | 'down'; createdAt: number }> = JSON.parse(threadVotesData);
      const threadVotesForThread = threadVotes.filter((v) => v.threadId === thread.id);
      for (const vote of threadVotesForThread) {
        try {
          await dbStorage.voteThread(thread.id, vote.userId, vote.vote);
          migratedVotes++;
        } catch (error) {
          console.error(`  ✗ Error migrating vote for thread ${thread.id}:`, error);
        }
      }

      migratedThreads++;
      if (migratedThreads % 10 === 0) {
        console.log(`  → Migrated ${migratedThreads} threads...`);
      }
    } catch (error) {
      console.error(`  ✗ Error migrating thread ${thread.id}:`, error);
      errors++;
    }
  }

  // Migrate posts (excluding first post which is already created with thread)
  console.log('\nMigrating posts...');
  const firstPostIds = new Set<string>();
  for (const thread of threads.threads) {
    // Get first post for each thread (it's the thread content)
    const firstPost = await jsonStorage.getPosts(thread.id, 'new');
    if (firstPost.length > 0) {
      const firstPostItem = firstPost[0]!; // Non-null assertion: length check guarantees existence
      firstPostIds.add(firstPostItem.id);
    }
  }

  for (const post of posts.posts) {
    try {
      // Skip first post (already created with thread)
      if (firstPostIds.has(post.id)) {
        skippedPosts++;
        continue;
      }

      const existing = await dbStorage.getPost(post.id);
      if (existing) {
        skippedPosts++;
        continue;
      }

      // Create post directly with Prisma to preserve ID
      await prisma.forumPost.create({
        data: {
          id: post.id,
          threadId: post.threadId,
          authorId: post.authorId,
          content: post.content,
          mentions: post.mentions || [],
          createdAt: new Date(post.createdAt),
          editedAt: post.editedAt ? new Date(post.editedAt) : null,
        },
      });

      // Migrate reactions
      for (const reaction of post.reactions) {
        try {
          await dbStorage.addReaction(null, post.id, reaction.emoji, reaction.userId);
          migratedReactions++;
        } catch (error) {
          console.error(`  ✗ Error migrating reaction for post ${post.id}:`, error);
        }
      }

      // Migrate votes
      const postVotesData = await fs.readFile(POST_VOTES_FILE, 'utf-8').catch(() => '[]');
      const postVotes: Array<{ postId: string; userId: string; vote: 'up' | 'down'; createdAt: number }> = JSON.parse(postVotesData);
      const postVotesForPost = postVotes.filter((v) => v.postId === post.id);
      for (const vote of postVotesForPost) {
        try {
          await dbStorage.votePost(post.id, vote.userId, vote.vote);
          migratedVotes++;
        } catch (error) {
          console.error(`  ✗ Error migrating vote for post ${post.id}:`, error);
        }
      }

      migratedPosts++;
      if (migratedPosts % 50 === 0) {
        console.log(`  → Migrated ${migratedPosts} posts...`);
      }
    } catch (error) {
      console.error(`  ✗ Error migrating post ${post.id}:`, error);
      errors++;
    }
  }

  // Verify migration
  console.log('\nVerifying migration...');
  const dbCategories = await dbStorage.getCategories();
  const dbThreads = await dbStorage.getAllThreads({ limit: 100000 });
  const dbPosts = await dbStorage.getAllPosts({ limit: 100000 });

  console.log(`\nMigration complete!`);
  console.log(`Categories:`);
  console.log(`  ✓ Migrated: ${migratedCategories}`);
  console.log(`  ⏭  Skipped: ${skippedCategories}`);
  console.log(`Threads:`);
  console.log(`  ✓ Migrated: ${migratedThreads}`);
  console.log(`  ⏭  Skipped: ${skippedThreads}`);
  console.log(`Posts:`);
  console.log(`  ✓ Migrated: ${migratedPosts}`);
  console.log(`  ⏭  Skipped: ${skippedPosts}`);
  console.log(`Reactions:`);
  console.log(`  ✓ Migrated: ${migratedReactions}`);
  console.log(`Votes:`);
  console.log(`  ✓ Migrated: ${migratedVotes}`);
  console.log(`  ✗ Errors: ${errors}`);
  console.log(`\nDatabase totals:`);
  console.log(`  📊 Categories: ${dbCategories.length}`);
  console.log(`  📊 Threads: ${dbThreads.total}`);
  console.log(`  📊 Posts: ${dbPosts.total}`);

  if (backups.length > 0) {
    console.log(`\nBackups saved:`);
    backups.forEach((backup) => console.log(`  ${backup}`));
  }

  // Close database connection
  await disconnectPrisma();
}

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  void migrateForum()
    .then(() => {
      console.log('\n✓ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    });
}

