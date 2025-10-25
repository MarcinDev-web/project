export interface ThumbnailOptions {
    size?: number;
}
export interface ThumbnailRendererInit {
    device?: GPUDevice;
    presentationFormat?: GPUTextureFormat;
}
export declare class ThumbnailRenderer {
    private device;
    private presentationFormat;
    initialize(init?: ThumbnailRendererInit): Promise<void>;
    /**
     * Renders a single asset-like cube scaled and colored to match the preset into a data URL.
     * Note: Uses the main shader pipeline for visual parity.
     */
    renderAsset(preset: {
        scale: [number, number, number];
        color: [number, number, number, number];
    }, options?: ThumbnailOptions): Promise<string>;
}
//# sourceMappingURL=ThumbnailRenderer.d.ts.map