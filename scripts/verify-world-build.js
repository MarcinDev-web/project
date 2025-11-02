/**
 * Build script for @engine/world package
 * 
 * TypeScript composite build with exclude pattern doesn't compile files that match
 * the exclude pattern (even if they're in src/). This script:
 * 1. Copies any compiled files from src/ to dist/ if needed
 * 2. Verifies that all required files exist in dist/
 * 
 * NOTE: The ideal solution would be to remove .js, .d.ts, .map files from src/,
 * but they may exist for compatibility. This script ensures build works regardless.
 */

import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const worldRoot = join(__dirname, '../packages/world');

/**
 * Copy compiled files from src/ to dist/ if they exist in src/ but not in dist/
 */
function copyMissingFiles(srcDir, distDir) {
  if (!existsSync(srcDir)) return;

  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  const files = readdirSync(srcDir);
  
  for (const file of files) {
    const srcPath = join(srcDir, file);
    const distPath = join(distDir, file);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      // Skip node_modules, __tests__, etc.
      if (file === 'node_modules' || file === '__tests__' || file === 'dist') {
        continue;
      }
      // Recursively copy subdirectories
      copyMissingFiles(srcPath, distPath);
    } else if (stat.isFile() && /\.(js|d\.ts|map)$/.test(file)) {
      // Only copy if file doesn't exist in dist/ or src/ is newer
      if (!existsSync(distPath) || statSync(srcPath).mtimeMs > statSync(distPath).mtimeMs) {
        copyFileSync(srcPath, distPath);
      }
    }
  }
}

/**
 * Verify that required files exist in dist/
 */
function verifyBuild() {
  const requiredFiles = [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/core/Entity.js',
    'dist/core/Entity.d.ts',
    'dist/core/Scene.js',
    'dist/core/Scene.d.ts',
    'dist/core/Transform.js',
    'dist/core/Transform.d.ts',
    'dist/components/Component.js',
    'dist/components/Component.d.ts',
    'dist/components/index.js',
    'dist/components/index.d.ts',
  ];

  const missing = [];
  for (const file of requiredFiles) {
    const fullPath = join(worldRoot, file);
    if (!existsSync(fullPath)) {
      missing.push(file);
    }
  }

  // Always copy files from src/ to dist/ if they exist (fallback for TypeScript composite build)
  // This ensures build works even if TypeScript doesn't compile files that already exist in src/
  const dirs = ['.', 'core', 'components', 'physics', 'systems', 'utils'];
  for (const dir of dirs) {
    const srcDir = dir === '.' ? join(worldRoot, 'src') : join(worldRoot, 'src', dir);
    const distDir = dir === '.' ? join(worldRoot, 'dist') : join(worldRoot, 'dist', dir);
    copyMissingFiles(srcDir, distDir);
  }

  if (missing.length > 0) {
    // Re-check after copy
    const stillMissing = [];
    for (const file of requiredFiles) {
      const fullPath = join(worldRoot, file);
      if (!existsSync(fullPath)) {
        stillMissing.push(file);
      }
    }

    if (stillMissing.length > 0) {
      console.error('❌ Build verification failed. Missing files:');
      stillMissing.forEach(f => console.error(`   - ${f}`));
      process.exit(1);
    } else {
      console.log('✓ Missing files copied from src/ to dist/');
    }
  }

  // Verify that subdirectories have files
  const requiredDirs = ['core', 'components', 'physics', 'systems'];
  for (const dir of requiredDirs) {
    const distDir = join(worldRoot, 'dist', dir);
    if (existsSync(distDir)) {
      const files = readdirSync(distDir).filter(f => 
        extname(f) === '.js' || extname(f) === '.d.ts'
      );
      if (files.length === 0) {
        console.warn(`⚠️  Warning: ${dir}/ directory exists but has no compiled files`);
      }
    }
  }

  console.log('✓ Build verification passed - all required files in dist/');
}

verifyBuild();

