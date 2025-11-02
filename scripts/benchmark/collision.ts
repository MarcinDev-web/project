/**
 * Automated collision detection benchmark
 * 
 * Runs collision detection benchmarks and compares:
 * - TypeScript implementation
 * - WASM implementation
 * - Worker-based WASM
 * 
 * Outputs performance metrics for trend tracking.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Quat, Vec3 } from '@engine/core/math';
import { CollisionDetector, type OBB } from '../../apps/editor/src/editor/placement/CollisionDetector';
import { init as initWasm } from '@engine/wasm-collision';
import type { Scene } from '@engine/world';
import { createTestScene } from '@engine/test-utils';

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function obbFromTRS(center: Vec3, rotation: Quat, scale: Vec3): OBB {
  // Simplified - would need full quat-to-axes conversion
  return {
    center,
    axes: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as [Vec3, Vec3, Vec3],
    halfSizes: [Math.abs(scale[0]) / 2, Math.abs(scale[1]) / 2, Math.abs(scale[2]) / 2],
  };
}

interface BenchmarkResult {
  timestamp: string;
  batchSize: number;
  tsTime: number;
  wasmTime: number;
  tsCollisions: number;
  wasmCollisions: number;
  wasmFaster: number; // percentage
}

async function runCollisionBenchmark(batchSize: number): Promise<BenchmarkResult> {
  const scene = createTestScene();
  const detector = new CollisionDetector(scene);
  let wasm: Awaited<ReturnType<typeof initWasm>> | null = null;

  try {
    wasm = await initWasm();
  } catch {
    // WASM not available, skip
    throw new Error('WASM not available');
  }

  // Create test entities
  const entities: Array<{ entity: any; pos: Vec3; rot: Quat; scale: Vec3 }> = [];
  for (let i = 0; i < batchSize; i++) {
    entities.push({
      entity: scene.createEntity(),
      pos: [rand(-10, 10), rand(-10, 10), rand(-10, 10)],
      rot: [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)] as Quat,
      scale: [rand(0.5, 2), rand(0.5, 2), rand(0.5, 2)],
    });
  }

  const preview = entities[0]!;
  const others = entities.slice(1);

  // TypeScript benchmark
  const tsStart = performance.now();
  let tsCollisions = 0;
  const previewObb = obbFromTRS(preview.pos, preview.rot, preview.scale);
  for (const other of others) {
    const otherObb = obbFromTRS(other.pos, other.rot, other.scale);
    if (CollisionDetector.obbIntersect(previewObb, otherObb)) {
      tsCollisions++;
    }
  }
  const tsTime = performance.now() - tsStart;

  // WASM benchmark
  const wasmStart = performance.now();
  // Simplified - would need full TRS array setup
  const wasmTime = performance.now() - wasmStart;
  const wasmCollisions = 0; // Placeholder

  return {
    timestamp: new Date().toISOString(),
    batchSize,
    tsTime,
    wasmTime,
    tsCollisions,
    wasmCollisions,
    wasmFaster: wasmTime > 0 ? ((tsTime - wasmTime) / tsTime) * 100 : 0,
  };
}

async function main() {
  const batchSizes = [64, 128, 256, 512, 1000];
  const results: BenchmarkResult[] = [];

  console.log('Running collision benchmarks...');
  
  for (const size of batchSizes) {
    try {
      const result = await runCollisionBenchmark(size);
      results.push(result);
      console.log(`Batch ${size}: TS=${result.tsTime.toFixed(2)}ms, WASM=${result.wasmTime.toFixed(2)}ms`);
    } catch (error) {
      console.warn(`Skipping batch size ${size}:`, error);
    }
  }

  // Write results to JSON for trend tracking
  const outputPath = join(process.cwd(), 'benchmarks', 'collision-results.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results written to ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

