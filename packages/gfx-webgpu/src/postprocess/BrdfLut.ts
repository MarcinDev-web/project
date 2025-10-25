export class BrdfLutPass {
  private device: GPUDevice;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private lutTexture: GPUTexture | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  initialize(size = 256): void {
    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'brdf-lut-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } },
        ],
      });
    }
    if (!this.pipeline) {
      const shader = this.device.createShaderModule({
        label: 'brdf-lut-compute',
        code: /* wgsl */ `
struct Push { size: vec2<u32>; };
@group(0) @binding(0) var destTex : texture_storage_2d<rgba16float, write>;

fn hammersley(i: u32, n: u32) -> vec2<f32> {
  var bits = i;
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  let rdi = f32(bits) * 2.3283064365386963e-10; // 1/2^32
  return vec2<f32>(f32(i)/f32(n), rdi);
}

fn ggxSampleHemisphere(u: vec2<f32>, roughness: f32) -> vec3<f32> {
  let a = roughness * roughness;
  let phi = 6.2831853 * u.x;
  let cosTheta = sqrt((1.0 - u.y) / (1.0 + (a*a - 1.0) * u.y));
  let sinTheta = sqrt(max(1.0 - cosTheta * cosTheta, 0.0));
  return vec3<f32>(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
}

fn geometrySmithGGX(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  let g1v = NdotV / max(NdotV * (1.0 - k) + k, 1e-4);
  let g1l = NdotL / max(NdotL * (1.0 - k) + k, 1e-4);
  return g1v * g1l;
}

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let size = textureDimensions(destTex);
  if (gid.x >= size.x || gid.y >= size.y) { return; }
  let uv = (vec2<f32>(gid.xy) + vec2<f32>(0.5, 0.5)) / vec2<f32>(size);
  let NdotV = uv.x; // [0,1]
  let roughness = uv.y; // [0,1]

  // Construct view vector from NdotV
  let N = vec3<f32>(0.0, 0.0, 1.0);
  let V = vec3<f32>(sqrt(max(1.0 - NdotV*NdotV, 0.0)), 0.0, NdotV);

  var A = 0.0;
  var B = 0.0;
  let sampleCount = 64u;
  for (var i = 0u; i < sampleCount; i++) {
    let Xi = hammersley(i, sampleCount);
    let H = ggxSampleHemisphere(Xi, roughness);
    let L = normalize(2.0 * dot(V, H) * H - V);
    let NdotL = max(L.z, 0.0);
    let NdotH = max(H.z, 0.0);
    let VdotH = max(dot(V, H), 0.0);
    if (NdotL > 0.0) {
      let G = geometrySmithGGX(NdotV, NdotL, roughness);
      let Gv = (G * VdotH) / max(NdotH * NdotV, 1e-4);
      let Fc = pow(1.0 - VdotH, 5.0);
      A += (1.0 - Fc) * Gv;
      B += Fc * Gv;
    }
  }
  A /= f32(sampleCount);
  B /= f32(sampleCount);
  textureStore(destTex, vec2<i32>(gid.xy), vec4<f32>(A, B, 0.0, 1.0));
}
`,
      });
      this.pipeline = this.device.createComputePipeline({
        label: 'brdf-lut-pipeline',
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout!] }),
        compute: { module: shader, entryPoint: 'main' },
      });
    }

    if (!this.lutTexture) {
      this.lutTexture = this.device.createTexture({
        label: 'brdf-lut',
        size: [size, size, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });
    }
  }

  generate(encoder: GPUCommandEncoder, size = 256): GPUTexture {
    this.initialize(size);
    const bindGroup = this.device.createBindGroup({
      label: 'brdf-lut-bg',
      layout: this.bindGroupLayout!,
      entries: [ { binding: 0, resource: this.lutTexture!.createView() } ],
    });
    const pass = encoder.beginComputePass({ label: 'brdf-lut-compute-pass' });
    pass.setPipeline(this.pipeline!);
    pass.setBindGroup(0, bindGroup);
    const groupsX = Math.ceil(size / 8);
    const groupsY = Math.ceil(size / 8);
    pass.dispatchWorkgroups(groupsX, groupsY, 1);
    pass.end();
    return this.lutTexture!;
  }
}


