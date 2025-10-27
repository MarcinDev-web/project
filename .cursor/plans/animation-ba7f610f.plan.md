<!-- ba7f610f-4bae-4fb3-8089-ab0b73b765e2 71cc6d5d-2d0d-4b78-9b2d-e11c465eb976 -->
# Animation Library (@engine/animation) — Plan (Core + Skeletal + Morph + FSM + Blending + glTF; Vertex Skinning)

### Scope

- Core runtime: Skeleton, Pose, AnimationClip, Samplers (linear/step/cubic), MorphTarget clips
- Animator: FSM with layers, crossfade blending (linear weights, slerp rotations), additive layers
- Integration: ECS system in `@engine/world` that samples poses and produces joint palette + morph weights
- Rendering: Vertex-shader skinning via joint matrices buffer in `@engine/gfx-webgpu`; morph weights via vertex attribute or SSBO
- Import: Minimal glTF 2.0 (skins, animations, morph weights)
- Tests: Unit tests for sampling, blending, FSM; integration tests for joint palette; mocks for GPU

### Architecture & Boundaries

- New package: `packages/animation/` (Level 1) — GPU-agnostic core + glTF adapter
  - Imports only `@engine/core` types (math, Disposable)
  - Exposes pure TS APIs and typed arrays; no WebGPU imports
- World integration: `@engine/world` adds thin ECS components/systems that depend on `@engine/animation`
  - `AnimatorComponent`, `SkeletalBindingComponent`, `MorphBindingComponent`, `AnimationSystem`
- Rendering integration: `@engine/gfx-webgpu` consumes outputs from `@engine/animation` and binds buffers
  - Add `SkinningBufferPool`, `MorphWeightsBuffer`, WGSL include for skinning
- No cycles: `@engine/animation` → no imports from `@engine/world` or `@engine/gfx-webgpu`

### Key Data Types (public API)

- `Skeleton`: `{ joints: Joint[], parents: Int16Array, inverseBindMatrices: Float32Array }`
- `Pose`: `{ localTranslations: Float32Array, localRotations: Float32Array, localScales: Float32Array }` (SoA)
- `AnimationClip`: `{ duration, tracks: Track[] }` with `Interpolation: 'step'|'linear'|'cubic'`
- `MorphTargetClip`: `{ duration, channels: MorphChannel[] }`
- `AnimatorController`: states, transitions, parameters; `Animator` evaluates layers → `Pose`
- `JointPalette`: `Float32Array` of mat4 (or mat3x4) computed as \(M_{final}=M_{global}·M_{invBind}\)
- `Blend` helpers: pose blend (lin + slerp), additive blend, mask support (per-joint weights)

### Rendering Contract (vertex skinning)

- Animation outputs:
  - `jointMatrices` (Float32Array length = joints * 16 or 12)
  - `morphWeights` (Float32Array per mesh target count)
- WebGPU side (`@engine/gfx-webgpu`): provide a bind group with joint palette buffer and optional morph buffer; mesh vertices carry indices/weights
```wgsl
// shader/skinning.wgsl (excerpt)
struct SkinningUniforms { jointCount: u32; };
@group(1) @binding(0) var<uniform> skn: SkinningUniforms;
@group(1) @binding(1) var<storage, read> jointMats : array<mat4x4<f32>>;

fn applySkinning(pos: vec4<f32>, nrm: vec3<f32>, idx: vec4<u32>, w: vec4<f32>) -> vec4<f32> {
  let m0 = jointMats[idx.x];
  let m1 = jointMats[idx.y];
  let m2 = jointMats[idx.z];
  let m3 = jointMats[idx.w];
  let skinned = (m0 * pos) * w.x + (m1 * pos) * w.y + (m2 * pos) * w.z + (m3 * pos) * w.w;
  return skinned;
}
```


### Milestones

- M1 (MVP): Core types, clip sampling, pose ops, Animator FSM (single layer), crossfade, skeleton-to-joint palette, vertex skinning path, basic glTF import (skins + anim), minimal morph weights, ECS + render integration, tests
- M2: Additive layers, masks, morph animation blending, better glTF coverage, buffer pooling & reuse, performance tuning
- M3: Blend spaces (1D/2D), retargeting (humanoid map), animation events, editor tooling hooks

### Acceptance (M1)

- Load a glTF character with skin + 2 clips (idle, walk), crossfade without popping
- Morph target demo clip applies and blends with skeletal clip
- Vertex shader skinning renders correctly (visual + joint palette numeric test)
- No per-frame heap churn in hot paths; dispose() cleans up buffers/subscriptions
- All unit tests pass in CI (Vitest)

### Files and Locations (essential)

- `packages/animation/`
  - `src/core/Skeleton.ts`, `src/core/Pose.ts`, `src/core/AnimationClip.ts`, `src/core/Blend.ts`
  - `src/runtime/Animator.ts`, `src/runtime/AnimatorController.ts`
  - `src/gltf/convertFromGltf.ts` (minimal parser to core types)
  - `src/index.ts` (public API)
  - `tests/*.test.ts`
- `packages/world/`
  - `src/components/AnimatorComponent.ts`
  - `src/components/SkeletalBindingComponent.ts`
  - `src/systems/AnimationSystem.ts`
- `packages/gfx-webgpu/`
  - `src/skinning/SkinningBufferPool.ts`
  - `src/shaders/skinning.wgsl`
  - `src/pipeline/augmentMeshPipelineWithSkinning.ts`

### Testing

- Unit: sampler interpolation, pose blending, FSM transitions, joint palette correctness (small rig)
- Integration: ECS system produces stable buffers; morph weights blending
- Mocks: GPU buffers mocked with typed arrays; ensure disposal

### Performance & Memory

- SoA typed arrays for pose; pre-allocated joint palette; pooled temp mats/quats
- Frame-local scratch allocators; no dynamic arrays in per-frame loops
- Optional mat3x4 palette to halve bandwidth (M2)

### Disposal

- `Animator.dispose()`, `AnimationSystem.dispose()` unsubscribes from tick/event bus
- Buffer pools clear and free on scene dispose

### To-dos

- [ ] Create packages/animation with build, exports, and path aliases
- [ ] Implement Skeleton, Pose (SoA), AnimationClip, Blend helpers
- [ ] Implement step/linear/cubic samplers for tracks
- [ ] Implement AnimatorController and Animator (single layer)
- [ ] Add crossfade blending with slerp rotations
- [ ] Compute joint palette from pose and inverseBind matrices
- [ ] Add MorphTargetClip and pose application
- [ ] Add AnimatorComponent and bindings in @engine/world
- [ ] Implement AnimationSystem to update poses each frame
- [ ] Add SkinningBufferPool and WGSL skinning in gfx-webgpu
- [ ] Implement minimal glTF import (skins, animations, morph)
- [ ] Add unit tests: samplers, blending, FSM, palette
- [ ] Add integration tests for ECS and buffers
- [ ] Introduce typed-array pools and scratch allocators
- [ ] Write README and usage docs for @engine/animation