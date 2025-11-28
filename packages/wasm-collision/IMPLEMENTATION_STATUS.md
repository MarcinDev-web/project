# Rust / WASM Collision Implementation Status

## Completed Features

### Intersection Tests
- [x] OBB-OBB (15-axis SAT) - `obb_intersect`
- [x] OBB-OBB with contact info - `obb_intersect_with_contact`
- [x] Sphere-Sphere - `sphere_sphere_intersect`
- [x] Sphere-OBB - `sphere_obb_intersect`
- [x] Capsule-Sphere - `capsule_sphere_intersect`
- [x] Capsule-OBB - `capsule_obb_intersect`
- [x] Capsule-Capsule - `capsule_capsule_intersect`

### Raycasting
- [x] Ray-Sphere - `ray_sphere_intersect`
- [x] Ray-OBB - `ray_obb_intersect`
- [x] Ray-Capsule - `ray_capsule_intersect`

### Batch Operations
- [x] `batch_check_trs` - One-vs-many collision check with TRS data
- [x] `batch_check_all` - All-vs-all collision detection
- [x] `batch_check` - OBB format batch check

### Spatial Structures
- [x] Morton code encoding (30-bit 3D)
- [x] Uniform grid spatial index
- [x] AABB broad-phase filtering

### Frustum & Occlusion
- [x] Frustum extraction from view-projection matrix
- [x] Frustum-AABB intersection test
- [x] Software occlusion buffer
- [x] Triangle rasterization for occluders
- [x] Visibility queries against depth buffer

### CollisionWorld API
- [x] `new()` - Constructor
- [x] `resize(count)` - Resize internal buffers
- [x] `clear()` - Release memory
- [x] `check_collisions()` - All-pairs detection
- [x] `query_frustum(view_proj)` - Frustum culling
- [x] `init_occlusion_culling(w, h)` - Initialize occlusion buffer
- [x] `rasterize_occluders(indices, view_proj)` - Render occluders

### Contact Generation
- [x] `CollisionContact` struct with:
  - `has_collision` - Boolean collision flag
  - `depth` - Penetration depth
  - `normal_x/y/z` - Collision normal
  - `point_x/y/z` - Contact point

### TypeScript Integration
- [x] Full type definitions
- [x] Buffer pooling (`getTrsBuffers`, `releaseTrsBuffers`)
- [x] Pool metrics (`getPoolMetrics`)
- [x] Async initialization with fallback

## Testing Status

### Unit Tests (Rust)
- [x] `touching_faces_intersect`
- [x] `separated_do_not_intersect`
- [x] `rotated_intersect`
- [x] `test_occlusion_buffer_visibility`

### Integration Tests (TypeScript)
- [x] Smoke test - WASM module loading
- [x] Parity tests - TS vs WASM comparison
- [x] Edge case tests - touching faces, separated boxes, rotations

### Benchmarks
- [x] Criterion benchmarks for `batch_check_trs`
- [x] CI pipeline integration

## Performance Characteristics

| Operation | Typical Performance |
|-----------|---------------------|
| OBB-OBB (single) | ~100ns |
| Sphere-Sphere (single) | ~20ns |
| Batch 1000 TRS | ~0.5-1ms |
| Frustum query 1000 objects | ~0.2ms |

## Known Limitations

1. **Triangle clipping** - `rasterize_triangle` discards triangles with vertices behind camera instead of clipping
2. **Occlusion rasterizer** - Uses axis-aligned bounding boxes for occluders, may cause over-occlusion
3. **Contact point accuracy** - Uses midpoint approximation, not true closest points

## Future Improvements

- [ ] SIMD optimization (wasm32-simd128)
- [ ] BVH for static scene acceleration
- [ ] Proper triangle clipping for occlusion
- [ ] Multiple contact points for edge-edge cases
- [ ] Continuous collision detection (CCD)

## File Structure

```
crates/collision/
├── src/lib.rs        # Main implementation (~1800 lines)
├── benches/          # Criterion benchmarks
├── Cargo.toml        # Rust dependencies
└── pkg/              # Generated WASM output

packages/wasm-collision/
├── src/
│   ├── index.ts      # TypeScript API wrapper
│   ├── pool.ts       # Buffer pooling
│   └── __tests__/    # Test files
├── pkg/              # Symlink to crates output
└── dist/             # Compiled TypeScript
```

## Build Commands

```bash
# Build WASM (requires Rust + wasm-pack)
pnpm build:wasm

# Build TypeScript (uses pre-built WASM)
pnpm build:ts

# Full build
pnpm build:full

# Run tests
pnpm test

# Run Rust benchmarks
cd ../../crates/collision && cargo bench
```

---

**Last Updated:** 2025-10-26
**Version:** 0.1.0
