# UGC Security Model and Sandbox Policy

## Scope
Covers execution of user-generated scripts and ingestion of user assets (models, textures, audio). Defines threat model, sandbox boundaries, allowed capabilities, validation pipeline, CSP, and review/testing.

## Threat Model
- Untrusted code (scripts, mods) attempting to exfiltrate data, hang the app, or escape sandbox.
- Malicious/oversized assets causing crashes, OOM, GPU timeouts, or shader injection via metadata.
- Social engineering content (phishing links) in text/HTML descriptions (out-of-scope for runtime; mitigated via publishing pipeline).

## Security Goals
- Contain untrusted scripts within a capability-based sandbox.
- Enforce strict CPU time and memory budgets, frame-by-frame.
- Validate and sanitize all imported assets by content (magic bytes), not by extension only.
- Maintain deterministic simulation (no wall-clock or global randomness usage).

## Script Sandbox (Execution Environment)
- Process: Dedicated Web Worker per world (or per trust domain); no DOM access.
- Communication: Message-passing only (structured clone), no shared references unless explicitly enabled.
- API Exposure: Narrow, capability-based interface. No direct engine internals.
- Timing: No access to `Date.now()`, `performance.now()`, or `setTimeout` directly; expose engine-ticked time and schedule.
- Randomness: Provide seeded RNG from `PlayManifest.simulation.rngSeed`. Forbid `Math.random()` usage (lint/runtime guard).
- Networking/File System: Disabled by default. Add explicit, auditable capabilities if ever needed.

### Capability Tokens
- Capabilities are opaque handles granted at load time based on `PlayManifest.permissions`.
- Each API call validates capability token and arguments shape.
- Capabilities are revocable at runtime (pause/stop, moderation, device-loss recovery).

### Budget Enforcement
- CPU budget: N ms per frame per sandbox (default 2–4 ms of the 16.67ms budget).
- Memory budget: Hard cap in MB; terminate worker on limit breach with user-facing error.
- Watchdog: Detect long-tasks; yield back to main thread. Terminate on repeated violations.

## Asset Validation Pipeline
- Accept list (at publish and at import):
  - Models: glTF/glb only. Disallow embedded scripts/custom extensions unless whitelisted.
  - Textures: PNG/JPEG/WebP; validate magic bytes. Convert/compress offline when possible.
  - Audio: Ogg/MP3/WAV; duration and size caps.
- Validation steps:
  1. Magic byte detection (reject mismatched types).
  2. Size and dimension limits (e.g., textures ≤ 4096²; models ≤ N vertices/triangles; file size ≤ M MiB).
  3. glTF sanitation: strip unknown extensions, normals tangents regeneration if needed, enforce unit scale (meter), Y-up.
  4. Material policy: known PBR fields only; no custom shader code in materials.
  5. Hashing: content hash used for deduplication and caching.
- Runtime loading:
  - Prefer preprocessed/compressed assets (BC/ETC2/ASTC) based on `RendererCapabilities`.
  - Fallback to uncompressed with mipmap generation if necessary.

## Content Security Policy & Isolation
- Set strict CSP: disallow inline scripts, restrict sources to same-origin and static asset CDN.
- Use COOP/COEP to enable `crossOriginIsolated` when possible (SharedArrayBuffer/WASM perf), while keeping sandbox boundaries.
- Enable Trusted Types for any HTML injection paths in editor UI.

## Permissions Contract (Source of Truth)
- `PlayManifest.permissions` defines the allowed APIs and limits per session.
- Publishing pipeline must not increase permissions; only the runtime/editor can further restrict.

## Moderation & Reporting Hooks
- Provide user-facing “Report content” action which captures manifest, capability plan, last 100 structured logs, and content hashes.
- Store reports server-side for review and potential revocation.

## Testing Strategy
- Unit: Validate capability checks, argument schemas, and revocation paths.
- Integration: Script budget throttling, termination, and recovery.
- E2E: Import malicious assets (oversized, wrong magic bytes, invalid glTF) and confirm rejection.
- Fuzz: Random JSON payloads against the asset pipeline and script API surfaces.

## Implementation Checklist
- [ ] Implement capability-token layer around script APIs (whitelist only).
- [ ] Provide seeded RNG to scripts and ban `Math.random()` at runtime.
- [ ] Enforce CPU/memory budgets in worker; terminate on violation.
- [ ] Add asset validation service (magic bytes, size limits, glTF sanitation).
- [ ] Set strict CSP and enable Trusted Types for editor UI.
- [ ] Add report flow with structured logs and content hashes.

---

Last Updated: 2025-11-07
Maintainer: Platform Security

