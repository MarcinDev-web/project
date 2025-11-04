/**
 * Pipeline Cache
 * 
 * Caches GPU render and compute pipelines to avoid recompilation.
 * Reduces shader compilation overhead in hot paths.
 */

/**
 * Cache key for pipeline lookup.
 */
interface PipelineKey {
  vertexShader: string;
  fragmentShader?: string;
  computeShader?: string;
  vertexBuffers: string; // Serialized layout
  blendState: string; // Serialized blend state
  depthStencil: string; // Serialized depth/stencil state
  format: string;
  sampleCount: number;
}

/**
 * Pipeline cache for render and compute pipelines.
 */
export class PipelineCache {
  private device: GPUDevice;
  private renderPipelines: Map<string, GPURenderPipeline> = new Map();
  private computePipelines: Map<string, GPUComputePipeline> = new Map();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Creates a cache key from pipeline descriptor.
   */
  private createRenderKey(descriptor: GPURenderPipelineDescriptor): string {
    const vs = descriptor.vertex?.module?.label ?? 'unknown-vs';
    const fs = descriptor.fragment?.module?.label ?? 'unknown-fs';
    const targets = descriptor.fragment?.targets ? Array.from(descriptor.fragment.targets) : [];
    const firstTarget = targets[0];
    const format = firstTarget?.format ?? 'unknown';
    const sampleCount = descriptor.multisample?.count ?? 1;

    // Serialize key components
    const key: PipelineKey = {
      vertexShader: vs,
      fragmentShader: fs,
      vertexBuffers: JSON.stringify(descriptor.vertex?.buffers ?? []),
      blendState: JSON.stringify(firstTarget?.blend ?? {}),
      depthStencil: JSON.stringify(descriptor.depthStencil ?? {}),
      format,
      sampleCount,
    };

    return JSON.stringify(key);
  }

  /**
   * Gets or creates a render pipeline.
   */
  getRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline {
    const key = this.createRenderKey(descriptor);
    
    const cached = this.renderPipelines.get(key);
    if (cached) {
      return cached;
    }

    const pipeline = this.device.createRenderPipeline(descriptor);
    this.renderPipelines.set(key, pipeline);
    return pipeline;
  }

  /**
   * Creates a cache key from compute pipeline descriptor.
   */
  private createComputeKey(descriptor: GPUComputePipelineDescriptor): string {
    const cs = descriptor.compute?.module?.label ?? 'unknown-cs';
    const entryPoint = descriptor.compute?.entryPoint ?? 'main';
    return `${cs}:${entryPoint}`;
  }

  /**
   * Gets or creates a compute pipeline.
   */
  getComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline {
    const key = this.createComputeKey(descriptor);
    
    const cached = this.computePipelines.get(key);
    if (cached) {
      return cached;
    }

    const pipeline = this.device.createComputePipeline(descriptor);
    this.computePipelines.set(key, pipeline);
    return pipeline;
  }

  /**
   * Clears the cache.
   */
  clear(): void {
    // Note: Pipelines are GPU resources, but we don't destroy them here
    // as they may still be in use. The device will clean them up.
    this.renderPipelines.clear();
    this.computePipelines.clear();
  }

  /**
   * Gets cache statistics.
   */
  getStats(): { renderPipelines: number; computePipelines: number } {
    return {
      renderPipelines: this.renderPipelines.size,
      computePipelines: this.computePipelines.size,
    };
  }
}

