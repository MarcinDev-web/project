# Runtime Determinism and Serialization Compatibility

## Purpose
Guarantee consistent simulation results across runs and versions. Define time model, RNG policy, coordinate system, numeric precision, and versioned serialization with migration.

## Time Model (Authoritative)
- Fixed update: 60 Hz by default (`simulation.fixedDeltaTime`), accumulator pattern.
- Variable update: rendering and view-only systems run once per frame.
- No gameplay logic in render phase. Render reads state only.

## Randomness Policy
- Source of truth: Seeded RNG from `PlayManifest.simulation.rngSeed`.
- Forbid `Math.random()` in gameplay code; use engine RNG utility only.
- Replays: store initial seed + user inputs; results must match bit-for-bit within numeric tolerances.

## Coordinate System and Units
- Right-handed coordinate system (see `@engine/core` math; `mat4LookAt` is RH).
- Axes: X right, Y up, Z forward (negative Z forward by convention in camera look-at).
- Units: meters for distances; seconds for time; kilograms for mass.

## Numeric Precision
- CPU: JavaScript `number` (FP64) for simulation; avoid chaotic branches.
- GPU: Use FP16 (`shader-f16`) when available for bandwidth; keep critical math in FP32.
- Tolerances: Use epsilon comparisons for floats in tests (`1e-6` CPU; shader-specific on GPU).

## Physics Determinism (Guidelines)
- Fixed timestep only; set `maxSubsteps` to cap catch-up.
- Avoid non-deterministic parallel reductions in hot paths.
- Ensure stable ordering: sort contact pairs/entities when iteration order matters.

## Serialization Versioning
- All serialized scene/runtime data includes a `version` field (integer, semver-compatible in manifest if needed).
- Backward-compatible changes: MINOR version; add fields with defaults; never repurpose fields.
- Breaking changes: MAJOR version; provide migration steps or block load with clear error.

### Migration Strategy
- Maintain a per-version migration pipeline: `(vN) → (vN+1)` pure functions.
- Migrations are associative; to upgrade old content, apply sequentially to current.
- Keep migrations idempotent and well-tested.

```ts
// Pseudocode
interface SceneV1 { version: 1; /* ... */ }
interface SceneV2 { version: 2; /* ... */ }

function migrateV1toV2(v1: SceneV1): SceneV2 { /* ... */ return { version: 2 }; }

export function migrateToCurrent(input: unknown): CurrentScene {
  let data = input as { version: number };
  switch (data.version) {
    case 1: data = migrateV1toV2(data as SceneV1); /* falls through */
    case 2: /* migrate to v3 */
    default: /* already current */
  }
  return data as CurrentScene;
}
```

## Determinism Testing
- Unit: freeze RNG seed and assert outcomes; test accumulator edge cases.
- Integration: run same input script twice; compare state snapshots after N ticks.
- Snapshot sanitizer: strip non-deterministic fields (timestamps, ids) before compare.

## Implementation Checklist
- [ ] Provide engine RNG utility seeded from `PlayManifest` and lint rule banning `Math.random()` in runtime.
- [ ] Ensure fixed timestep is the only driver of gameplay systems.
- [ ] Define and document world units (meters/seconds/kg) and axis conventions.
- [ ] Add version field to all serialized data; implement migration scaffolding.
- [ ] Add tests: RNG determinism, migration idempotency, fixed-step accumulator.

---

Last Updated: 2025-11-07
Maintainer: Runtime/Core

