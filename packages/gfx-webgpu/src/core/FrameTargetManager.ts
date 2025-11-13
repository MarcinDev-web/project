import { createDepthTexture, createMsaaColorTarget, createHdrColorTarget } from '../resources/resources';
import type { FrameRenderContext } from './FrameRenderer';
import type { FrameResources } from '../resources/resources';
import { MSAA_SAMPLE_COUNT } from '../config';
import { Logger } from '@engine/core/utils';

export interface FrameTargetConfig {
  enableHDR: boolean;
  enableBloom: boolean;
  enableSSAO: boolean;
  enableFXAA: boolean;
  enableOutlines?: boolean;
  sampleCount: number;
}

export interface FrameTargetState {
  msaaView: GPUTextureView;
  hdrView: GPUTextureView | null;
  bloomView: GPUTextureView | null;
  normalView: GPUTextureView | null;
  ssaoView: GPUTextureView | null;
  resolvedDepthView: GPUTextureView | null;
  tonemapIntermediateView: GPUTextureView | null;
  needsDepthStore: boolean;
}

interface Size {
  width: number;
  height: number;
}

export class FrameTargetManager {
  private size: Size = { width: 0, height: 0 };
  private hdrColorTexture: GPUTexture | null = null;
  private hdrColorView: GPUTextureView | null = null;
  private hdrSize: Size | null = null;
  private bloomTexture: GPUTexture | null = null;
  private bloomTextureView: GPUTextureView | null = null;
  private bloomSize: Size | null = null;
  private normalTexture: GPUTexture | null = null;
  private normalTextureView: GPUTextureView | null = null;
  private normalSize: Size | null = null;
  private ssaoTexture: GPUTexture | null = null;
  private ssaoTextureView: GPUTextureView | null = null;
  private ssaoSize: Size | null = null;
  private resolvedDepthTexture: GPUTexture | null = null;
  private resolvedDepthView: GPUTextureView | null = null;
  private resolvedDepthSize: Size | null = null;
  private tonemapTexture: GPUTexture | null = null;
  private tonemapView: GPUTextureView | null = null;
  private tonemapSize: Size | null = null;
  private pendingDestroy: GPUTexture[] = [];
  // Track active encoders and textures they use to prevent premature destruction
  private activeEncoders: WeakMap<GPUCommandEncoder, Set<GPUTexture>> = new WeakMap();
  // Track all textures currently in use by any active encoder (for fast lookup)
  private texturesInUse: Set<GPUTexture> = new Set();

