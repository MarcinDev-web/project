#!/usr/bin/env node
/**
 * Measure JS heap usage for a typical @engine/world scene in Node using tsx loader.
 *
 * Usage (Windows/Unix):
 *   pnpm run measure:heap -- --duration=60 --entities=1000 --interval=10
 *
 * Requires: node --expose-gc (handled by package script)
 */

// Minimal CLI parsing
const argv: string[] = process.argv;
function getArg(name: string, fallback: number | string): number | string {
  const prefix = `--${name}=`;
  const arg = argv.find((a) => a.startsWith(prefix));
  if (!arg) return fallback;
  const val = arg.slice(prefix.length);
  const num = Number(val);
  return Number.isFinite(num) && val.trim() !== '' ? num : val;
}

const durationSec = Number(getArg('duration', 60));
const entitiesCount = Number(getArg('entities', 1000));
const logIntervalSec = Number(getArg('interval', 10));

if (typeof global.gc !== 'function') {
  console.error('❌ global.gc is not available. Ensure the script runs with --expose-gc');
  process.exit(1);
}

function bytesToMiB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function forceGC(): void {
  try {
    global.gc?.();
    global.gc?.();
  } catch {
    // ignore
  }
}

function heapReport(label: string): number {
  const used = process.memoryUsage().heapUsed;
  console.log(`${label}: ${bytesToMiB(used)} MiB`);
  return used;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function main(): Promise<void> {
  console.log('🚀 JS Heap Measurement (@engine/world)');
  console.log(`- duration: ${durationSec}s`);
  console.log(`- entities: ${entitiesCount}`);
  console.log(`- interval: ${logIntervalSec}s`);

  // Import from TS sources via tsx loader; respects monorepo path aliases
  const { Scene } = await import('@engine/world/core/index.ts');
  const { Entity } = await import('@engine/world/core/Entity.ts');
  if (!Scene || !Entity) {
    console.error('❌ Failed to import Scene/Entity from @engine/world sources');
    process.exit(1);
  }

  forceGC();
  const baselineBefore = heapReport('Baseline (before)');

  const scene = new Scene('MeasureScene');
  const side = Math.ceil(Math.cbrt(entitiesCount));
  let created = 0;
  const spacing = 2;
  for (let x = 0; x < side && created < entitiesCount; x++) {
    for (let y = 0; y < side && created < entitiesCount; y++) {
      for (let z = 0; z < side && created < entitiesCount; z++) {
        const e = new Entity(`E_${created}`);
        const t = e.transform;
        t.position[0] = (x - side / 2) * spacing;
        t.position[1] = (y - side / 2) * spacing;
        t.position[2] = (z - side / 2) * spacing;
        e.meshType = 'cube';
        e.color = [1, 1, 1, 1];
        scene.addEntity(e);
        created++;
      }
    }
  }

  await sleep(250);
  forceGC();
  const afterCreate = heapReport('After create (post-GC)');
  void afterCreate;

  console.log('Running simulation...');
  const start = Date.now();
  let lastLog = start;
  const entities = scene.getAllEntities();
  let tick = 0;
  while (Date.now() - start < durationSec * 1000) {
    const phase = tick * 0.001;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i]!;
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
    await sleep(16);
  }

  forceGC();
  const baselineAfter = heapReport('Final (post-GC)');
  const deltaMiB = (baselineAfter - baselineBefore) / (1024 * 1024);
  console.log(`Delta vs baseline: ${deltaMiB.toFixed(2)} MiB`);

  scene.clear();
  forceGC();
  heapReport('After dispose (post-GC)');
}

main().catch((err) => {
  console.error('❌ Measurement failed:', err);
  process.exit(1);
});


