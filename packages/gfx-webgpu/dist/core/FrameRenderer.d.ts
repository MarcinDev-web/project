/**
 * Frame Renderer
 *
 * Manages the per-frame rendering pipeline including:
 * - Scene updates and frustum culling
 * - Instance buffer management
 * - Render pass encoding
 * - Draw calls
 * - Environment/grid rendering
 *
 * This is the core rendering loop extracted from the main Renderer.
 */
import type { Scene } from '@engine/world';
import type { FrameResources, GeometryData } from '../resources/resources';
import type { EnvironmentRenderer } from '../renderers/EnvironmentRenderer';
import type { Mat4, Vec3 } from '@engine/core/math';
import { UniformManager } from './UniformManager';
export interface FrameRenderContext {
    device: GPUDevice;
    canvas: HTMLCanvasElement;
    context: GPUCanvasContext;
    presentationFormat: GPUTextureFormat;
    frameResources: FrameResources;
    scene: Scene | null;
    geometry: GeometryData;
    environmentRenderer: EnvironmentRenderer | null;
    gridRenderer: {
        render?: (p: GPURenderPassEncoder, vp: Mat4) => void;
    } | null;
    onGpuTimings?: (timings: {
        label: string;
        timeMs: number;
    }[]) => void;
    uniformManager: UniformManager;
    lightingData?: import('../lighting/LightManager').LightingData;
}
/**
 * FrameRenderer manages the per-frame rendering operations.
 */
export declare class FrameRenderer {
    private frustumCuller;
    private instanceBuilder;
    private visibleEntitiesCache;
    private depthTextureSize;
    private computePrepass;
    private pendingTimestampRead;
    private staticBundle;
    private bundleDirty;
    private bundleInstanceCount;
    private bundleIndexCount;
    private bundleRenderPipeline;
    private bundleOverlayPipeline;
    private bundleUniformBindGroup;
    private bundleTextureBindGroup;
    private hdrColorTexture;
    private bloomTexture;
    private tonemapPass;
    private bloomPass;
    private shadowPass;
    constructor(initialCapacity?: number);
    /**
     * Renders a single frame.
     * Returns updated geometry data.
     */
    renderFrame(ctx: FrameRenderContext, viewProjectionMatrix: Mat4, eyePosition: Vec3, passDescriptor?: GPURenderPassDescriptor, viewMatrix?: Mat4, projectionMatrix?: Mat4): GeometryData;
    /**
     * Releases resources owned by the FrameRenderer
     */
    dispose(): void;
    /**
     * Updates instance buffers in place (same count).
     */
    private updateInstanceBuffers;
    /**
     * Reallocates instance buffers (different count).
     */
    private reallocateInstanceBuffers;
    private scheduleTimestampRead;
    private invalidateBundle;
    private drawStaticGeometry;
    private recordStaticBundle;
}
//# sourceMappingURL=FrameRenderer.d.ts.map