# Future WASM Modules - Planning Document

This document outlines potential additional WASM modules for Forge Engine.

## Overview

Current WASM modules:
- `crates/collision` - OBB collision detection (production)

## Candidate Modules

### 1. Physics Simulation (`crates/physics-wasm`)

**Purpose:** High-performance physics calculations  
**Potential Features:**
- Constraint solving
- Rigid body dynamics
- Joint calculations
- Force accumulation

**Benefits:**
- Offload CPU-intensive physics from main thread
- Better performance for complex physics scenes
- Potential for multi-threading with `wasm-bindgen-rayon`

**Considerations:**
- Current physics implementation in TypeScript may be sufficient
- Would require significant Rust development
- Integration with existing `@engine/world/physics`

**Priority:** Medium (if physics becomes bottleneck)

---

### 2. Mesh Processing (`crates/mesh-wasm`)

**Purpose:** Mesh operations and transformations  
**Potential Features:**
- Mesh simplification (decimation)
- UV unwrapping
- Normal recalculation
- Mesh optimization

**Benefits:**
- Faster mesh processing
- Better asset pipeline performance
- Offload heavy computations

**Considerations:**
- Current mesh needs are handled by glTF
- May not provide significant benefit
- Integration complexity

**Priority:** Low (only if mesh processing becomes frequent bottleneck)

---

### 3. Audio Processing (`crates/audio-wasm`)

**Purpose:** Audio synthesis and processing  
**Potential Features:**
- Sound synthesis
- Audio effects processing
- Real-time audio manipulation
- Spatial audio calculations

**Benefits:**
- Lower latency audio processing
- More complex audio effects possible
- Better performance for procedural audio

**Considerations:**
- Web Audio API may be sufficient for most use cases
- Requires audio domain expertise
- Limited benefit unless complex audio needed

**Priority:** Low (only if complex procedural audio required)

---

## Decision Criteria

When to create a new WASM module:

1. **Performance bottleneck** - Current TypeScript implementation is limiting
2. **CPU-intensive** - Heavy computation that benefits from native code
3. **Batch processing** - Large datasets that benefit from vectorization
4. **Reusable** - Logic used across multiple parts of engine
5. **Maintainable** - Can be maintained alongside TypeScript codebase

## Implementation Guidelines

When implementing a new WASM module:

1. **Follow collision pattern** - Use same structure as `crates/collision`
2. **Create TypeScript wrapper** - Similar to `@engine/wasm-collision`
3. **Add parity tests** - Verify WASM matches TypeScript results
4. **Provide fallback** - Always have TypeScript implementation
5. **Document build process** - Update WASM build docs
6. **Add CI/CD** - Include in WASM build workflow

## Current Recommendations

**No immediate need** for additional WASM modules. Current collision module provides significant value. Consider additional modules only when:

- Performance profiling identifies clear bottlenecks
- TypeScript implementation cannot be optimized further
- User requirements demand higher performance

---

**Status:** Planning document - no implementation planned  
**Last Updated:** 2025-01-27

