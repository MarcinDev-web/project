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
   * Executes all passes in dependency order.
   */
  execute(encoder: GPUCommandEncoder): void {
    // Sort passes by dependencies (simple topological sort)
    // For now, execute in order added (passes should be added in dependency order)
    // TODO: Implement proper topological sort

    for (const pass of this.passes) {
      // Ensure all input textures exist
      for (const inputId of pass.inputs) {
        if (!this.textures.has(inputId)) {
          // Try to get from transient set
          if (this.transientTextures.has(inputId)) {
            // Get format from first pass that outputs this texture
            const outputPass = this.passes.find((p) => p.outputs.includes(inputId));
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

