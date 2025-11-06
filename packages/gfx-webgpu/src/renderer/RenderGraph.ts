/**
 * Render Graph
 * 
 * Minimal render graph for organizing render passes and managing transient textures.
 * Provides dependency tracking and resource lifetime management.
 */

/**
 * Texture resource handle in the render graph.
 */
export interface RenderTexture {
  texture: GPUTexture;
  view: GPUTextureView;
  format: GPUTextureFormat;
  width: number;
  height: number;
  sampleCount: number;
}

/**
 * Render pass node in the render graph.
 */
export interface RenderPassNode {
  /** Unique identifier for this pass */
  id: string;
  /** Pass type: 'compute', 'render', 'present' */
  type: 'compute' | 'render' | 'present';
  /** Input textures (read) */
  inputs: string[];
  /** Output textures (written) */
  outputs: string[];
  /** Execute function for this pass */
  execute: (encoder: GPUCommandEncoder, resources: Map<string, RenderTexture>) => void;
}

/**
 * Minimal render graph implementation.
 * 
 * Manages render passes and their dependencies, handles transient texture lifecycle.
 */
export class RenderGraph {
  private device: GPUDevice;
  private passes: RenderPassNode[] = [];
  private textures: Map<string, RenderTexture> = new Map();
  private transientTextures: Set<string> = new Set();
  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Registers a transient texture (created/destroyed per frame).
   */
  registerTransientTexture(
    id: string,
    format: GPUTextureFormat,
    width: number,
    height: number,
    sampleCount = 1
  ): void {
    this.transientTextures.add(id);
    // Texture will be created on first use
  }

  /**
   * Gets or creates a transient texture.
   */
  private getOrCreateTexture(
    id: string,
    format: GPUTextureFormat,
    width: number,
    height: number,
    sampleCount: number
  ): RenderTexture {
    const existing = this.textures.get(id);
    if (existing && existing.width === width && existing.height === height) {
      return existing;
    }

    // Destroy old texture if it exists
    if (existing) {
      existing.texture.destroy();
    }

    // Create new texture
    const texture = this.device.createTexture({
      label: `render-graph-${id}`,
      size: { width, height, depthOrArrayLayers: 1 },
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      sampleCount,
    });

    const view = texture.createView({
      label: `render-graph-${id}-view`,
    });

    const resource: RenderTexture = {
      texture,
      view,
      format,
      width,
      height,
      sampleCount,
    };

    this.textures.set(id, resource);
    return resource;
  }

  /**
   * Adds a render pass to the graph.
   */
  addPass(pass: RenderPassNode): void {
    this.passes.push(pass);
  }

  /**
   * Sets canvas dimensions (for resizing transient textures).
   */
  setCanvasSize(width: number, height: number): void {
    if (this.canvasWidth === width && this.canvasHeight === height) {
      return;
    }

    this.canvasWidth = width;
    this.canvasHeight = height;

    // Invalidate transient textures (will be recreated on next frame)
    for (const id of this.transientTextures) {
      const texture = this.textures.get(id);
      if (texture) {
        texture.texture.destroy();
        this.textures.delete(id);
      }
    }
  }

