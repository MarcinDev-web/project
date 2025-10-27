#!/usr/bin/env node
/**
 * Measure JS heap usage for a typical @engine/world scene in Node.
 *
 * Usage (Windows/Unix):
 *   node --expose-gc scripts/measure-heap.js --duration=60 --entities=1000 --interval=10
 *
 * Notes:
 * - Requires Node started with --expose-gc to force GC between measurements.
 * - This is a CPU-side heap proxy; browser DevTools allocation sampling is still recommended.
 */

import { argv, exit } from 'node:process';

// Parse simple CLI args
function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = argv.find((a) => a.startsWith(prefix));
  if (!arg) return fallback;
  const val = arg.slice(prefix.length);
  const num = Number(val);
  // return number when numeric, otherwise string
  return Number.isFinite(num) && val.trim() !== '' ? num : val;
}

const durationSec = getArg('duration', 60);
const entitiesCount = getArg('entities', 1000);
const logIntervalSec = getArg('interval', 10);

if (typeof global.gc !== 'function') {
  console.error('❌ global.gc is not available. Run with: node --expose-gc scripts/measure-heap.js');
  exit(1);
}

function bytesToMiB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function forceGC() {
  try {
    global.gc();
    global.gc(); // twice to encourage full collections
  } catch {
    // ignore
  }
}

function heapReport(label) {
  const used = process.memoryUsage().heapUsed;
  console.log(`${label}: ${bytesToMiB(used)} MiB`);
  return used;
}

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('🚀 JS Heap Measurement (@engine/world)');
  console.log(`- duration: ${durationSec}s`);
  console.log(`- entities: ${entitiesCount}`);
  console.log(`- interval: ${logIntervalSec}s`);

  // Lazy import from built artifacts to avoid TS compilation during measurements
  const world = await import('@engine/world/core');
  const { Scene, Entity } = world;
  if (!Scene || !Entity) {
    console.error('❌ Failed to import Scene/Entity from @engine/world');
    exit(1);
  }

  forceGC();
  const baselineBefore = heapReport('Baseline (before)');

  // Build a typical scene with a grid of entities
  const scene = new Scene('MeasureScene');
  const side = Math.ceil(Math.cbrt(entitiesCount));
  let created = 0;
  const spacing = 2;
  for (let x = 0; x < side && created < entitiesCount; x++) {
    for (let y = 0; y < side && created < entitiesCount; y++) {
      for (let z = 0; z < side && created < entitiesCount; z++) {
        const e = new Entity(`E_${created}`);
        // light transform offsets
        const t = e.transform;
        t.position[0] = (x - side / 2) * spacing;
        t.position[1] = (y - side / 2) * spacing;
        t.position[2] = (z - side / 2) * spacing;
        // touch mesh/material proxies to allocate minimal components
        e.meshType = 'cube';
        e.color = [1, 1, 1, 1];
        scene.addEntity(e);
        created++;
      }
    }
  }

  // Warm-up
  await sleep(250);
  forceGC();
  const afterCreate = heapReport('After create (post-GC)');

  // Simulate a simple per-frame update that touches transforms
  console.log('Running simulation...');
  const start = Date.now();
  let lastLog = start;
  const entities = scene.getAllEntities();
  let tick = 0;
  while (Date.now() - start < durationSec * 1000) {
    // minimal sinusoidal motion to exercise math/transform code paths without allocations
    const phase = tick * 0.001;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const p = e.transform.position;
      p[0] += Math.sin(phase + i * 0.0001) * 0.0001;
      p[1] += Math.cos(phase + i * 0.0002) * 0.0001;
    }
    tick++;

    const now = Date.now();
    if ((now - lastLog) / 1000 >= logIntervalSec) {
      forceGC();
      heapReport(`Checkpoint @ ${(now - start) / 1000}s (post-GC)`);
      lastLog = now;
    }
    // ~60fps pacing without tight CPU spin
    await sleep(16);
  }

  // Final GC + report
  forceGC();
  const baselineAfter = heapReport('Final (post-GC)');
  const deltaMiB = (baselineAfter - baselineBefore) / (1024 * 1024);
  console.log(`Delta vs baseline: ${deltaMiB.toFixed(2)} MiB`);

  // Clean up scene to help follow-up leak tests reuse this script
  scene.clear();
  forceGC();
  heapReport('After dispose (post-GC)');
}

main().catch((err) => {
  console.error('❌ Measurement failed:', err);
  exit(1);
});


