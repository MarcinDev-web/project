export type OrbitControlsState = {
    distance: number;
    azimuth: number;
    elevation: number;
    target: [number, number, number];
};
import type { GeometryData } from '../resources/resources';
import type { Scene, Entity } from '@engine/world';
import { FrameRenderer } from './FrameRenderer';
import type { RendererCapabilities } from '../config';
export interface Renderer {
    cleanup(): void;
    abort(): void;
    /** Updates instance data from the scene */
    updateScene(): void;
    /** Gets the current scene */
    getScene(): Scene | null;
    /** Sets the grid renderer (optional) */
    setGridRenderer(gridRenderer: GridRenderer | null): void;
    /** Initializes a grid renderer with device info */
    initializeGridRenderer(gridRenderer: GridRenderer): Promise<void>;
    /** Returns the underlying GPUDevice */
    getDevice(): GPUDevice;
    /** Returns the current presentation format */
    getPresentationFormat(): GPUTextureFormat;
    /** Returns renderer capabilities determined at init time */
    getCapabilities(): RendererCapabilities;
    /** Feature helpers */
    supportsTimestampQueries(): boolean;
    supportsOcclusionQueries(): boolean;
    supportsTextureCompression(): boolean;
    getFrameRenderer(): FrameRenderer;
    onGpuTimings(handler: (timings: {
        label: string;
        timeMs: number;
    }[]) => void): void;
    [key: string]: unknown;
}
export interface GridRenderer {
    initialize(device: GPUDevice, format: GPUTextureFormat, depthFormat: GPUTextureFormat): Promise<void>;
    render(passEncoder: GPURenderPassEncoder, viewProjectionMatrix: Float32Array): void;
    dispose(): void;
}
interface RendererOptions {
    canvas: HTMLCanvasElement;
    statusEl: HTMLElement;
    getOrbitState: () => OrbitControlsState;
    geometry?: GeometryData;
    scene?: Scene;
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
}
export declare function initRenderer(options: RendererOptions): Promise<Renderer>;
export {};
//# sourceMappingURL=Renderer.d.ts.map