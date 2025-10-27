import { GPUBufferPool } from '../core/bufferPool';

export class SkinningBufferPool {
  private readonly pool: GPUBufferPool;

  constructor(private readonly device: GPUDevice) {
    this.pool = new GPUBufferPool(device);
  }

  getOrCreate(id: string, jointCount: number): GPUBuffer {
    const byteLength = jointCount * 16 * 4; // mat4x4<f32>
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    return this.pool.getOrCreate(`skinning:${id}`, byteLength, usage, `skinning:${id}`);
  }

  update(buffer: GPUBuffer, data: Float32Array): void {
    this.device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  }

  release(id: string): void {
    this.pool.release(`skinning:${id}`);
  }

  disposeAll(): void {
    this.pool.disposeAll();
  }
}


