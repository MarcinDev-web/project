export const FOV_RADIANS = (2 * Math.PI) / 5;
export const Z_NEAR = 0.1;
export const Z_FAR = 10000;
export const MSAA_SAMPLE_COUNT = 4;
export const CLEAR_COLOR = { r: 0.02, g: 0.02, b: 0.03, a: 1.0 };
export const DEFAULT_STATUS_MESSAGE = 'Rendering simple cubes…';

// ========== Frame Loop Constants ==========

/** Maximum delta time in seconds to prevent physics explosions after tab switch */
export const MAX_DELTA_TIME_SEC = 0.1;

// ========== Occlusion Culling Constants ==========

/** Width of the occlusion buffer in pixels */
export const OCCLUSION_BUFFER_WIDTH = 256;

/** Height of the occlusion buffer in pixels */
export const OCCLUSION_BUFFER_HEIGHT = 128;

// ========== Device Manager Constants ==========

/** Maximum number of device recreation attempts before giving up */
export const MAX_DEVICE_RECREATION_ATTEMPTS = 3;
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

export type FeatureTier = 0 | 1 | 2;

export interface RendererCapabilities {
  /** Feature tier: 0=baseline, 1=preferred, 2=enhanced */
  tier: FeatureTier;
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
    /** Shader F16 support (Tier 2) */
    shaderF16?: boolean;
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
  /** Selected texture compression format (or 'none') */
  textureCompression?: 'bc' | 'etc2' | 'astc' | 'none';
}
