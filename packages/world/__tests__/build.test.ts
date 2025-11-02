/**
 * Integration tests for @engine/world build process
 * 
 * These tests verify that:
 * - All required files are compiled to dist/
 * - Package exports work correctly
 * - No manual file copying is needed
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const worldRoot = join(__dirname, '..');

describe('Build Integration Tests', () => {
  describe('dist/ structure', () => {
    it('should have index files in dist/', () => {
      expect(existsSync(join(worldRoot, 'dist/index.js'))).toBe(true);
      expect(existsSync(join(worldRoot, 'dist/index.d.ts'))).toBe(true);
    });

    it('should have core classes compiled to dist/core/', () => {
      const coreDir = join(worldRoot, 'dist/core');
      expect(existsSync(coreDir)).toBe(true);
      
      const requiredFiles = ['Entity.js', 'Entity.d.ts', 'Scene.js', 'Scene.d.ts', 'Transform.js', 'Transform.d.ts'];
      for (const file of requiredFiles) {
        const filePath = join(coreDir, file);
        expect(existsSync(filePath)).toBe(true);
      }
    });

    it('should have components compiled to dist/components/', () => {
      const componentsDir = join(worldRoot, 'dist/components');
      expect(existsSync(componentsDir)).toBe(true);
      
      const files = readdirSync(componentsDir).filter(f => f.endsWith('.js') || f.endsWith('.d.ts'));
      expect(files.length).toBeGreaterThan(0);
      
      // Verify key components exist
      expect(existsSync(join(componentsDir, 'Component.js'))).toBe(true);
      expect(existsSync(join(componentsDir, 'Component.d.ts'))).toBe(true);
      expect(existsSync(join(componentsDir, 'index.js'))).toBe(true);
      expect(existsSync(join(componentsDir, 'index.d.ts'))).toBe(true);
    });

    it('should have physics files compiled to dist/physics/', () => {
      const physicsDir = join(worldRoot, 'dist/physics');
      if (existsSync(physicsDir)) {
        const files = readdirSync(physicsDir).filter(f => f.endsWith('.js') || f.endsWith('.d.ts'));
        expect(files.length).toBeGreaterThan(0);
      }
    });

    it('should have systems files compiled to dist/systems/', () => {
      const systemsDir = join(worldRoot, 'dist/systems');
      if (existsSync(systemsDir)) {
        const files = readdirSync(systemsDir).filter(f => f.endsWith('.js') || f.endsWith('.d.ts'));
        expect(files.length).toBeGreaterThan(0);
      }
    });
  });

  describe('package exports', () => {
    it('should export Entity from main entry', async () => {
      const { Entity } = await import('@engine/world');
      expect(Entity).toBeDefined();
      expect(typeof Entity).toBe('function');
    });

    it('should export Scene from main entry', async () => {
      const { Scene } = await import('@engine/world');
      expect(Scene).toBeDefined();
      expect(typeof Scene).toBe('function');
    });

    it('should export Transform from main entry', async () => {
      const { Transform } = await import('@engine/world');
      expect(Transform).toBeDefined();
      expect(typeof Transform).toBe('function');
    });

    it('should export Component from main entry', async () => {
      const { Component } = await import('@engine/world');
      expect(Component).toBeDefined();
      expect(typeof Component).toBe('function');
    });

    it('should export from @engine/world/core subpath', async () => {
      const core = await import('@engine/world/core');
      expect(core.Entity).toBeDefined();
      expect(core.Scene).toBeDefined();
      expect(core.Transform).toBeDefined();
    });

    it('should export from @engine/world/components subpath', async () => {
      const components = await import('@engine/world/components');
      expect(components.Component).toBeDefined();
    });

    it('should export specific component from @engine/world/components/*', async () => {
      // Test with Component which always exists
      const { Component } = await import('@engine/world/components/Component');
      expect(Component).toBeDefined();
    });
  });

  describe('build artifacts', () => {
    it('should have valid compiled files with content', () => {
      const indexJs = join(worldRoot, 'dist/index.js');
      const indexDts = join(worldRoot, 'dist/index.d.ts');
      
      expect(existsSync(indexJs)).toBe(true);
      expect(existsSync(indexDts)).toBe(true);
      
      // Verify files have content (not empty)
      if (existsSync(indexJs)) {
        const fs = require('fs');
        const content = fs.readFileSync(indexJs, 'utf-8');
        expect(content.length).toBeGreaterThan(50);
      }
    });
  });

  describe('no manual copying needed', () => {
    it('should not require manual file copying - all files in dist/', () => {
      // This test verifies that TypeScript compilation puts files in dist/
      // and we don't need the old copy-world-build.js script
      const distIndexJs = join(worldRoot, 'dist/core/Entity.js');
      const distIndexDts = join(worldRoot, 'dist/core/Entity.d.ts');
      
      expect(existsSync(distIndexJs)).toBe(true);
      expect(existsSync(distIndexDts)).toBe(true);
      
      // Verify files are actually compiled (not just copied)
      if (existsSync(distIndexJs)) {
        const content = require('fs').readFileSync(distIndexJs, 'utf-8');
        // Compiled JS should have actual code, not just re-exports
        expect(content.length).toBeGreaterThan(100);
      }
    });
  });
});

