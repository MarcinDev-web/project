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
 * This script directly imports @engine/world and creates basic entities
 * to verify it works without GPU/DOM dependencies.
 */

import { World, Scene, Entity } from '@engine/world';

console.log('🚀 Headless Smoke Test: @engine/world\n');
console.log('Testing basic World/Scene/Entity creation without GPU/DOM...\n');

try {
  // Create World instance
  const world = new World();
  console.log('✅ World created');

  // Create Scene
  const scene = new Scene('Test');
  console.log('✅ Scene created');

  // Create Entity
  const entity = scene.createEntity('Cube');
  console.log('✅ Entity created');

  // Add scene to world
  world.addScene(scene);
  console.log('✅ Scene added to World');

  // Simulate one tick
  world.fixedUpdate(1 / 60);
  console.log('✅ World.fixedUpdate() executed');

  // Verify entity exists
  if (!entity) {
    throw new Error('Entity should exist');
  }

  console.log('\n✅ Headless test PASSED!');
  console.log('   @engine/world works without GPU/DOM.');
  console.log('   Ready for server-side multiplayer.\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Headless test FAILED!');
  console.error('   Error:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}

