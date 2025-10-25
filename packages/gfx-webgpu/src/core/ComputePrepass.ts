/**
 * Minimal compute prepass to demonstrate WebGPU compute integration.
 *
 * The pass writes a constant value into a small storage buffer. It does not
 * currently feed back into the render pipeline, serving as a foundation for
 * future GPU-side preprocessing (culling, clustering, etc.).
 */

const COMPUTE_SHADER_CODE = /* wgsl */ `
struct Data {
  value: u32,
};

@group(0) @binding(0) var<storage, read_write> data: Data;

@compute @workgroup_size(1)
fn main() {
  // Minimal side effect to validate compute execution
  data.value = 1u;
}
`;

export class ComputePrepass {
  private readonly device: GPUDevice;
  private readonly pipeline: GPUComputePipeline | null;
  private readonly bindGroup: GPUBindGroup | null;
  private readonly outputBuffer: GPUBuffer | null;

  constructor(device: GPUDevice) {
    this.device = device;

    try {
      const shaderModule = this.device.createShaderModule({
        label: 'compute-prepass-shader',
        code: COMPUTE_SHADER_CODE,
      });

      const bindGroupLayout = this.device.createBindGroupLayout({
        label: 'compute-prepass-bgl',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' },
          },
        ],
      });

      const pipelineLayout = this.device.createPipelineLayout({
        label: 'compute-prepass-pipeline-layout',
        bindGroupLayouts: [bindGroupLayout],
      });

      if (typeof (this.device as any).createComputePipeline === 'function') {
        this.pipeline = this.device.createComputePipeline({
          label: 'compute-prepass-pipeline',
          layout: pipelineLayout,
          compute: {
            module: shaderModule,
            entryPoint: 'main',
          },
        });
      } else {
        this.pipeline = null;
      }

      if (this.pipeline) {
        this.outputBuffer = this.device.createBuffer({
          label: 'compute-prepass-output',
          size: 4,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = this.device.createBindGroup({
          label: 'compute-prepass-bg',
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: { buffer: this.outputBuffer },
            },
          ],
        });
      } else {
        this.outputBuffer = null;
        this.bindGroup = null;
      }
    } catch {
      this.pipeline = null;
      this.bindGroup = null;
      this.outputBuffer = null;
    }
  }

  run(encoder: GPUCommandEncoder): void {
    const pass = encoder.beginComputePass({ label: 'compute-prepass' });
    try {
      if (this.pipeline && this.bindGroup) {
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
    if (typeof pass.dispatchWorkgroups === 'function') {
      pass.dispatchWorkgroups(1);
    }
      }
      // If pipeline is not available, skip compute prepass silently.
    } finally {
      pass.end();
    }
  }

  dispose(): void {
    try {
      this.outputBuffer?.destroy();
    } catch {
      // ignore
    }
    // Pipeline and bind group are freed with device; explicit destroy not required.
  }
}


