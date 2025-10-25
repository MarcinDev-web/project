export declare const FOV_RADIANS: number;
export declare const Z_NEAR = 0.1;
export declare const Z_FAR = 100;
export declare const MSAA_SAMPLE_COUNT = 4;
export declare const CLEAR_COLOR: {
    r: number;
    g: number;
    b: number;
    a: number;
};
export declare const DEFAULT_STATUS_MESSAGE = "Rendering simple cubes\u2026";
export declare const UI_STATUS_THROTTLE_MS = 250;
export declare const UNIFORM_BUFFER_SIZE = 896;
export declare const UNIFORM_DATA_LENGTH = 224;
export interface GpuTimestampPair {
    label: string;
    beginIndex: number;
    endIndex: number;
}
export declare const GPU_TIMESTAMP_PAIRS: GpuTimestampPair[];
export declare const TIMESTAMP_QUERY_COUNT: number;
export declare const TIMESTAMP_BUFFER_SIZE: number;
export declare const TEXTURE_SIZE = 128;
export declare const SHADING_AMBIENT = 0.3;
export declare const SHADING_TOON_BANDS = 12;
export declare const SHADING_SPECULAR_POWER = 24;
export interface InstanceGridConfig {
    dimensions: number;
    spacing: number;
}
export declare const DEFAULT_INSTANCE_GRID: InstanceGridConfig;
export interface TextureCompressionSupport {
    bc: boolean;
    etc2: boolean;
    astc: boolean;
}
export interface RendererCapabilities {
    adapterName?: string;
    adapterInfo?: {
        vendor?: string;
        architecture?: string;
        device?: string;
        description?: string;
    };
    features: {
        timestampQuery: boolean;
        occlusionQuery: boolean;
        compute: boolean;
        textureCompression: TextureCompressionSupport;
    };
    limits: {
        maxTextureDimension2D: number;
        maxBufferSize: number;
        maxBindGroups?: number;
        maxStorageBufferBindingSize?: number;
        maxUniformBufferBindingSize?: number;
        maxComputeWorkgroupSizeX?: number;
        maxComputeWorkgroupSizeY?: number;
        maxComputeWorkgroupSizeZ?: number;
    };
}
//# sourceMappingURL=config.d.ts.map