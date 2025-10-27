#!/usr/bin/env node
/**
 * Headless Smoke Test
 * 
 * Verifies that @engine/world can run without WebGPU/DOM.
 * This is critical for:
 * - Server-side multiplayer
 * - Headless testing
 * - CI without GPU
 * - Physics simulation on server
 * 
 * Usage:
 *   node scripts/headless-smoke-test.js
 * 
 * Note: This script runs @engine/world unit tests which are already
 * designed to work without WebGPU/DOM. If tests pass, headless mode works.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Headless Smoke Test: @engine/world\n');
console.log('Running unit tests without GPU/DOM...\n');

const testProcess = spawn('pnpm', ['--filter', '@engine/world', 'test'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Headless test PASSED!');
    console.log('   @engine/world works without GPU/DOM.');
    console.log('   Ready for server-side multiplayer.\n');
    process.exit(0);
  } else {
    console.error('\n❌ Headless test FAILED!');
    console.error(`   Exit code: ${code}\n`);
    process.exit(1);
  }
});

