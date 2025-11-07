# WebGPU Feature Policy, Adapter Selection, and Device-Loss Handling

## Purpose
Define a predictable, supportable runtime across browsers/GPUs with clear feature tiers, adapter selection, limits negotiation, and robust device-loss recovery.

## Target Platforms
- Desktop: Chromium-based (Chrome/Edge), Firefox (when WebGPU enabled), Safari ≥ 18
- OS: Windows 10+, macOS 13+, Linux (Wayland/X11)
- GPUs: Integrated and discrete. No WebGL fallback (explicitly unsupported).

## Adapter Selection Strategy
1. Try `powerPreference: 'high-performance'`, then fallback to `'low-power'`.
2. Probe optional features and effective limits before device creation.
3. Select the highest supported Tier (see below) that satisfies requested scene requirements.
4. Persist chosen capability profile per machine (local cache) to avoid re-probing every boot.

```ts
// Pseudocode sketch (TypeScript)
async function pickAdapter(): Promise<GPUAdapter | null> {
  const prefs: GPUPowerPreference[] = ['high-performance', 'low-power'];
  for (const p of prefs) {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: p });
    if (adapter) return adapter;
  }
  return null;
}
```

## Capability Object (Canonical)
At init, compute and store a read-only capability object used by renderer and systems.

```ts
// Example shape; implement in @engine/gfx-webgpu
export interface RendererCapabilities {
  tier: 0 | 1 | 2;
  features: Set<GPUFeatureName>;
  limits: GPUSupportedLimits; // snapshot of adapter/device limits
  textureCompression: 'bc' | 'etc2' | 'astc' | 'none';
  timestampQuery: boolean;
  shaderF16: boolean;
}
```

## Feature Tiers
- Tier 0 (Baseline): Core WebGPU only; no optional features required.
- Tier 1 (Preferred): + one texture compression (BC/ETC2/ASTC), `depth24unorm-stencil8`.
- Tier 2 (Enhanced): + `timestamp-query`, `shader-f16`, `indirect-first-instance`.

Engine must function on Tier 0; visual quality/perf scale up with tiers.

## Feature Matrix (Fill via probing on startup)
| Feature                       | Required | Preferred | Notes                                 | Toggle Key |
|------------------------------|----------|-----------|----------------------------------------|------------|
| texture-compression-bc       | No       | Yes       | Desktop dGPU/iGPU (Windows)            | gfx.tex.bc |
| texture-compression-etc2     | No       | Yes       | Mobile/mac targets                      | gfx.tex.etc2 |
| texture-compression-astc     | No       | Maybe     | Safari/Apple GPU where available        | gfx.tex.astc |
| depth24unorm-stencil8        | No       | Yes       | Fallback to depth32float if absent      | gfx.depth.d24s8 |
| timestamp-query              | No       | Yes       | Perf profiling, not gameplay-critical   | gfx.prof.tsq |
| shader-f16                   | No       | Yes       | Bandwidth reduction in shaders          | gfx.sh.f16 |
| indirect-first-instance      | No       | Maybe     | Instancing flexibility                  | gfx.indirect |

Notes:
- Choose the best available compression priority: BC > ETC2 > ASTC, else none.
- If no compression available, use uncompressed formats and smaller textures.

## Limits Policy
Set engine minimums; refuse to run only if below absolute minimums. Otherwise adapt content.

Minimums (documented expectations, not hard-coded values):
- `maxBindGroups ≥ 4`
- `maxUniformBuffersPerShaderStage ≥ 12` (aggregate across stages)
- `maxStorageBufferBindingSize ≥ 64 MiB`
- `maxBufferSize ≥ 256 MiB`
- `maxTextureDimension2D ≥ 4096`

Renderer must gracefully degrade (smaller batch sizes, reduced LODs) when reported limits are lower than ideal.

## Device-Loss Handling Policy
1. Subscribe to `device.lost` and `device.onuncapturederror`.
2. On loss:
   - Pause update/render loop.
   - Release GPU resources (safe, idempotent dispose()).
   - Attempt re-initialization once at same Tier; if it fails, downgrade Tier and retry.
   - If repeated failure: surface non-blocking UI with retry button and diagnostics.
3. Classify reasons (if exposed): `out-of-memory`, `unknown`, `destroyed` → attach to telemetry.

```ts
// Pseudocode
async function handleDeviceLoss(device: GPUDevice) {
  const info = await device.lost; // waits for loss
  console.warn('GPU device lost', info);
  await renderer.teardown();
  const ok = await renderer.tryReinitialize({ downgradeOnFail: true });
  if (!ok) showRecoveryUI(info.message);
}
```

## Error Reporting and Telemetry (Opt-in)
- Log adapter info (vendor, architecture, description) without PII.
- Record selected Tier and feature set.
- Sample frame timings with `timestamp-query` when available.
- Store last 10 errors in memory for bug reports.

## Testing Matrix (Execute regularly)
- Browsers: Chrome Stable/Beta, Edge, Safari, Firefox Nightly (WebGPU enabled).
- GPUs: Intel iGPU (recent), NVIDIA, AMD.
- Scenarios: first init, resize storm, tab suspend/resume, device loss (simulated), feature absent.

## Implementation Checklist
- [ ] Implement adapter probing and Tier selection in `@engine/gfx-webgpu`.
- [ ] Expose `RendererCapabilities` via public API.
- [ ] Implement device-loss recovery path with safe disposal.
- [ ] Texture compression selection logic with runtime toggle for debugging.
- [ ] Timestamp-query guards and fallbacks in profiler.
- [ ] Add headless smoke test that initializes and tears down renderer twice.

---

Last Updated: 2025-11-07
Maintainer: Graphics Subsystem

