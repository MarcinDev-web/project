struct SkinningUniforms { jointCount: u32; };
@group(1) @binding(0) var<uniform> skn: SkinningUniforms;
@group(1) @binding(1) var<storage, read> jointMats : array<mat4x4<f32>>;

fn applySkinning(pos: vec4<f32>, idx: vec4<u32>, w: vec4<f32>) -> vec4<f32> {
  let m0 = jointMats[idx.x];
  let m1 = jointMats[idx.y];
  let m2 = jointMats[idx.z];
  let m3 = jointMats[idx.w];
  let skinned = (m0 * pos) * w.x + (m1 * pos) * w.y + (m2 * pos) * w.z + (m3 * pos) * w.w;
  return skinned;
}


