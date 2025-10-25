export const FOV_RADIANS = (2 * Math.PI) / 5;
export const Z_NEAR = 0.1;
export const Z_FAR = 100;
export const MSAA_SAMPLE_COUNT = 4;
export const CLEAR_COLOR = { r: 0.08, g: 0.08, b: 0.1, a: 1.0 };
export const DEFAULT_STATUS_MESSAGE = 'Rendering simple cubes…';
export const UI_STATUS_THROTTLE_MS = 250;
// Lighting system adds: pointLightCount (16 bytes), directional (32 bytes), ambient (16 bytes), 4 point lights (4*64=256 bytes)
// Base total before shadows/IBL: 144 (static) + 16 + 32 + 16 + 256 = 464 bytes
// Shadow uniforms appended:
// - viewMatrix (64)
// - 4x lightViewProj (256)
// - cascadeSplits (16)
// - atlasRects (4*16=64)
// - filterParams (16)
// - biasParams (16)
// New total: 464 + 64 + 256 + 16 + 64 + 16 + 16 = 896 bytes
export const UNIFORM_BUFFER_SIZE = 896;
export const UNIFORM_DATA_LENGTH = 224; // 896 bytes / 4 bytes per float32
export interface GpuTimestampPair {
  label: string;
  beginIndex: number;
  endIndex: number;
}

export const GPU_TIMESTAMP_PAIRS: GpuTimestampPair[] = [
  { label: 'Compute Prepass', beginIndex: 0, endIndex: 1 },
  { label: 'Render Pass', beginIndex: 2, endIndex: 3 },
];

export const TIMESTAMP_QUERY_COUNT = GPU_TIMESTAMP_PAIRS.length * 2;
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
