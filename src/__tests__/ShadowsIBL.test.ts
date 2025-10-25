import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeCascades } from '../rendering/shadows/ShadowCascades';
import { mat4Identity, mat4Perspective, type Mat4, type Vec3 } from '@engine/core/math';
import { ShadowPass } from '../rendering/shadows/ShadowPass';
import type { GeometryData } from '../rendering/resources/resources';
import { BrdfLutPass } from '../rendering/postprocess/BrdfLut';
import { EnvironmentRenderer } from '../rendering/renderers/EnvironmentRenderer';
import { EnvironmentComponent } from '../scene/components/EnvironmentComponent';

function createBasicDeviceMock() {
  const createTexture = vi.fn((desc?: GPUTextureDescriptor) => {
    return {
      label: desc?.label,
      createView: vi.fn(() => ({})),
      destroy: vi.fn(),
    } as unknown as GPUTexture;
  });
  const createBindGroupLayout = vi.fn(() => ({}));
  const createPipelineLayout = vi.fn(() => ({}));
  const createShaderModule = vi.fn(() => ({}));
  const createRenderPipeline = vi.fn(() => ({ getBindGroupLayout: vi.fn(() => ({})) }));
  const createComputePipeline = vi.fn(() => ({}));
  const createBindGroup = vi.fn(() => ({}));

  const renderPassMock = {
    setPipeline: vi.fn(),
    setVertexBuffer: vi.fn(),
    setIndexBuffer: vi.fn(),
    setBindGroup: vi.fn(),
    drawIndexed: vi.fn(),
    setViewport: vi.fn(),
    setScissorRect: vi.fn(),
    end: vi.fn(),
  } as unknown as GPURenderPassEncoder;

  const computePassMock = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    dispatchWorkgroups: vi.fn(),
    end: vi.fn(),
  } as unknown as GPUComputePassEncoder;

  const commandEncoderMock = {
    beginRenderPass: vi.fn(() => renderPassMock),
    beginComputePass: vi.fn(() => computePassMock),
    finish: vi.fn(() => ({})),
  } as unknown as GPUCommandEncoder;

  const queue = { submit: vi.fn(), writeBuffer: vi.fn(), writeTexture: vi.fn(), onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined) } as unknown as GPUQueue;

  const deviceMock = {
    features: new Set(),
    createTexture,
    createBindGroupLayout,
    createPipelineLayout,
    createShaderModule,
    createRenderPipeline,
    createComputePipeline,
    createBindGroup,
    createCommandEncoder: vi.fn(() => commandEncoderMock),
    queue,
  } as unknown as GPUDevice;

  return { deviceMock, commandEncoderMock, renderPassMock, computePassMock, spies: { createBindGroup, createRenderPipeline, createBindGroupLayout } };
}