  /**
   * Performs topological sort of render passes based on texture dependencies.
   * Uses Kahn's algorithm to order passes so that producers execute before consumers.
   * 
   * @returns Sorted passes in dependency order, or null if cycle detected
   */
  private topologicalSort(): RenderPassNode[] | null {
    if (this.passes.length === 0) {
      return [];
    }

    // Build dependency graph: pass A depends on pass B if A reads a texture that B writes
    const passIndex = new Map<string, number>();
    this.passes.forEach((pass, index) => {
      passIndex.set(pass.id, index);
    });

    // Build texture -> producer pass mapping
    const textureProducers = new Map<string, RenderPassNode[]>();
    for (const pass of this.passes) {
      for (const outputId of pass.outputs) {
        if (!textureProducers.has(outputId)) {
          textureProducers.set(outputId, []);
        }
        textureProducers.get(outputId)!.push(pass);
      }
    }

    // Calculate in-degree for each pass (how many passes it depends on)
    const inDegree = new Array<number>(this.passes.length).fill(0);
    const dependencies: number[][] = new Array(this.passes.length).fill(null).map(() => []);

    for (let i = 0; i < this.passes.length; i++) {
      const pass = this.passes[i];
      for (const inputId of pass.inputs) {
        const producers = textureProducers.get(inputId);
        if (producers) {
          for (const producer of producers) {
            const producerIndex = passIndex.get(producer.id);
            if (producerIndex !== undefined && producerIndex !== i) {
              // Pass i depends on producer
              dependencies[producerIndex].push(i);
              inDegree[i]++;
            }
          }
        }
      }
    }

    // Kahn's algorithm: start with passes that have no dependencies
    const queue: number[] = [];
    for (let i = 0; i < inDegree.length; i++) {
      if (inDegree[i] === 0) {
        queue.push(i);
      }
    }

    const sorted: RenderPassNode[] = [];
    let processedCount = 0;

    while (queue.length > 0) {
      const currentIndex = queue.shift()!;
      const currentPass = this.passes[currentIndex];
      sorted.push(currentPass);
      processedCount++;

      // Reduce in-degree of dependent passes
      for (const dependentIndex of dependencies[currentIndex]) {
        inDegree[dependentIndex]--;
        if (inDegree[dependentIndex] === 0) {
          queue.push(dependentIndex);
        }
      }
    }

    // If we didn't process all passes, there's a cycle
    if (processedCount !== this.passes.length) {
      return null;
    }

    return sorted;
  }

  /**
   * Executes all passes in dependency order using topological sort.
   */
  execute(encoder: GPUCommandEncoder): void {
    // First, ensure all transient textures are created
    // We need to do this before sorting to know which textures exist
    for (const pass of this.passes) {
      for (const outputId of pass.outputs) {
        if (this.transientTextures.has(outputId) && !this.textures.has(outputId)) {
          // Default format - should be specified when registering transient texture
          // For now, use a reasonable default
          this.getOrCreateTexture(outputId, 'rgba16float', this.canvasWidth, this.canvasHeight, 1);
        }
      }
    }

    // Perform topological sort
    let sortedPasses = this.topologicalSort();
    
    if (sortedPasses === null) {
      console.error('[RenderGraph] Cycle detected in render pass dependencies. Execution order may be incorrect.');
      // Fallback to original order (may cause incorrect rendering)
      sortedPasses = this.passes;
    }

    // Execute passes in sorted order
    for (const pass of sortedPasses) {
      // Ensure all input textures exist
      for (const inputId of pass.inputs) {
        if (!this.textures.has(inputId)) {
          // Try to get from transient set
          if (this.transientTextures.has(inputId)) {
            // Get format from first pass that outputs this texture
            const outputPass = sortedPasses.find((p) => p.outputs.includes(inputId));
            if (outputPass) {
              // Default format - will be set by pass that creates it
              this.getOrCreateTexture(inputId, 'rgba16float', this.canvasWidth, this.canvasHeight, 1);
            }
          }
        }
      }

      pass.execute(encoder, this.textures);
    }

    // Clear passes after execution (they're re-added each frame)
    this.passes = [];
  }

  /**
   * Gets a texture resource by ID.
   */
  getTexture(id: string): RenderTexture | undefined {
    return this.textures.get(id);
  }

  /**
   * Sets an external texture (not managed by render graph).
   */
  setTexture(id: string, texture: RenderTexture): void {
    this.textures.set(id, texture);
  }

  /**
   * Cleans up all transient textures.
   */
  dispose(): void {
    for (const texture of this.textures.values()) {
      texture.texture.destroy();
    }
    this.textures.clear();
    this.transientTextures.clear();
    this.passes = [];
  }
}

