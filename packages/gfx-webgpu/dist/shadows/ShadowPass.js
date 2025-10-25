import { computeCascades } from './ShadowCascades';
import { Z_NEAR, Z_FAR } from '../config';
export class ShadowPass {
    device;
    atlas = null;
    atlasView = null;
    pipeline = null;
    uniformLayout = null;
    uniformBuffer = null;
    uniformBindGroup = null;
    comparisonSampler = null;
    atlasSize = 2048;
    constructor(device) {
        this.device = device;
    }
    ensureResources() {
        if (!this.atlas) {
            this.atlas = this.device.createTexture({
                label: 'shadow-atlas',
                size: [this.atlasSize, this.atlasSize, 1],
                format: 'depth32float',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            });
            this.atlasView = this.atlas.createView({ label: 'shadow-atlas-view' });
        }
        if (!this.uniformLayout) {
            this.uniformLayout = this.device.createBindGroupLayout({
                label: 'shadow-pass-uniform-layout',
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
                ],
            });
        }
        if (!this.uniformBuffer) {
            this.uniformBuffer = this.device.createBuffer({
                label: 'shadow-pass-uniform',
                size: 64, // single mat4x4
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
        }
        if (!this.uniformBindGroup && this.uniformLayout && this.uniformBuffer) {
            this.uniformBindGroup = this.device.createBindGroup({
                label: 'shadow-pass-uniform-bg',
                layout: this.uniformLayout,
                entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
            });
        }
        if (!this.comparisonSampler) {
            this.comparisonSampler = this.device.createSampler({
                label: 'shadow-comparison-sampler-main',
                compare: 'less-equal',
                magFilter: 'linear',
                minFilter: 'linear',
            });
        }
        if (!this.pipeline) {
            const shader = this.device.createShaderModule({
                label: 'shadow-pass-shader',
                code: /* wgsl */ `
struct VSOut { @builtin(position) position: vec4<f32>; };
struct ShadowUniform { lightVP: mat4x4<f32>; };
@group(0) @binding(0) var<uniform> sh: ShadowUniform;

fn quat_rotate(q : vec4<f32>, v : vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

@vertex
fn vs_main(
  @location(0) position : vec3<f32>,
  @location(1) instanceOffset : vec3<f32>,
  @location(4) instanceColorScale : vec4<f32>,
  @location(5) instanceRotation : vec4<f32>
) -> VSOut {
  var o: VSOut;
  let scale = instanceColorScale.w;
  let q = normalize(instanceRotation);
  let worldPos = quat_rotate(q, position * scale) + instanceOffset;
  o.position = sh.lightVP * vec4<f32>(worldPos, 1.0);
  return o;
}
`,
            });
            const pipelineLayout = this.device.createPipelineLayout({
                label: 'shadow-pass-pl',
                bindGroupLayouts: [this.uniformLayout],
            });
            // Vertex buffer layouts must match main geometry buffers
            const vertexBuffers = [
                { arrayStride: 24, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                { arrayStride: 12, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x4' }] },
                { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x4' }] },
                { arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 6, offset: 0, format: 'float32' }] },
            ];
            this.pipeline = this.device.createRenderPipeline({
                label: 'shadow-pass-pipeline',
                layout: pipelineLayout,
                vertex: { module: shader, entryPoint: 'vs_main', buffers: vertexBuffers },
                primitive: { topology: 'triangle-list', cullMode: 'back' },
                depthStencil: {
                    format: 'depth32float',
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                    depthBias: 2,
                    depthBiasSlopeScale: 2,
                },
            });
        }
    }
    render(params) {
        this.ensureResources();
        if (!this.pipeline || !this.atlas || !this.atlasView || !this.uniformBuffer || !this.uniformBindGroup)
            return;
        // Derive primary directional light direction
        let lightDir = [0.3, -0.7, -0.5];
        const dir = params.lightingData?.lights.find((l) => l.type === 0);
        if (dir && Array.isArray(dir.direction)) {
            const d = dir.direction;
            const len = Math.hypot(d[0], d[1], d[2]) || 1;
            lightDir = [d[0] / len, d[1] / len, d[2] / len];
        }
        // Compute cascades
        const cascades = computeCascades({
            viewMatrix: params.viewMatrix,
            projectionMatrix: params.projectionMatrix,
            lightDirection: lightDir,
            cameraNear: Z_NEAR,
            cameraFar: Z_FAR,
            atlasSize: this.atlasSize,
            cascades: 4,
        });
        // Write shadow uniforms into the main uniform buffer
        params.uniformManager.updateShadowUniforms({
            viewMatrix: params.viewMatrix,
            lightViewProj: cascades.lightViewProj,
            cascadeSplits: cascades.cascadeSplits,
            atlasRects: cascades.atlasRects,
            filterParams: [2.0, 1.5 / this.atlasSize, 8.0 / this.atlasSize, 0.0], // pcfKernelRadius, pcssLightRadiusUV, maxFilterRadiusUV, pad
            biasParams: [0.0015, 0.0025, 0.0, 0.0],
        });
        // Render all cascades in one pass into different viewports of the atlas
        const pass = params.encoder.beginRenderPass({
            label: 'shadow-atlas-pass',
            colorAttachments: [],
            depthStencilAttachment: {
                view: this.atlasView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });
        pass.setPipeline(this.pipeline);
        pass.setVertexBuffer(0, params.frameResources.vertexBuffer);
        pass.setVertexBuffer(1, params.frameResources.instanceOffsetBuffer);
        pass.setVertexBuffer(2, params.frameResources.instanceColorScaleBuffer);
        pass.setVertexBuffer(3, params.frameResources.instanceRotationBuffer);
        pass.setVertexBuffer(4, params.frameResources.instanceMaterialIdBuffer);
        pass.setIndexBuffer(params.frameResources.indexBuffer, 'uint16');
        pass.setBindGroup(0, this.uniformBindGroup);
        const half = this.atlasSize >> 1;
        const viewports = [
            [0, 0], [half, 0], [0, half], [half, half],
        ];
        for (let c = 0; c < 4; c++) {
            // Upload current cascade lightVP
            const m = cascades.lightViewProj[c];
            this.device.queue.writeBuffer(this.uniformBuffer, 0, m.buffer, m.byteOffset ?? 0, 64);
            const [vx, vy] = viewports[c];
            pass.setViewport(vx, vy, half, half, 0, 1);
            pass.setScissorRect(vx, vy, half, half);
            pass.drawIndexed(params.geometry.indices.length, params.geometry.instanceCount, 0, 0, 0);
        }
        pass.end();
        // Recreate material bind group to swap in the real shadow atlas + comparison sampler
        try {
            const newBg = this.device.createBindGroup({
                label: 'material-atlas-bg+shadow',
                layout: params.frameResources.textureBindGroupLayout,
                entries: [
                    { binding: 0, resource: params.frameResources.sampler },
                    { binding: 1, resource: params.frameResources.sideTexture.createView({ label: 'atlas-texture-view' }) },
                    { binding: 2, resource: params.frameResources.normalAtlasTexture.createView({ label: 'atlas-normal-texture-view' }) },
                    ...(params.frameResources.atlasMetaBuffer ? [{ binding: 3, resource: { buffer: params.frameResources.atlasMetaBuffer } }] : []),
                    { binding: 4, resource: this.atlas.createView({ label: 'shadow-atlas-depth-view' }) },
                    { binding: 5, resource: this.comparisonSampler },
                    { binding: 6, resource: (params.ibl?.brdfLut ?? this.device.createTexture({ label: 'brdf-lut-fallback', size: [4, 4, 1], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING })).createView() },
                    { binding: 7, resource: (params.ibl?.envCube ?? this.device.createTexture({ label: 'env-cube-fallback', size: [1, 1, 6], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING })).createView({ dimension: 'cube' }) },
                ],
            });
            params.frameResources.textureBindGroup = newBg;
        }
        catch {
            // If layout mismatch occurs in a test environment, keep placeholder bind group
        }
    }
}
//# sourceMappingURL=ShadowPass.js.map