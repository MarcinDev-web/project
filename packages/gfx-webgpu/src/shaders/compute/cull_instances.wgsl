/**
 * GPU Frustum Culling Compute Shader
 * 
 * Performs frustum culling on the GPU and compacts visible instances.
 * Uses indirect drawing for efficient rendering.
 */

struct FrustumPlane {
  normal: vec3<f32>,
  d: f32,
}

struct Frustum {
  planes: array<FrustumPlane, 6>,
}

@group(0) @binding(0) var<uniform> frustum: Frustum;
@group(0) @binding(1) var<storage, read> instancePositions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(3) var<storage, read_write> visibleCount: atomic<u32>;
@group(0) @binding(4) var<storage, read_write> drawCommand: array<u32, 5>;

fn testAABBAgainstPlane(aabbMin: vec3<f32>, aabbMax: vec3<f32>, plane: FrustumPlane) -> bool {
  let px = select(aabbMin.x, aabbMax.x, plane.normal.x >= 0.0);
  let py = select(aabbMin.y, aabbMax.y, plane.normal.y >= 0.0);
  let pz = select(aabbMin.z, aabbMax.z, plane.normal.z >= 0.0);
  let distance = dot(plane.normal, vec3<f32>(px, py, pz)) + plane.d;
  return distance >= 0.0;
}

fn isInstanceVisible(instanceIndex: u32) -> bool {
  let pos = instancePositions[instanceIndex];
  let halfSize = vec3<f32>(0.5, 0.5, 0.5);
  let aabbMin = pos - halfSize;
  let aabbMax = pos + halfSize;
  
  for (var i = 0u; i < 6u; i++) {
    if (!testAABBAgainstPlane(aabbMin, aabbMax, frustum.planes[i])) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let instanceIndex = globalId.x;
  let totalInstances = arrayLength(&instancePositions);
  
  // Check bounds
  if (instanceIndex >= totalInstances) {
    return;
  }
  
  // Test visibility
  if (isInstanceVisible(instanceIndex)) {
    // Atomically increment visible count and get index
    let outputIndex = atomicAdd(&visibleCount.visibleCount, 1u);
    
    // Store visible instance index
    visibleIndices[outputIndex] = instanceIndex;
  }
}

@compute @workgroup_size(1)
fn compact(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let count = atomicLoad(&visibleCount);
  drawCommand[1] = count;
}

