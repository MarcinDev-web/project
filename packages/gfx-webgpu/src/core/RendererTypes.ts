/**
 * Renderer Types
 *
 * Shared type definitions for the renderer module.
 * Extracted from Renderer.ts to enable better modularity and testability.
 */

import type { OrbitControlsState } from '@engine/camera';
import type { Scene, Entity } from '@engine/world';
import type { CollisionWorld } from '@engine/wasm-collision';
import type { FrameResources, GeometryData } from '../resources/resources';
import type { RendererCapabilities, FeatureTier } from '../config';
import type { TextureCompressionManager, CompressionFormat } from '../textures/TextureCompressionManager';
import type { GPUBufferPool } from './bufferPool';
import type { TextureAtlas } from '../textures/TextureAtlas';
import type { FrameRenderer } from './FrameRenderer';
import type { ResourceManager } from '../resources/ResourceManager';

// ========== Handler Types ==========

/**
 * Handler for GPU timing metrics from timestamp queries.
 */
export type GpuTimingsHandler = (timings: { label: string; timeMs: number }[]) => void;

/**
 * Handler for CPU timing metrics.
 */
export type CpuTimingsHandler = (timings: {
  cullingTime: number;
  instanceUpdateTime: number;
  totalCPUTime: number;
}) => void;

/**
 * Handler for shadow pass metrics.
 * Tuple: [cascadeCount, shadowMapSize, shadowDrawCalls, shadowTriangles]
 */
export type ShadowMetricsHandler = (metrics: readonly [number, number, number, number]) => void;

/**
 * Handler for per-frame render statistics.
 */
export type RenderStatsHandler = (stats: { drawCalls: number; triangles: number }) => void;

// ========== Render Settings ==========

/**
 * Quality levels for shadow rendering.
 */
export type ShadowQuality = 'low' | 'med' | 'high' | 'ultra';

/**
 * Quality levels for outline rendering.
 */
export type OutlineQuality = 'low' | 'med';

/**
 * MSAA sample count options.
 */
export type MsaaSampleCount = 1 | 2 | 4;

/**
 * Mutable render settings that can be updated at runtime.
 */
export interface RenderSettings {
  enableHDR: boolean;
  enableBloom: boolean;
  enableFXAA: boolean;
  enableSSAO: boolean;
  enableSSGI: boolean;
  enableShadows: boolean;
  enableForwardPlus: boolean;
  enableScreenLOD: boolean;
  shadowQuality: ShadowQuality;
  enableComputePrepass: boolean;
  /** Enable async compute for frame overlap (culling overlaps with rendering) */
  enableAsyncCompute: boolean;
  msaaSampleCount: MsaaSampleCount;
  enableOutlines: boolean;
  outlineQuality: OutlineQuality;
  resolutionScale: number;
}

/**
 * Partial render settings for updates.
 */
export type RenderSettingsUpdate = Partial<RenderSettings>;

// ========== Extended Frame Resources ==========

/**
 * Extended FrameResources with internal properties that are not part of the base interface.
 * This eliminates the need for `any` casts when accessing bufferPool and atlas.
 */
export interface ExtendedFrameResources extends FrameResources {
  /** GPU buffer pool for efficient buffer reuse */
  bufferPool: GPUBufferPool;
  /** Texture atlas for material textures */
  atlas: TextureAtlas;
}

// ========== Grid Renderer ==========

/**
 * Lightweight grid renderer interface used by the core renderer.
 * Implementations must provide initialize, render, and dispose methods.
 */
export interface GridRenderer {
  /**
   * Initializes the grid renderer with GPU resources.
   * @param device - The GPU device to use
   * @param format - The color attachment format
   * @param depthFormat - The depth attachment format
   */
  initialize(
    device: GPUDevice,
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat
  ): Promise<void>;

  /**
   * Renders the grid.
   * @param passEncoder - The render pass encoder
   * @param viewProjectionMatrix - Combined view-projection matrix
   * @param eyePosition - Camera position for LOD/fade calculations
   */
  render(
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Float32Array,
    eyePosition?: Float32Array | number[]
  ): void;

