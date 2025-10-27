export const FOV_RADIANS = (2 * Math.PI) / 5;
export const Z_NEAR = 0.1;
export const Z_FAR = 100;
export const MSAA_SAMPLE_COUNT = 4;
export const CLEAR_COLOR = { r: 0.08, g: 0.08, b: 0.1, a: 1.0 };
export const DEFAULT_STATUS_MESSAGE = 'Rendering simple cubes…';
export const UI_STATUS_THROTTLE_MS = 250;
// Lighting system adds: pointLightCount (16 bytes), directional (32 bytes), ambient (16 bytes), 4 point lights (4*64=256 bytes)
// Base total before shadows/IBL: 128 (static) + 16 + 32 + 16 + 256 = 448 bytes
// Shadow uniforms appended:
// - viewMatrix (64)
// - 4x lightViewProj (256)
// - cascadeSplits (16)
// - atlasRects (4*16=64)
// - filterParams (16)
// - biasParams (16)
// - shadowExtraParams (16)
// New total (unpadded): 448 + 64 + 256 + 16 + 64 + 16 + 16 + 16 = 896 bytes
// Total buffer size remains 896 bytes (no extra headroom).
export const UNIFORM_BUFFER_SIZE = 896;
export const UNIFORM_DATA_LENGTH = 224; // 896 bytes / 4 bytes per float32
export interface GpuTimestampPair {
  label: string;
  beginIndex: number;
  endIndex: number;
}

// Extended timestamp tracking for detailed profiling
export const TIMESTAMP_INDICES = {
  FRAME_BEGIN: 0,
  FRAME_END: 1,
  COMPUTE_BEGIN: 2,
  COMPUTE_END: 3,
  SHADOW_BEGIN: 4,
  SHADOW_END: 5,
  MAIN_PASS_BEGIN: 6,
  MAIN_PASS_END: 7,
  BLOOM_BEGIN: 8,
  BLOOM_END: 9,
  TONEMAP_BEGIN: 10,
  TONEMAP_END: 11,
} as const;

export const GPU_TIMESTAMP_PAIRS: GpuTimestampPair[] = [
  { label: 'frame-total', beginIndex: 0, endIndex: 1 },
  { label: 'compute-pass', beginIndex: 2, endIndex: 3 },
  { label: 'shadow-pass', beginIndex: 4, endIndex: 5 },
  { label: 'main-pass', beginIndex: 6, endIndex: 7 },
  { label: 'bloom-pass', beginIndex: 8, endIndex: 9 },
  { label: 'tonemap-pass', beginIndex: 10, endIndex: 11 },
];

export const TIMESTAMP_QUERY_COUNT = 16; // Extended for multiple passes
export const TIMESTAMP_BUFFER_SIZE = TIMESTAMP_QUERY_COUNT * 8;
export const TEXTURE_SIZE = 128;

// Shading parameters (configurable)
export const SHADING_AMBIENT = 0.3;
export const SHADING_TOON_BANDS = 12;
export const SHADING_SPECULAR_POWER = 24;

export interface InstanceGridConfig {
  dimensions: number;
  spacing: number;
}

export const DEFAULT_INSTANCE_GRID: InstanceGridConfig = {
  dimensions: 12,
  spacing: 1.4,
};

// ========== Renderer Capabilities ==========

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
