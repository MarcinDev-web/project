/**
 * Result of optimization. We standardize on GLB output (application/octet-stream)
 * to ensure a single self-contained asset for downstream parsing.
 */
export interface OptimizedGltfResult {
    mimeType: string;
    data: ArrayBuffer;
}
export interface GltfLite {
    asset?: {
        version?: string;
        generator?: string;
    };
    scenes?: Array<{
        nodes?: number[];
    }>;
    nodes?: Array<{
        name?: string;
        translation?: [number, number, number];
        scale?: [number, number, number];
    }>;
}
/**
 * Optimize a GLTF/GLB file using glTF-Transform. Applies a conservative set of
 * transforms (dedup, prune, resample, quantize) and attempts Draco compression
 * when encoder is available. Texture resizing is applied to keep dimensions
 * under a reasonable cap, without introducing KTX2 dependency.
 */
export declare function optimizeGltfFile(file: File): Promise<OptimizedGltfResult>;
/**
 * Optimize and extract a minimal GLTF structure for importer usage.
 * This avoids requiring downstream systems to understand full glTF.
 */
export declare function optimizeAndExtractLite(file: File): Promise<GltfLite>;
//# sourceMappingURL=GltfOptimizer.d.ts.map