  /**
   * Disposes GPU resources.
   */
  dispose(): void;

  /**
   * Optional method to control grid visibility.
   */
  setVisible?(visible: boolean): void;
}

// ========== Renderer Options ==========

/**
 * Options for initializing the renderer.
 */
export interface RendererOptions {
  /** The canvas element to render to */
  canvas: HTMLCanvasElement;
  /** Status element for displaying messages */
  statusEl: HTMLElement;
  /** Function to get current orbit controls state */
  getOrbitState: () => OrbitControlsState;
  /** 
   * Target point for orbit camera to look at. Defaults to [0, 0, 0].
   * For avatar preview, use [0, 1, 0] to center on the character.
   */
  orbitTarget?: [number, number, number];
  /** Initial geometry data (optional, defaults to simple cubes) */
  geometry?: GeometryData;
  /** Scene to render */
  scene?: Scene;
  /** Camera entity to use for rendering */
  cameraEntity?: Entity | null;
  /**
   * Optional predicate indicating whether runtime simulation should run this frame.
   * If not provided, simulation (e.g., ScriptSystem) always runs when available.
   */
  shouldSimulate?: () => boolean;
  /**
   * Optional callback for per-frame updates (called before rendering).
   * Use this for play mode updates, physics, character controllers, etc.
   */
  onFrameUpdate?: (deltaTime: number) => void;
  // Performance/quality flags
  enableHDR?: boolean;
  enableBloom?: boolean;
  enableShadows?: boolean;
  /** Screen Space Ambient Occlusion */
  enableSSAO?: boolean;
  /** Screen Space Global Illumination */
  enableSSGI?: boolean;
  shadowQuality?: ShadowQuality;
  enableOutlines?: boolean;
  outlineQuality?: OutlineQuality;
  enableComputePrepass?: boolean;
  /** Enable async compute for frame overlap (culling overlaps with rendering) */
  enableAsyncCompute?: boolean;
  msaaSampleCount?: MsaaSampleCount;
  /** 
   * Optional ResourceManager instance for centralized texture/material management.
   * If not provided, a default instance will be created and initialized.
   */
  resourceManager?: ResourceManager;
}

// ========== Main Renderer Interface ==========

/**
 * Main renderer interface returned by initRenderer.
 * Provides methods for controlling rendering, updating settings, and accessing GPU resources.
 */
export interface Renderer {
  /**
   * Cleans up all GPU resources and stops rendering.
   * Call this when the renderer is no longer needed.
   */
  cleanup(): void;

  /**
   * Aborts the render loop without full cleanup.
   * Useful for quick shutdown scenarios.
   */
  abort(): void;

  /**
   * Updates instance data from the scene.
   * Note: Per-frame updates are handled automatically by FrameRenderer.
   */
  updateScene(): void;

  /**
   * Gets the current scene being rendered.
   */
  getScene(): Scene | null;

  /**
   * Sets the grid renderer (optional).
   * @param gridRenderer - Grid renderer instance or null to disable
   */
  setGridRenderer(gridRenderer: GridRenderer | null): void;

  /**
   * Initializes a grid renderer with device info.
   * @param gridRenderer - Grid renderer to initialize
   */
  initializeGridRenderer(gridRenderer: GridRenderer): Promise<void>;

  /**
   * Returns the underlying GPUDevice.
   */
  getDevice(): GPUDevice;

  /**
   * Returns the current presentation format.
   */
  getPresentationFormat(): GPUTextureFormat;

  /**
   * Returns renderer capabilities determined at init time.
   */
  getCapabilities(): RendererCapabilities;

  /**
   * Checks if timestamp queries are supported.
   */
  supportsTimestampQueries(): boolean;

  /**
   * Checks if occlusion queries are supported.
   */
  supportsOcclusionQueries(): boolean;

  /**
   * Checks if any texture compression format is supported.
   */
  supportsTextureCompression(): boolean;

  /**
   * Gets the frame renderer instance.
   */
  getFrameRenderer(): FrameRenderer;