describe('Shadows and IBL', () => {
  describe('Shadow cascades', () => {
    it('computes 4 cascades with monotonic splits and valid matrices', () => {
      const view: Mat4 = new Float32Array(16) as Mat4;
      mat4Identity(view);
      const proj: Mat4 = new Float32Array(16) as Mat4;
      mat4Perspective(proj, Math.PI / 3, 1.6, 0.1, 100);
      const lightDir: Vec3 = [0.3, -0.7, -0.5];
      const r = computeCascades({ viewMatrix: view, projectionMatrix: proj, lightDirection: lightDir, cameraNear: 0.1, cameraFar: 100, atlasSize: 2048, cascades: 4 });
      expect(r.cascadeSplits.length).toBe(4);
      expect(r.lightViewProj.length).toBe(4);
      // monotonic and within range
      expect(r.cascadeSplits[0]).toBeGreaterThanOrEqual(0.1);
      expect(r.cascadeSplits[1]).toBeGreaterThan(r.cascadeSplits[0]);
      expect(r.cascadeSplits[2]).toBeGreaterThan(r.cascadeSplits[1]);
      expect(r.cascadeSplits[3]).toBeCloseTo(100, 3);
      // atlas rects cover four quadrants
      expect(r.atlasRects).toEqual([
        [0, 0, 0.5, 0.5],
        [0.5, 0, 1, 0.5],
        [0, 0.5, 0.5, 1],
        [0.5, 0.5, 1, 1],
      ]);
      // matrices finite
      for (const m of r.lightViewProj) {
        for (let i = 0; i < 16; i++) expect(Number.isFinite(m[i]!)).toBe(true);
      }
    });
  });

  describe('ShadowPass', () => {
    it('creates atlas and renders cascades, then rebinds material BG with shadow', () => {
      const { deviceMock, commandEncoderMock, renderPassMock, spies } = createBasicDeviceMock();
      const pass = new ShadowPass(deviceMock);

      const geometry = {
        vertices: new Uint8Array(24),
        indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
        instanceCount: 2,
        instanceOffsetData: new Float32Array(6),
        instanceColorScaleData: new Float32Array(8),
        instanceRotationData: new Float32Array(8),
        instanceMaterialIdData: new Float32Array(2),
      } as unknown as GeometryData;

      const frameResources: any = {
        vertexBuffer: { } as GPUBuffer,
        indexBuffer: { } as GPUBuffer,
        instanceOffsetBuffer: { } as GPUBuffer,
        instanceColorScaleBuffer: { } as GPUBuffer,
        instanceRotationBuffer: { } as GPUBuffer,
        instanceMaterialIdBuffer: { } as GPUBuffer,
        textureBindGroupLayout: {} as GPUBindGroupLayout,
        textureBindGroup: {} as GPUBindGroup,
        uniformBuffer: {} as GPUBuffer,
        sideTexture: (deviceMock.createTexture({}) as GPUTexture),
        normalAtlasTexture: (deviceMock.createTexture({}) as GPUTexture),
        sampler: {} as GPUSampler,
        atlasMetaBuffer: {} as GPUBuffer,
      };

      const view = new Float32Array(16) as Mat4; mat4Identity(view);
      const proj = new Float32Array(16) as Mat4; mat4Perspective(proj, Math.PI/3, 1.5, 0.1, 100);

      pass.render({
        encoder: deviceMock.createCommandEncoder(),
        frameResources,
        geometry,
        viewMatrix: view,
        projectionMatrix: proj,
        uniformManager: { updateShadowUniforms: vi.fn() },
        lightingData: { lights: [{ type: 0, direction: [0.3, -0.7, -0.5] as Vec3 }] },
      });

      expect((commandEncoderMock.beginRenderPass as any).mock.calls.length).toBeGreaterThan(0);
      expect((renderPassMock.setViewport as any).mock.calls.length).toBeGreaterThanOrEqual(4);
      // Ensure a bind group was (re)created for materials including shadow bindings
      expect(spies.createBindGroup).toHaveBeenCalled();
    });
  });

  describe('BRDF LUT compute', () => {
    it('dispatches compute and returns a texture', () => {
      const { deviceMock, computePassMock } = createBasicDeviceMock();
      const lut = new BrdfLutPass(deviceMock);
      const encoder = deviceMock.createCommandEncoder();
      const tex = lut.generate(encoder, 64);
      expect(tex).toBeDefined();
      expect((computePassMock.dispatchWorkgroups as any).mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('EnvironmentRenderer IBL', () => {
    it('prepares BRDF LUT and renders 6 faces of env cubemap', async () => {
      const { deviceMock, commandEncoderMock } = createBasicDeviceMock();
      const env = new EnvironmentRenderer();
      await env.initialize({ device: deviceMock, presentationFormat: 'rgba16float', sampleCount: 1 });
      const comp = new EnvironmentComponent();
      comp.skyboxType = 'procedural-sky';
      env.updateParams(comp);
      const { brdfLut, envCube } = await env.prepareIBLResources(16);
      expect(brdfLut).toBeDefined();
      expect(envCube).toBeDefined();
      // 6 faces -> 6 render passes
      expect((commandEncoderMock.beginRenderPass as any).mock.calls.length).toBe(6);
    });
  });
});


