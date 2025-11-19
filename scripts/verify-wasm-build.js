/**
 * Ensures that the pre-built WASM artifacts in packages/wasm-collision/pkg
 * are newer than the Rust collision sources. Fails fast when the artifacts
 * are missing or stale so we don't ship inconsistent builds.
 *
 * Set SKIP_WASM_SANITY=1 to bypass (only for emergency CI scenarios).
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const rustRoot = join(repoRoot, 'crates', 'collision');
const pkgRoot = join(repoRoot, 'packages', 'wasm-collision', 'pkg');

if (process.env.SKIP_WASM_SANITY === '1') {
  console.warn('[wasm] Sanity check skipped because SKIP_WASM_SANITY=1');
  process.exit(0);
}

console.log("Warning: Skipping wasm-pack installation, will use pre-built WASM files");
console.log('[wasm] Verifying pre-built collision artifacts…');

function latestMtime(targetPath) {
  if (!existsSync(targetPath)) {
    return 0;
  }
  const stat = statSync(targetPath);
  if (stat.isDirectory()) {
    let latest = stat.mtimeMs;
    const entries = readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(targetPath, entry.name);
      latest = Math.max(latest, latestMtime(entryPath));
    }
    return latest;
  }
  return stat.mtimeMs;
}

function formatTs(ms) {
  return ms ? new Date(ms).toISOString() : 'n/a';
}

const rustTargets = [
  join(rustRoot, 'src'),
  join(rustRoot, 'Cargo.toml'),
  join(rustRoot, 'Cargo.lock'),
].filter(existsSync);

let latestRust = 0;
for (const target of rustTargets) {
  latestRust = Math.max(latestRust, latestMtime(target));
}

if (!latestRust) {
  console.warn('[wasm] No Rust sources found when computing freshness; skipping check.');
  process.exit(0);
}

const outputs = [
  join(pkgRoot, 'collision_bg.wasm'),
  join(pkgRoot, 'collision.js'),
];

for (const out of outputs) {
  if (!existsSync(out)) {
    console.error(`❌ Missing WASM artifact: ${relative(repoRoot, out)}`);
    console.error('   Run: pnpm --filter @engine/wasm-collision run build:wasm');
    process.exit(1);
  }
}

let oldestArtifact = Number.POSITIVE_INFINITY;
let stalestFile = outputs[0];
for (const out of outputs) {
  const mtime = statSync(out).mtimeMs;
  if (mtime < oldestArtifact) {
    oldestArtifact = mtime;
    stalestFile = out;
  }
}

if (oldestArtifact < latestRust) {
  console.error('❌ WASM collision artifacts are stale.');
  console.error(`   Latest Rust source change: ${formatTs(latestRust)}`);
  console.error(
    `   Oldest artifact (${relative(repoRoot, stalestFile)}): ${formatTs(oldestArtifact)}`
  );
  console.error('   Rebuild with: pnpm --filter @engine/wasm-collision run build:wasm');
  console.error('   (Set SKIP_WASM_SANITY=1 to bypass in emergencies)');
  process.exit(1);
}

console.log(
  `✓ WASM artifacts are fresh (Rust: ${formatTs(latestRust)}, pkg: ${formatTs(oldestArtifact)})`
);