  ensureTargets(
    ctx: FrameRenderContext,
    frameResources: FrameResources,
    config: Partial<FrameTargetConfig> = {}
  ): FrameTargetState {
    const device = ctx.device;
    const configuredDevice = ctx.configuredDevice ?? device;
    
    // Ensure device matches - if not, textures from previous device are invalid
    if (device !== configuredDevice) {
      Logger.warn('[FrameTargetManager] Device mismatch - clearing all targets');
      // Clear active encoders - they're from old device and invalid
      this.activeEncoders = new WeakMap();
      this.texturesInUse.clear();
      // Destroy textures safely (only those not in use)
      this.flushImmediate();
      this.releaseHdrResources();
      this.releaseNormalResources();
      this.releaseSsaoResources();
      this.queueDestroy(this.tonemapTexture);
      this.tonemapTexture = null;
      this.tonemapView = null;
      this.tonemapSize = null;
      this.size = { width: 0, height: 0 };
    }
    
    const canvas = ctx.canvas;

    const sampleCount = config.sampleCount ?? ctx.msaaSampleCount ?? MSAA_SAMPLE_COUNT;
    const enableHDR = config.enableHDR ?? ctx.featureFlags?.enableHDR !== false;
    const enableBloom = config.enableBloom ?? ctx.featureFlags?.enableBloom !== false;
    const enableSSAO = config.enableSSAO ?? ctx.featureFlags?.enableSSAO !== false;
    const enableFXAA = config.enableFXAA ?? ctx.featureFlags?.enableFXAA === true;
    const enableOutlines = config.enableOutlines ?? ctx.featureFlags?.enableOutlines === true;
    const needsNormalTexture = enableSSAO || enableOutlines;

    const sizeChanged = this.size.width !== canvas.width || this.size.height !== canvas.height;

    if (sizeChanged) {
      // Queue old textures for destruction AFTER current frame completes
      // Don't destroy immediately as they might still be in use
      this.queueDestroy(frameResources.depthTexture);
      this.queueDestroy(frameResources.msaaColorTexture);
      this.queueDestroy(this.hdrColorTexture);
      this.queueDestroy(this.bloomTexture);
      this.queueDestroy(this.normalTexture);
      this.queueDestroy(this.ssaoTexture);
      this.queueDestroy(this.resolvedDepthTexture);
      this.queueDestroy(this.tonemapTexture);
      
      // Clear references immediately so new textures are created
      this.hdrColorTexture = null;
      this.hdrColorView = null;
      this.hdrSize = null;
      this.bloomTexture = null;
      this.bloomTextureView = null;
      this.bloomSize = null;
      this.normalTexture = null;
      this.normalTextureView = null;
      this.normalSize = null;
      this.ssaoTexture = null;
      this.ssaoTextureView = null;
      this.ssaoSize = null;
      this.resolvedDepthTexture = null;
      this.resolvedDepthView = null;
      this.resolvedDepthSize = null;
      this.tonemapTexture = null;
      this.tonemapView = null;
      this.tonemapSize = null;

      // Create new textures with current device
      frameResources.depthTexture = createDepthTexture(configuredDevice, canvas, sampleCount);
      frameResources.depthTextureView = frameResources.depthTexture.createView({
        label: 'frame-depth-view',
      });
      frameResources.msaaColorTexture = createMsaaColorTarget(
        configuredDevice,
        canvas,
        'rgba16float',
        sampleCount
      );
      frameResources.msaaColorView = frameResources.msaaColorTexture.createView({
        label: 'frame-msaa-color-view',
      });

      this.size = { width: canvas.width, height: canvas.height };
    }

    if (enableHDR) {
      if (!this.hdrColorTexture || !this.hdrColorView || !this.sameSize(this.hdrSize, this.size)) {
        if (this.hdrColorTexture && this.hdrColorTexture !== frameResources.msaaColorTexture) {
          this.queueDestroy(this.hdrColorTexture);
        }
        this.hdrColorTexture = createHdrColorTarget(configuredDevice, canvas);
        this.hdrColorView = this.hdrColorTexture.createView({ label: 'frame-hdr-view' });
        this.hdrSize = { ...this.size };
      }
      if (enableBloom) {
        const bloomSize = {
          width: Math.max(1, Math.floor(canvas.width / 2)),
          height: Math.max(1, Math.floor(canvas.height / 2)),
        };
        if (!this.bloomTexture || !this.sameSize(this.bloomSize, bloomSize)) {
          this.queueDestroy(this.bloomTexture);
          this.bloomTexture = configuredDevice.createTexture({
            label: 'frame-bloom-texture',
            size: {
              width: bloomSize.width,
              height: bloomSize.height,
              depthOrArrayLayers: 1,
            },
            format: 'rgba16float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          });
          this.bloomTextureView = this.bloomTexture.createView();
          this.bloomSize = bloomSize;
        } else if (!this.bloomTextureView) {
          this.bloomTextureView = this.bloomTexture.createView();
        }
      } else if (this.bloomTexture) {
        this.queueDestroy(this.bloomTexture);
        this.bloomTexture = null;
        this.bloomTextureView = null;
        this.bloomSize = null;
      }
    } else {
      this.releaseHdrResources();
    }

    if (needsNormalTexture) {
      if (!this.normalTexture || !this.sameSize(this.normalSize, this.size)) {
        this.queueDestroy(this.normalTexture);
        this.normalTexture = configuredDevice.createTexture({
          label: 'frame-normal-texture',
          size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
          format: 'rgba16float',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          sampleCount: 1,
        });
        this.normalTextureView = this.normalTexture.createView();
        this.normalSize = { ...this.size };
      } else if (!this.normalTextureView) {
        this.normalTextureView = this.normalTexture.createView();
      }
    } else {
      this.releaseNormalResources();
    }

    if (enableSSAO) {
      if (!this.ssaoTexture || !this.sameSize(this.ssaoSize, this.size)) {
        this.queueDestroy(this.ssaoTexture);
        this.ssaoTexture = configuredDevice.createTexture({
          label: 'frame-ssao-texture',
          size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
          format: 'rgba16float',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.ssaoTextureView = this.ssaoTexture.createView();
        this.ssaoSize = { ...this.size };
      } else if (!this.ssaoTextureView) {
        this.ssaoTextureView = this.ssaoTexture.createView();
      }

      if (sampleCount > 1) {
        if (
          !this.resolvedDepthTexture ||
          !this.sameSize(this.resolvedDepthSize, this.size)
        ) {
          this.queueDestroy(this.resolvedDepthTexture);
          this.resolvedDepthTexture = createDepthTexture(configuredDevice, canvas, 1);
          this.resolvedDepthView = this.resolvedDepthTexture.createView({
            label: 'resolved-depth-view',
          });
          this.resolvedDepthSize = { ...this.size };
        } else if (!this.resolvedDepthView) {
          this.resolvedDepthView = this.resolvedDepthTexture.createView({
            label: 'resolved-depth-view',
          });
        }
      } else if (this.resolvedDepthTexture) {
        this.queueDestroy(this.resolvedDepthTexture);
        this.resolvedDepthTexture = null;
        this.resolvedDepthView = null;
        this.resolvedDepthSize = null;
      }
    } else {
      this.releaseSsaoResources();
    }

    if (enableHDR && enableFXAA) {
      if (!this.tonemapTexture || !this.sameSize(this.tonemapSize, this.size)) {
        this.queueDestroy(this.tonemapTexture);
        this.tonemapTexture = configuredDevice.createTexture({
          label: 'tonemap-output',
          size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
          format: 'bgra8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.tonemapView = this.tonemapTexture.createView();
        this.tonemapSize = { ...this.size };
      } else if (!this.tonemapView) {
        this.tonemapView = this.tonemapTexture.createView();
      }
    } else if (this.tonemapTexture) {
      this.queueDestroy(this.tonemapTexture);
      this.tonemapTexture = null;
      this.tonemapView = null;
      this.tonemapSize = null;
    }

    if (enableBloom && !enableHDR) {
      Logger.warn('Bloom requested without HDR; ignoring bloom target allocation.');
    }

    const needsDepthStore = enableSSAO || enableOutlines || Boolean(ctx.waterRenderer);

    return {
      msaaView: frameResources.msaaColorView,
      hdrView: this.hdrColorView,
      bloomView: this.bloomTextureView,
      normalView: this.normalTextureView,
      ssaoView: this.ssaoTextureView,
      resolvedDepthView: this.resolvedDepthView,
      tonemapIntermediateView: this.tonemapView,
      needsDepthStore,
    };
  }

  /**
   * Gets the HDR color texture (for encoder registration).
   */
  getHdrColorTexture(): GPUTexture | null {
    return this.hdrColorTexture;
  }

  /**
   * Gets the bloom texture (for encoder registration).
   */
  getBloomTexture(): GPUTexture | null {
    return this.bloomTexture;
  }

  /**
   * Gets the normal texture (for encoder registration).
   */
  getNormalTexture(): GPUTexture | null {
    return this.normalTexture;
  }

  /**
   * Gets the SSAO texture (for encoder registration).
   */
  getSsaoTexture(): GPUTexture | null {
    return this.ssaoTexture;
  }

  /**
   * Gets the resolved depth texture (for encoder registration).
   */
  getResolvedDepthTexture(): GPUTexture | null {
    return this.resolvedDepthTexture;
  }

  /**
   * Gets the tonemap texture (for encoder registration).
   */
  getTonemapTexture(): GPUTexture | null {
    return this.tonemapTexture;
  }

  /**
   * Registers textures used by an encoder to prevent premature destruction.
   * Must be called before using textures in a CommandEncoder.
   * Call unregisterEncoderTextures() after encoder.finish().
   */
  registerEncoderTextures(encoder: GPUCommandEncoder, textures: GPUTexture[]): void {
    const textureSet = new Set(textures.filter((t): t is GPUTexture => t !== null));
    if (textureSet.size > 0) {
      this.activeEncoders.set(encoder, textureSet);
      // Track textures in use
      for (const texture of textureSet) {
        this.texturesInUse.add(texture);
      }
    }
  }

  /**
   * Unregisters an encoder after it has been finished.
   * Must be called after encoder.finish() to allow texture destruction.
   */
  unregisterEncoderTextures(encoder: GPUCommandEncoder): void {
    const textureSet = this.activeEncoders.get(encoder);
    if (textureSet) {
      // Remove textures from tracking set
      for (const texture of textureSet) {
        this.texturesInUse.delete(texture);
      }
    }
    this.activeEncoders.delete(encoder);
  }

  /**
   * Checks if a texture is currently used by any active encoder.
   */
  private isTextureInUse(texture: GPUTexture): boolean {
    return this.texturesInUse.has(texture);
  }

  queueDestroy(texture: GPUTexture | null | undefined): void {
    if (texture) {
      // Don't queue textures that are currently in use by active encoders
      if (this.isTextureInUse(texture)) {
        // Texture is in use - will be queued after encoder finishes
        // We'll check again in flush()
        this.pendingDestroy.push(texture);
      } else {
        // Safe to queue for destruction
        this.pendingDestroy.push(texture);
      }
    }
  }

  flush(queue: GPUQueue): void {
    if (this.pendingDestroy.length === 0) {
      return;
    }
    
    // Filter out textures that are still in use by active encoders
    const texturesToDestroy: GPUTexture[] = [];
    const texturesStillInUse: GPUTexture[] = [];
    
    for (const texture of this.pendingDestroy) {
      if (this.isTextureInUse(texture)) {
        texturesStillInUse.push(texture);
      } else {
        texturesToDestroy.push(texture);
      }
    }
    
    // Keep textures still in use for next flush
    this.pendingDestroy = texturesStillInUse;
    
    if (texturesToDestroy.length === 0) {
      return;
    }
    
    const destroyTextures = () => {
      // Double-check textures aren't in use before destroying
      const safeToDestroy: GPUTexture[] = [];
      for (const texture of texturesToDestroy) {
        if (!this.isTextureInUse(texture)) {
          safeToDestroy.push(texture);
        } else {
          // Texture became in use again - re-queue for next flush
          this.pendingDestroy.push(texture);
        }
      }
      
      for (const texture of safeToDestroy) {
        try {
          texture.destroy();
        } catch (err) {
          // Texture might already be destroyed or device lost
          // This is expected in some cases, so we just log and continue
          Logger.warn('[FrameTargetManager] Failed to destroy texture during cleanup (may be already destroyed):', err);
        }
      }
    };
    
    // Wait for GPU work to complete before destroying textures
    // This ensures textures aren't destroyed while still referenced in command buffers
    queue
      .onSubmittedWorkDone()
      .then(() => {
        // Add delay to ensure all GPU work is truly complete
        // This gives WebGPU time to finish processing command buffers
        // Use longer delay (2 frames) to be safe with variable frame rates
        setTimeout(destroyTextures, 32);
      })
      .catch((err) => {
        Logger.warn('[FrameTargetManager] Failed to wait for GPU work completion during cleanup:', err);
        // Use longer fallback delay to be safe
        setTimeout(destroyTextures, 200);
      });
  }

  dispose(): void {
    this.releaseHdrResources();
    this.releaseNormalResources();
    this.releaseSsaoResources();
    this.queueDestroy(this.tonemapTexture);
    this.flushImmediate();
    this.resolvedDepthTexture = null;
    this.resolvedDepthView = null;
    this.resolvedDepthSize = null;
    this.tonemapTexture = null;
    this.tonemapView = null;
    this.tonemapSize = null;
  }

  private flushImmediate(): void {
    // Only destroy textures that are NOT in use by active encoders
    const texturesToDestroy: GPUTexture[] = [];
    const texturesStillInUse: GPUTexture[] = [];
    
    for (const texture of this.pendingDestroy) {
      if (this.isTextureInUse(texture)) {
        texturesStillInUse.push(texture);
      } else {
        texturesToDestroy.push(texture);
      }
    }
    
    // Keep textures still in use
    this.pendingDestroy = texturesStillInUse;
    
    // Destroy only safe textures
    for (const texture of texturesToDestroy) {
      try {
        texture.destroy();
      } catch {
        // ignore
      }
    }
  }

  private sameSize(a: Size | null, b: Size): boolean {
    return Boolean(a && a.width === b.width && a.height === b.height);
  }

  private releaseHdrResources(): void {
    if (this.hdrColorTexture) {
      this.queueDestroy(this.hdrColorTexture);
      this.hdrColorTexture = null;
    }
    this.hdrColorView = null;
    this.hdrSize = null;
    if (this.bloomTexture) {
      this.queueDestroy(this.bloomTexture);
      this.bloomTexture = null;
      this.bloomTextureView = null;
      this.bloomSize = null;
    }
  }

  private releaseNormalResources(): void {
    if (this.normalTexture) {
      this.queueDestroy(this.normalTexture);
      this.normalTexture = null;
    }
    this.normalTextureView = null;
    this.normalSize = null;
  }

  private releaseSsaoResources(): void {
    if (this.ssaoTexture) {
      this.queueDestroy(this.ssaoTexture);
      this.ssaoTexture = null;
      this.ssaoTextureView = null;
      this.ssaoSize = null;
    }
    if (this.resolvedDepthTexture) {
      this.queueDestroy(this.resolvedDepthTexture);
      this.resolvedDepthTexture = null;
    }
    this.resolvedDepthView = null;
    this.resolvedDepthSize = null;
  }
}
