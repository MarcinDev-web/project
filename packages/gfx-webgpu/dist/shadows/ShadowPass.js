import { MaterialComponent } from '@engine/world';
import { computeCascades } from './ShadowCascades';
import { TIMESTAMP_INDICES } from '../config';
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
    // Shadow quality & blending
    cascadeOverlap = 0.07; // fraction of cascade range used for blending
    filterParamsRef = [2.0, 2.0 / 2048, 8.0 / 2048, 0.0];
    biasParamsRef = [0.0008, 0.01, 0.0, 0.0];
    // Metrics per cascade
    lastCascadeCounts = [0, 0, 0, 0];
    // Scratch buffers for per-cascade CPU culling (reused each frame)
    culledCapacity = 0;
    culledOffsetBuffer = null;
    culledColorScaleBuffer = null;
    culledRotationBuffer = null;
    culledMaterialIdBuffer = null;
    culledOffsetF32 = null;
    culledColorScaleF32 = null;
    culledRotationF32 = null;
    culledMaterialIdF32 = null;
    constructor(device) {
        this.device = device;
    }
    setQualityPreset(preset) {
        // Adjust PCSS radius and bias; atlas size kept constant in this iteration
        switch (preset) {
            case 'low':
                this.filterParamsRef = [1.0, 1.0 / this.atlasSize, 4.0 / this.atlasSize, 0.0];
                this.biasParamsRef = [0.0012, 0.008, 0.0, 0.0];
                this.cascadeOverlap = 0.05;
                break;
            case 'med':
                this.filterParamsRef = [2.0, 2.0 / this.atlasSize, 8.0 / this.atlasSize, 0.0];
                this.biasParamsRef = [0.0008, 0.01, 0.0, 0.0];
                this.cascadeOverlap = 0.07;
                break;
            case 'high':
                this.filterParamsRef = [3.0, 2.5 / this.atlasSize, 10.0 / this.atlasSize, 0.0];
                this.biasParamsRef = [0.0006, 0.012, 0.0, 0.0];
                this.cascadeOverlap = 0.08;
                break;
            case 'ultra':
                this.filterParamsRef = [4.0, 3.0 / this.atlasSize, 12.0 / this.atlasSize, 0.0];
                this.biasParamsRef = [0.0005, 0.014, 0.0, 0.0];
                this.cascadeOverlap = 0.1;
                break;
        }
    }
    getLastCascadeInstanceCounts() {
        return this.lastCascadeCounts;
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
struct VSOut { @builtin(position) position: vec4<f32> }
struct ShadowUniform { lightVP: mat4x4<f32> }
@group(0) @binding(0) var<uniform> sh: ShadowUniform;

fn quat_rotate(q : vec4<f32>, v : vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

@vertex
fn vs_main(
  @location(0) position : vec3<f32>,
  @location(4) instanceOffset : vec3<f32>,
  @location(5) instanceColorScale : vec4<f32>,
  @location(9) instanceRotation : vec4<f32>,
  @location(10) instanceMaterialId : f32
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
                { arrayStride: 12, stepMode: 'instance', attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x3' }] },
                { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x4' }] },
                { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 9, offset: 0, format: 'float32x4' }] },
                { arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 10, offset: 0, format: 'float32' }] },
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
                    depthBias: 1,
                    depthBiasSlopeScale: 2.5,
                    depthBiasClamp: 0.05,
                },
            });
        }
    }
    ensureCulledBuffers(capacity) {
        if (capacity <= this.culledCapacity)
            return;
        this.culledCapacity = capacity;
        const offsetsBytes = capacity * 3 * 4;
        const colorScaleBytes = capacity * 4 * 4;
        const rotationBytes = capacity * 4 * 4;
        const materialIdBytes = capacity * 4;
        this.culledOffsetF32 = new Float32Array(capacity * 3);
        this.culledColorScaleF32 = new Float32Array(capacity * 4);
        this.culledRotationF32 = new Float32Array(capacity * 4);
        this.culledMaterialIdF32 = new Float32Array(capacity);
        this.culledOffsetBuffer?.destroy?.();
        this.culledColorScaleBuffer?.destroy?.();
        this.culledRotationBuffer?.destroy?.();
        this.culledMaterialIdBuffer?.destroy?.();
        this.culledOffsetBuffer = this.device.createBuffer({
            label: 'shadow-culled-instance-offsets',
            size: offsetsBytes,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.culledColorScaleBuffer = this.device.createBuffer({
            label: 'shadow-culled-instance-colorScale',
            size: colorScaleBytes,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.culledRotationBuffer = this.device.createBuffer({
            label: 'shadow-culled-instance-rotation',
            size: rotationBytes,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.culledMaterialIdBuffer = this.device.createBuffer({
            label: 'shadow-culled-instance-materialId',
            size: materialIdBytes,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }
    rowNorm(m, row) {
        // Column-major mat: row components are m[row], m[4+row], m[8+row]
        const a = m[row + 0];
        const b = m[row + 4];
        const c = m[row + 8];
        return Math.hypot(a, b, c);
    }
    cullInstancesForCascade(lightVP, geometry) {
        const offsets = geometry.instanceOffsetData;
        const colorScale = geometry.instanceColorScaleData;
        const rotation = geometry.instanceRotationData;
        const materialParams = geometry.instanceMaterialParamsData;
        // Material IDs may be missing in older payloads; default to 0
        const materialIds = geometry.instanceMaterialIdData;
        const matIds = materialIds && materialIds.length === geometry.instanceCount ? materialIds : null;
        const outOffsets = this.culledOffsetF32;
        const outColorScale = this.culledColorScaleF32;
        const outRotation = this.culledRotationF32;
        const outMatIds = this.culledMaterialIdF32;
        const n = geometry.instanceCount;
        let outCount = 0;
        // Base mesh bounding sphere radius for unit scale cube: sqrt(3)/2
        const baseRadius = 0.8660254037844386;
        // Row norms to convert world radius -> clip radius per axis
        const nx = this.rowNorm(lightVP, 0);
        const ny = this.rowNorm(lightVP, 1);
        const nz = this.rowNorm(lightVP, 2);
        for (let i = 0; i < n; i++) {
            const flags = materialParams ? materialParams[i * 4 + 3] ?? 0 : 0;
            if (((flags | 0) & MaterialComponent.FLAG_TRANSPARENT) != 0) {
                continue;
            }
            const ox = offsets[i * 3 + 0];
            const oy = offsets[i * 3 + 1];
            const oz = offsets[i * 3 + 2];
            const scale = colorScale[i * 4 + 3] ?? 1.0;
            const radius = baseRadius * scale;
            // Clip-space position p = M * [o,1]
            const m = lightVP;
            const px = ox * m[0] + oy * m[4] + oz * m[8] + m[12];
            const py = ox * m[1] + oy * m[5] + oz * m[9] + m[13];
            const pz = ox * m[2] + oy * m[6] + oz * m[10] + m[14];
            const pw = ox * m[3] + oy * m[7] + oz * m[11] + m[15];
            const invW = pw !== 0 ? 1.0 / pw : 1.0;
            const cx = px * invW;
            const cy = py * invW;
            const cz = pz * invW;
            const rX = radius * nx;
            const rY = radius * ny;
            const rZ = radius * nz;
            if (cx < -1 - rX || cx > 1 + rX)
                continue;
            if (cy < -1 - rY || cy > 1 + rY)
                continue;
            if (cz < -1 - rZ || cz > 1 + rZ)
                continue;
            // keep instance: write attributes at outCount
            const o3 = outCount * 3;
            outOffsets[o3 + 0] = ox;
            outOffsets[o3 + 1] = oy;
            outOffsets[o3 + 2] = oz;
            const c4 = outCount * 4;
            outColorScale[c4 + 0] = colorScale[i * 4 + 0];
            outColorScale[c4 + 1] = colorScale[i * 4 + 1];
            outColorScale[c4 + 2] = colorScale[i * 4 + 2];
            outColorScale[c4 + 3] = scale;
            outRotation[c4 + 0] = rotation[i * 4 + 0];
            outRotation[c4 + 1] = rotation[i * 4 + 1];
            outRotation[c4 + 2] = rotation[i * 4 + 2];
            outRotation[c4 + 3] = rotation[i * 4 + 3];
            outMatIds[outCount] = matIds ? matIds[i] : 0;
            outCount++;
        }
        return outCount;
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
            // pcfKernelRadius, pcssLightRadiusUV, maxFilterRadiusUV, pad
            filterParams: this.filterParamsRef,
            // x: depth bias in [0..1] depth range, y: normal bias in world units
            biasParams: this.biasParamsRef,
            extraParams: [this.cascadeOverlap, 0, 0, 0],
        });
        // Ensure scratch buffers for per-cascade culling
        this.ensureCulledBuffers(params.geometry.instanceCount | 0);
        // Render all cascades in one pass into different viewports of the atlas
        const qs = params.frameResources.timestampQuerySet ?? null;
        const passDesc = {
            label: 'shadow-atlas-pass',
            colorAttachments: [],
            depthStencilAttachment: {
                view: this.atlasView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
            ...(qs
                ? {
                    timestampWrites: {
                        querySet: qs,
                        beginningOfPassWriteIndex: TIMESTAMP_INDICES.SHADOW_BEGIN,
                        endOfPassWriteIndex: TIMESTAMP_INDICES.SHADOW_END,
                    },
                }
                : {}),
        };
        const pass = params.encoder.beginRenderPass(passDesc);
        pass.setPipeline(this.pipeline);
        pass.setVertexBuffer(0, params.frameResources.vertexBuffer);
        // Vertex buffer 0 is static mesh; 1..4 will be set per cascade from culled buffers
        pass.setIndexBuffer(params.frameResources.indexBuffer, 'uint16');
        pass.setBindGroup(0, this.uniformBindGroup);
        const half = this.atlasSize >> 1;
        const viewports = [
            [0, 0], [half, 0], [0, half], [half, half],
        ];
        if (params.geometry.instanceCount > 0) {
            for (let c = 0; c < 4; c++) {
                // Upload current cascade lightVP
                const m = cascades.lightViewProj[c];
                this.device.queue.writeBuffer(this.uniformBuffer, 0, m.buffer, m.byteOffset ?? 0, 64);
                // CPU cull instances to this cascade's ortho frustum
                const visibleCount = this.cullInstancesForCascade(m, params.geometry);
                // Track metrics
                if (c === 0 || c === 1 || c === 2 || c === 3) {
                    this.lastCascadeCounts[c] = visibleCount;
                }
                if (visibleCount > 0) {
                    // Upload culled per-instance data
                    const offBytes = visibleCount * 3 * 4;
                    const colBytes = visibleCount * 4 * 4;
                    const rotBytes = visibleCount * 4 * 4;
                    const matBytes = visibleCount * 4;
                    this.device.queue.writeBuffer(this.culledOffsetBuffer, 0, this.culledOffsetF32.buffer, 0, offBytes);
                    this.device.queue.writeBuffer(this.culledColorScaleBuffer, 0, this.culledColorScaleF32.buffer, 0, colBytes);
                    this.device.queue.writeBuffer(this.culledRotationBuffer, 0, this.culledRotationF32.buffer, 0, rotBytes);
                    this.device.queue.writeBuffer(this.culledMaterialIdBuffer, 0, this.culledMaterialIdF32.buffer, 0, matBytes);
                    // Bind culled buffers for this cascade
                    pass.setVertexBuffer(1, this.culledOffsetBuffer);
                    pass.setVertexBuffer(2, this.culledColorScaleBuffer);
                    pass.setVertexBuffer(3, this.culledRotationBuffer);
                    pass.setVertexBuffer(4, this.culledMaterialIdBuffer);
                    const [vx, vy] = viewports[c];
                    pass.setViewport(vx, vy, half, half, 0, 1);
                    pass.setScissorRect(vx, vy, half, half);
                    pass.drawIndexed(params.geometry.indices.length, visibleCount, 0, 0, 0);
                }
            }
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