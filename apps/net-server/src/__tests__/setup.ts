/**
 * Test setup infrastructure for API integration tests
 */

import { afterEach, beforeEach } from 'vitest';
import type { Express } from 'express';
import { app } from '../server';
import { createDbPool, ensureSchema } from '../lib/db';
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

let testDbPool: Pool | null = null;
let testDataDir: string | null = null;

/**
 * Setup test environment before each test
 */
export async function setupTestEnvironment(): Promise<{
  app: Express;
  dbPool: Pool | null;
  dataDir: string;
}> {
  // Create temporary data directory for JSON storage tests
  testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));

  // Setup database if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    try {
      testDbPool = createDbPool();
      await ensureSchema(testDbPool);
    } catch (error) {
      console.warn('Failed to setup test database:', error);
      testDbPool = null;
    }
  }

  return {
    app,
    dbPool: testDbPool,
    dataDir: testDataDir,
  };
}

/**
 * Cleanup test environment after each test
 */
export async function cleanupTestEnvironment(): Promise<void> {
  // Cleanup database if used
  if (testDbPool) {
    try {
      // Cleanup test data from database
      const client = await testDbPool.connect();
      try {
        await client.query('DELETE FROM marketplace_builds');
        await client.query('DELETE FROM marketplace_items');
        await client.query('DELETE FROM users');
        // Reset sequences if any
        await client.query('TRUNCATE TABLE marketplace_items RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      } finally {
        client.release();
      }
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }
  }

  // Cleanup temporary data directory
  if (testDataDir) {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test data directory:', error);
    }
    testDataDir = null;
  }
}

/**
 * Global test setup hook
 */
beforeEach(async () => {
  await setupTestEnvironment();
});

/**
 * Global test cleanup hook
 */
afterEach(async () => {
  await cleanupTestEnvironment();
});

