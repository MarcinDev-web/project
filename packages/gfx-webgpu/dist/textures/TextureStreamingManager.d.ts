/**
 * Texture Streaming Manager
 *
 * Manages LOD-based texture loading for efficient memory usage.
 * Loads high-resolution textures only for visible/close objects.
 *
 * Features:
 * - Distance-based LOD selection
 * - Priority queue for async loading
 * - Memory budget management
 * - Automatic eviction of unused textures
 */
export type TextureLOD = 'low' | 'medium' | 'high' | 'ultra';
export interface TextureStreamingConfig {
    enabled: boolean;
    memoryBudgetMB: number;
    lodDistances: {
        ultra: number;
        high: number;
        medium: number;
    };
    maxConcurrentLoads: number;
    evictionStrategy: 'lru' | 'distance';
    preloadDistance: number;
}
export interface TextureEntry {
    id: string;
    url: string;
    currentLOD: TextureLOD | null;
    targetLOD: TextureLOD;
    texture: GPUTexture | null;
    size: number;
    lastUsed: number;
    distance: number;
    priority: number;
    loading: boolean;
}
export interface LoadRequest {
    entry: TextureEntry;
    lod: TextureLOD;
    priority: number;
}
/**
 * TextureStreamingManager manages texture LOD streaming.
 */
export declare class TextureStreamingManager {
    private config;
    private device;
    private textures;
    private loadQueue;
    private activeLoads;
    private currentMemoryUsage;
    private frameCount;
    constructor(device: GPUDevice, config?: Partial<TextureStreamingConfig>);
    /**
     * Registers a texture for streaming.
     */
    registerTexture(id: string, url: string, initialDistance?: number): void;
    /**
     * Updates texture distance and triggers LOD changes if needed.
     */
    updateTextureDistance(id: string, distance: number): void;
    /**
     * Gets texture for rendering.
     * Returns null if not loaded yet.
     */
    getTexture(id: string): GPUTexture | null;
    /**
     * Updates streaming system (call once per frame).
     */
    update(): void;
    /**
     * Gets streaming statistics.
     */
    getStats(): {
        textureCount: number;
        loadedCount: number;
        memoryUsageMB: number;
        memoryBudgetMB: number;
        queuedLoads: number;
        activeLoads: number;
    };
    /**
     * Disposes all textures and clears state.
     */
    dispose(): void;
    /**
     * Calculates target LOD based on distance.
     */
    private calculateTargetLOD;
    /**
     * Calculates loading priority based on distance and LOD.
     */
    private calculatePriority;
    /**
     * Checks if should upgrade LOD.
     */
    private shouldUpgradeLOD;
    /**
     * Checks if should downgrade LOD.
     */
    private shouldDowngradeLOD;
    /**
     * Queues texture load.
     */
    private queueLoad;
    /**
     * Queues texture unload (downgrade).
     */
    private queueUnload;
    /**
     * Processes load queue.
     */
    private processLoadQueue;
    /**
     * Starts async texture load.
     */
    private startLoad;
    /**
     * Loads texture from URL.
     */
    private loadTextureFromURL;
    /**
     * Gets LOD-specific URL.
     */
    private getLODUrl;
    /**
     * Estimates texture size in bytes.
     */
    private estimateTextureSize;
    /**
     * Evicts textures to stay within memory budget.
     */
    private evictTextures;
    /**
     * Destroys texture and updates memory usage.
     */
    private destroyTexture;
    /**
     * Cleans up unused textures.
     */
    private cleanup;
    /**
     * Gets current timestamp.
     */
    private now;
    /**
     * Updates configuration.
     */
    updateConfig(config: Partial<TextureStreamingConfig>): void;
    /**
     * Gets current configuration.
     */
    getConfig(): TextureStreamingConfig;
}
//# sourceMappingURL=TextureStreamingManager.d.ts.map