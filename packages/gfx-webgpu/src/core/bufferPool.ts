export interface BufferRecord {
  buffer: GPUBuffer;
  capacity: number; // in bytes
  usage: GPUBufferUsageFlags;
}

function nextCapacity(minSize: number): number {
  // Grow exponentially to reduce realloc churn; minimum 256 bytes
  const min = Math.max(minSize, 256);
  let cap = 256;
  while (cap < min) cap <<= 1;
  return cap;
}

export class GPUBufferPool {
  private readonly buffers = new Map<string, BufferRecord>();

  constructor(private readonly device: GPUDevice) {}

  getOrCreate(name: string, size: number, usage: GPUBufferUsageFlags, label?: string): GPUBuffer {
    const existing = this.buffers.get(name);
    if (existing && existing.usage === usage && existing.capacity >= size) {
      return existing.buffer;
    }
    const capacity = nextCapacity(size);
    const buffer = this.device.createBuffer({
      label: label ?? name,
      size: capacity,
      usage,
    });
    // Destroy previous if present
    if (existing) {
      try {
        existing.buffer.destroy();
      } catch {
        // ignore destroy errors
      }
    }
    this.buffers.set(name, { buffer, capacity, usage });
    return buffer;
  }

  get(name: string): GPUBuffer | null {
    return this.buffers.get(name)?.buffer ?? null;
  }

  disposeAll(): void {
    for (const rec of this.buffers.values()) {
      try {
        rec.buffer.destroy();
      } catch {
        // ignore destroy errors
      }
    }
    this.buffers.clear();
  }
}
