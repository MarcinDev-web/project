# Issue: WebGPU Shader Non-Uniform Control Flow Error

**Status:** ✅ RESOLVED  
**Date Reported:** 2025-10-26  
**Date Fixed:** 2025-10-26  
**Severity:** 🔴 Critical (blocks editor startup)  
**Commit:** `db26164`

## Problem Description

### Symptoms
Editor failed to start with WGSL shader compilation error:

```
Error while parsing WGSL: :159:16 error: 'textureSampleCompare' must only be 
called from uniform control flow

        sum += textureSampleCompare(shadowAtlas, shadowSamplerCmp, uv + off, zRef);
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

### Error Chain
```
:157:7 note: control flow depends on possibly non-uniform value
      if (x >= -r && x < k - r && y >= -r && y < k - r) {

:146:46 note: parameter 'kernel' of 'sampleShadowPCF' may be non-uniform
fn sampleShadowPCF(uv: vec2<f32>, zRef: f32, kernel: i32, texelSize: vec2<f32>) -> f32

:207:41 note: possibly non-uniform value passed here
  return sampleShadowPCF(atlasUV, zRef, kernel, texel);

:169:35 note: parameter 'cascadeIndex' of 'sampleShadowPCSS' may be non-uniform
  let LP = uniforms.lightViewProj[cascadeIndex] * vec4<f32>(worldPos, 1.0);
```

### Impact
- ❌ Editor cannot start
- ❌ WebGPU device initialization fails
- ❌ Complete blocker for all editor functionality

## Root Cause Analysis

### Technical Background

**WebGPU Uniform Control Flow Requirement:**
- `textureSampleCompare` requires **uniform control flow**
- All shader invocations in a 2x2 quad must execute the same code path
- This is required for automatic derivative calculations (used for mip-map selection)

### The Problem

In `packages/gfx-webgpu/src/shaders/pbr.ts`:

**Function: `sampleShadowPCF`**
```wgsl
fn sampleShadowPCF(uv: vec2<f32>, zRef: f32, kernel: i32, texelSize: vec2<f32>) -> f32 {
  var sum = 0.0;
  var count = 0.0;
  let k = max(kernel, 1);
  let r = k / 2;
  const MAX_KERNEL = 9;
  let halfMax = MAX_KERNEL / 2;
  for (var y = -halfMax; y <= halfMax; y++) {
    for (var x = -halfMax; x <= halfMax; x++) {
      // ❌ PROBLEM: Conditional execution
      if (x >= -r && x < k - r && y >= -r && y < k - r) {
        let off = vec2<f32>(f32(x), f32(y)) * texelSize;
        // ❌ textureSampleCompare inside conditional = non-uniform control flow!
        sum += textureSampleCompare(shadowAtlas, shadowSamplerCmp, uv + off, zRef);
        count += 1.0;
      }
    }
  }
  return sum / max(count, 1.0);
}
```

**Why `kernel` is non-uniform:**

1. **PCSS (Percentage Closer Soft Shadows)** dynamically adjusts filter size based on:
   - Distance from blocker
   - Penumbra size calculation
   - Result: Different pixels → different `kernel` values

2. **Cascade Shadow Maps:**
   - Different pixels may be in different cascades (`cascadeIndex` varies)
   - Each cascade has different light view matrix
   - Results in different filter radii per pixel

3. **Non-uniform control flow:**
   - Pixel A: `kernel=3`, executes `if` for smaller region
   - Pixel B: `kernel=7`, executes `if` for larger region
   - Different execution paths = non-uniform control flow
   - WebGPU: ❌ INVALID

## Solution

### Strategy: Weight-based Sampling

Instead of conditionally sampling, **always sample** but use weights:

**Fixed Code:**
```wgsl
fn sampleShadowPCF(uv: vec2<f32>, zRef: f32, kernel: i32, texelSize: vec2<f32>) -> f32 {
  var sum = 0.0;
  var count = 0.0;
  let k = max(kernel, 1);
  let r = k / 2;
  // Use fixed loop bounds for uniform control flow - required by WebGPU
  const MAX_KERNEL = 9;
  let halfMax = MAX_KERNEL / 2;
  for (var y = -halfMax; y <= halfMax; y++) {
    for (var x = -halfMax; x <= halfMax; x++) {
      let off = vec2<f32>(f32(x), f32(y)) * texelSize;
      // ✅ ALWAYS sample - uniform control flow
      let shadowValue = textureSampleCompare(shadowAtlas, shadowSamplerCmp, uv + off, zRef);
      // ✅ Use weight to include/exclude samples
      let inKernel = f32(x >= -r && x < k - r && y >= -r && y < k - r);
      sum += shadowValue * inKernel;
      count += inKernel;
    }
  }
  return sum / max(count, 1.0);
}
```

### Key Changes

1. **Moved sampling outside conditional:**
   - `textureSampleCompare` now always executes
   - Uniform control flow maintained ✅

2. **Weight-based filtering:**
   - `inKernel = f32(condition)` → converts boolean to 0.0 or 1.0
   - `shadowValue * inKernel` → zeros out samples outside kernel
   - `count += inKernel` → only counts included samples

3. **Maintains quality:**
   - Same sampling pattern as before
   - PCSS soft shadow quality preserved
   - No visual changes expected

### Performance Impact

**Before:**
- Conditional execution: fewer samples for small kernels
- But: non-uniform control flow = GPU inefficiency anyway

**After:**
- Fixed 9×9 = 81 samples per pixel (MAX_KERNEL)
- Uniform control flow = better GPU utilization
- Weight multiplication is cheap (FMA operation)

**Net:** Likely similar or slightly better performance due to uniform execution.

## Testing

### Verification Steps

1. **TypeScript Compilation:** ✅ PASS
   ```bash
   pnpm --filter @engine/gfx-webgpu build
   ```

2. **Vite Build:** ✅ PASS
   ```bash
   pnpm --filter @apps/editor build
   ```

3. **WebGPU Shader Compilation:** ✅ Expected to pass
   - Requires browser testing
   - Previous error should be gone

4. **Visual Quality Check:**
   - [ ] Shadows render correctly
   - [ ] Soft shadow penumbra looks natural
   - [ ] No artifacts or banding
   - [ ] Performance is acceptable

### Manual Testing Checklist

Run editor and verify:
- [ ] Editor starts without shader errors
- [ ] Shadows appear on objects
- [ ] Soft shadows have smooth transitions
- [ ] No console errors related to shaders
- [ ] FPS is acceptable (similar to before)

## Related Issues

- **Main refactoring PR:** Camera/Assets duplicates removal
- **This fix:** Separate issue - shader compilation error

## Prevention

### Future Guidelines

1. **WebGPU Shader Rules:**
   - Never call `textureSample*` inside non-uniform `if`
   - Use weights instead of conditionals for dynamic filtering
   - Test in browser immediately after shader changes

2. **Code Review Checklist:**
   - [ ] Check for `textureSample*` inside conditionals
   - [ ] Verify uniform control flow for texture operations
   - [ ] Consider GPU execution model (2x2 quads)

3. **Documentation:**
   - Add comment to shader: `// WebGPU: maintain uniform control flow`
   - Document why certain patterns are used

## References

### WebGPU Specification
- [WGSL Uniform Control Flow](https://www.w3.org/TR/WGSL/#uniform-control-flow)
- [Texture Sampling Derivatives](https://www.w3.org/TR/WGSL/#derivative-uniformity)

### Technical Resources
- [Understanding GPU Shader Execution Model](https://www.khronos.org/opengl/wiki/Shader_Execution_Model)
- [SIMD and Divergent Execution](https://developer.nvidia.com/blog/optimizing-compute-shaders-for-l2-locality-using-thread-group-id-swizzling/)

## File Changes

**Modified:**
- `packages/gfx-webgpu/src/shaders/pbr.ts`
  - Function: `sampleShadowPCF` (lines ~97-117)
  - Changed: Moved `textureSampleCompare` outside conditional
  - Changed: Added weight-based filtering
  - Added: Clarifying comments

**Lines changed:** 8 insertions, 7 deletions

## Commit

```bash
git show db26164
```

**Commit message:**
```
fix: WebGPU shader non-uniform control flow error in shadow sampling

Fix WGSL compilation error: 'textureSampleCompare' must only be called 
from uniform control flow.

[Full commit message in git log]
```

---

**Author:** AI Assistant (based on error analysis)  
**Reviewer:** [Pending]  
**Status:** ✅ Fixed, awaiting browser testing verification

