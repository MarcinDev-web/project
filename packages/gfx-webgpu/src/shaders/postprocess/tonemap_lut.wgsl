@group(0) @binding(0) var srcTex : texture_2d<f16>;
@group(0) @binding(1) var srcSmp : sampler;
@group(0) @binding(2) var lut3d : texture_3d<f32>;
@group(0) @binding(3) var bloomTex : texture_2d<f16>;

struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex fn vs_fullscreen(@builtin(vertex_index) vid : u32) -> VSOut {
  var out : VSOut;
  let x = f32((vid << 1u) & 2u);
  let y = f32(vid & 2u);
  out.pos = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
  out.uv = vec2<f32>(x, y);
  return out;
}

@fragment fn fs_main(@location(0) v_uv:vec2<f32>) -> @location(0) vec4<f32> {
  var hdr = vec3<f32>(textureSample(srcTex, srcSmp, v_uv).xyz);
  let bloom = vec3<f32>(textureSample(bloomTex, srcSmp, v_uv).xyz);
  hdr += bloom; // simple additive bloom
  let lutc = textureSampleLevel(lut3d, srcSmp, clamp(hdr, vec3(0.0), vec3(1.0)), 0.0).xyz;
  // ACES (Narkowicz)
  let a=2.51; let b=0.03; let c=2.43; let d=0.59; let e=0.14;
  let aces = clamp((lutc*(a*lutc+b))/(lutc*(c*lutc+d)+e), vec3(0.0), vec3(1.0));
  return vec4<f32>(pow(aces, vec3(1.0/2.2)), 1.0);
}