  /**
   * Registers a handler for GPU timing metrics.
   * @param handler - Callback receiving timing data
   */
  onGpuTimings(handler: GpuTimingsHandler): void;

  /**
   * Unregisters a GPU timing handler.
   * @param handler - Previously registered handler
   */
  offGpuTimings(handler: GpuTimingsHandler): void;

  /**
   * Registers a handler for CPU timing metrics.
   * @param handler - Callback receiving timing data
   */
  onCpuTimings(handler: CpuTimingsHandler): void;

  /**
   * Unregisters a CPU timing handler.
   * @param handler - Previously registered handler
   */
  offCpuTimings(handler: CpuTimingsHandler): void;

  /**
   * Registers a handler for shadow metrics.
   * @param handler - Callback receiving shadow pass metrics
   */
  onShadowMetrics(handler: ShadowMetricsHandler): void;

  /**
   * Unregisters a shadow metrics handler.
   * @param handler - Previously registered handler
   */
  offShadowMetrics(handler: ShadowMetricsHandler): void;

  /**
   * Registers a handler for render statistics.
   * @param handler - Callback receiving draw call and triangle counts
   */
  onRenderStats(handler: RenderStatsHandler): void;

  /**
   * Unregisters a render stats handler.
   * @param handler - Previously registered handler
   */
  offRenderStats(handler: RenderStatsHandler): void;

  /**
   * Updates render settings at runtime.
   * @param settings - Partial settings to update
   */
  updateRenderSettings(settings: RenderSettingsUpdate): void;

  /**
   * Gets current render settings (read-only copy).
   */
  getRenderSettings(): Readonly<RenderSettings>;

  /**
   * Gets the texture compression manager for debug controls.
   */
  getTextureCompressionManager(): TextureCompressionManager;

  /**
   * Sets the forced texture compression format.
   * @param format - Compression format or null for auto-detection
   */
  setTextureCompressionFormat(format: CompressionFormat | null): void;

  /**
   * Enables or disables texture compression.
   * @param enabled - Whether compression should be used
   */
  setTextureCompressionEnabled(enabled: boolean): void;

  /**
   * Gets the collision world for physics queries.
   */
  getCollisionWorld(): CollisionWorld | null;

  /**
   * Gets the ResourceManager for centralized texture/material management.
   * Use this for material validation, diagnostics, and streaming control.
   */
  getResourceManager(): ResourceManager;

  /**
   * Allow additional properties for extensibility.
   */
  [key: string]: unknown;
}

// ========== Device Manager Types ==========

/**
 * Events emitted by DeviceManager.
 */
export interface DeviceManagerEvents {
  /** Emitted when device is lost */
  devicelost: { reason: string; message: string };
  /** Emitted when device is successfully recreated */
  devicerecreated: { device: GPUDevice; tier: FeatureTier };
  /** Emitted when device recreation fails */
  devicerecreationfailed: { error: Error; attempts: number };
}

/**
 * Configuration for DeviceManager.
 */
export interface DeviceManagerConfig {
  /** Maximum number of device recreation attempts */
  maxRecreationAttempts?: number;
  /** Canvas element for context configuration */
  canvas: HTMLCanvasElement;
  /** Status element for user feedback */
  statusEl?: HTMLElement;
}

// ========== Frame Loop Types ==========

/**
 * Frame callback function signature.
 */
export type FrameCallback = (deltaTime: number) => void;

/**
 * Configuration for FrameLoop.
 */
export interface FrameLoopConfig {
  /** Canvas element for resize observation */
  canvas: HTMLCanvasElement;
  /** Resolution scale factor (default: 1.0) */
  resolutionScale?: number;
}

// ========== Resource Factory Types ==========

/**
 * Options for creating frame resources.
 */
export interface ResourceCreationOptions {
  /** Initial geometry data */
  geometry: GeometryData;
  /** Presentation format for color attachments */
  presentationFormat: GPUTextureFormat;
  /** MSAA sample count */
  msaaSampleCount: MsaaSampleCount;
  /** Status element for error messages */
  statusEl?: HTMLElement;
  /** Whether timestamp queries are supported */
  timestampQuerySupported: boolean;
}

