/**
 * Build script for @engine/world package
 * 
 * This script ensures that all compiled files end up in dist/ correctly.
 * Since TypeScript composite build excludes already-compiled files from src/,
 * we verify that dist/ contains all required files after compilation.
 */

import { readdirSync, statSync, existsSync, rmSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const worldRoot = join(__dirname, '../packages/world');

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

  if (missing.length > 0) {
    console.error('❌ Build verification failed. Missing files:');
    missing.forEach(f => console.error(`   - ${f}`));
    process.exit(1);
  }

  // Verify that subdirectories have files
  const requiredDirs = ['core', 'components', 'physics', 'systems', 'utils'];
  for (const dir of requiredDirs) {
    const distDir = join(worldRoot, 'dist', dir);
    if (existsSync(distDir)) {
      const files = readdirSync(distDir).filter(f => 
        extname(f) === '.js' || extname(f) === '.d.ts'
      );
      if (files.length === 0 && dir !== 'utils') {
        console.warn(`⚠️  Warning: ${dir}/ directory exists but has no compiled files`);
      }
    }
  }

  console.log('✓ Build verification passed - all required files in dist/');
}

verifyBuild();

