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
      this.flushImmediate(); // Destroy all textures immediately
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

  queueDestroy(texture: GPUTexture | null | undefined): void {
    if (texture) {
      this.pendingDestroy.push(texture);
    }
  }

  flush(queue: GPUQueue): void {
    if (this.pendingDestroy.length === 0) {
      return;
    }
    const textures = this.pendingDestroy.splice(0);
    const destroyTextures = () => {
      for (const texture of textures) {
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
        // Add small delay to ensure all GPU work is truly complete
        // This gives WebGPU time to finish processing command buffers
        setTimeout(destroyTextures, 16); // ~1 frame at 60fps
      })
      .catch((err) => {
        Logger.warn('[FrameTargetManager] Failed to wait for GPU work completion during cleanup:', err);
        // Use longer fallback delay to be safe
        setTimeout(destroyTextures, 100);
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
    const textures = this.pendingDestroy.splice(0);
    for (const texture of textures) {
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
