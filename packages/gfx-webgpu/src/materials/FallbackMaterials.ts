/**
 * FallbackMaterials - Fallback textures and materials for error handling
 * 
 * Provides visual feedback when:
 * - Textures are missing
 * - Materials fail to load
 * - Resources are still loading
 * 
 * Never shows black/invisible blocks - always provides visible feedback.
 */

// ============================================================================
// Types
// ============================================================================

export type FallbackType = 'missing' | 'loading' | 'error' | 'default';

export interface FallbackConfig {
  /** Primary color [r, g, b, a] (0-1 range) */
  color: [number, number, number, number];
  /** Secondary color for patterns */
  secondaryColor?: [number, number, number, number];
  /** Pattern type */
  pattern: 'solid' | 'checkerboard' | 'stripes' | 'grid' | 'dots';
  /** Pattern size in pixels */
  patternSize?: number;
  /** Label text for debugging */
  label: string;
}

export interface GeneratedFallbackTexture {
  /** Raw RGBA pixel data */
  data: Uint8Array;
  /** Texture width */
  width: number;
  /** Texture height */
  height: number;
}

// ============================================================================
// Fallback Definitions
// ============================================================================

/**
 * Predefined fallback configurations for different error states.
 */
export const FALLBACK_CONFIGS: Record<FallbackType, FallbackConfig> = {
  /** Missing texture - highly visible magenta checkerboard */
  missing: {
    color: [1, 0, 1, 1],           // Magenta
    secondaryColor: [0, 0, 0, 1],   // Black
    pattern: 'checkerboard',
    patternSize: 8,
    label: 'MISSING',
  },

  /** Loading state - neutral gray */
  loading: {
    color: [0.5, 0.5, 0.5, 1],     // Gray
    secondaryColor: [0.4, 0.4, 0.4, 1],
    pattern: 'stripes',
    patternSize: 4,
    label: 'LOADING',
  },

  /** Error state - red warning */
  error: {
    color: [1, 0, 0, 1],           // Red
    secondaryColor: [0.5, 0, 0, 1], // Dark red
    pattern: 'stripes',
    patternSize: 8,
    label: 'ERROR',
  },

  /** Default fallback - simple gray */
  default: {
    color: [0.6, 0.6, 0.6, 1],     // Light gray
    pattern: 'solid',
    label: 'DEFAULT',
  },
};

// ============================================================================
// Texture Generation
// ============================================================================

/**
 * Generate a fallback texture based on configuration.
 */
export function generateFallbackTexture(
  type: FallbackType,
  size: number = 64
): GeneratedFallbackTexture {
  const config = FALLBACK_CONFIGS[type];
  const data = new Uint8Array(size * size * 4);

  const color1 = colorToRGBA(config.color);
  const color2 = config.secondaryColor 
    ? colorToRGBA(config.secondaryColor) 
    : color1;
  const patternSize = config.patternSize ?? 8;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const color = getPatternColor(x, y, config.pattern, patternSize, color1, color2);
      
      data[index + 0] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = color[3];
    }
  }

  return { data, width: size, height: size };
}

/**
 * Convert normalized color to RGBA bytes.
 */
function colorToRGBA(color: [number, number, number, number]): [number, number, number, number] {
  return [
    Math.round(color[0] * 255),
    Math.round(color[1] * 255),
    Math.round(color[2] * 255),
    Math.round(color[3] * 255),
  ];
}

/**
 * Get pixel color based on pattern.
 */
function getPatternColor(
  x: number,
  y: number,
  pattern: FallbackConfig['pattern'],
  patternSize: number,
  color1: [number, number, number, number],
  color2: [number, number, number, number]
): [number, number, number, number] {
  switch (pattern) {
    case 'solid':
      return color1;

    case 'checkerboard': {
      const cellX = Math.floor(x / patternSize);
      const cellY = Math.floor(y / patternSize);
      return (cellX + cellY) % 2 === 0 ? color1 : color2;
    }

    case 'stripes': {
      const stripe = Math.floor((x + y) / patternSize);
      return stripe % 2 === 0 ? color1 : color2;
    }

    case 'grid': {
      const onGridX = x % patternSize < 2;
      const onGridY = y % patternSize < 2;
      return (onGridX || onGridY) ? color2 : color1;
    }

    case 'dots': {
      const cellX = x % patternSize;
      const cellY = y % patternSize;
      const centerDist = Math.sqrt(
        Math.pow(cellX - patternSize / 2, 2) + 
        Math.pow(cellY - patternSize / 2, 2)
      );
      return centerDist < patternSize / 3 ? color2 : color1;
    }

    default:
      return color1;
  }
}

// ============================================================================
// GPU Texture Creation
// ============================================================================

/**
 * Create a GPU texture from fallback data.
 */
export function createFallbackGPUTexture(
  device: GPUDevice,
  type: FallbackType,
  size: number = 64,
  label?: string
): GPUTexture {
  const { data, width, height } = generateFallbackTexture(type, size);

  const texture = device.createTexture({
    label: label ?? `fallback-${type}`,
    size: { width, height },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    data.buffer as ArrayBuffer,
    { bytesPerRow: width * 4, offset: data.byteOffset },
    { width, height }
  );

  return texture;
}

/**
 * Create all fallback textures at once.
 */
export function createAllFallbackTextures(
  device: GPUDevice,
  size: number = 64
): Record<FallbackType, GPUTexture> {
  return {
    missing: createFallbackGPUTexture(device, 'missing', size),
    loading: createFallbackGPUTexture(device, 'loading', size),
    error: createFallbackGPUTexture(device, 'error', size),
    default: createFallbackGPUTexture(device, 'default', size),
  };
}

// ============================================================================
// Fallback Manager
// ============================================================================

/**
 * FallbackTextureManager - Manages fallback textures for the rendering system.
 */
export class FallbackTextureManager {
  private device: GPUDevice | null = null;
  private textures: Map<FallbackType, GPUTexture> = new Map();
  private textureSize: number;

  constructor(textureSize: number = 64) {
    this.textureSize = textureSize;
  }

  /**
   * Initialize with GPU device.
   */
  initialize(device: GPUDevice): void {
    this.device = device;
    
    // Pre-create all fallback textures
    const fallbackTextures = createAllFallbackTextures(device, this.textureSize);
    for (const [type, texture] of Object.entries(fallbackTextures)) {
      this.textures.set(type as FallbackType, texture);
    }
  }

  /**
   * Get fallback texture by type.
   */
  get(type: FallbackType): GPUTexture | null {
    return this.textures.get(type) ?? null;
  }

  /**
   * Get the "missing" fallback texture.
   */
  getMissing(): GPUTexture | null {
    return this.get('missing');
  }

  /**
   * Get the "loading" fallback texture.
   */
  getLoading(): GPUTexture | null {
    return this.get('loading');
  }

  /**
   * Get the "error" fallback texture.
   */
  getError(): GPUTexture | null {
    return this.get('error');
  }

  /**
   * Get the "default" fallback texture.
   */
  getDefault(): GPUTexture | null {
    return this.get('default');
  }

  /**
   * Get texture or fallback if not available.
   */
  getOrFallback(texture: GPUTexture | null | undefined, fallbackType: FallbackType = 'missing'): GPUTexture | null {
    return texture ?? this.get(fallbackType);
  }

  /**
   * Check if manager is initialized.
   */
  get isInitialized(): boolean {
    return this.device !== null;
  }

  /**
   * Dispose all fallback textures.
   */
  dispose(): void {
    for (const texture of this.textures.values()) {
      texture.destroy();
    }
    this.textures.clear();
    this.device = null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a simple solid color texture.
 */
export function generateSolidTexture(
  color: [number, number, number, number],
  size: number = 4
): GeneratedFallbackTexture {
  const data = new Uint8Array(size * size * 4);
  const rgba = colorToRGBA(color);

  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }

  return { data, width: size, height: size };
}

/**
 * Generate a flat normal map (pointing up).
 */
export function generateFlatNormalMap(size: number = 4): GeneratedFallbackTexture {
  const data = new Uint8Array(size * size * 4);
  
  // Flat normal: (0, 0, 1) encoded as (128, 128, 255)
  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = 128; // X
    data[i * 4 + 1] = 128; // Y
    data[i * 4 + 2] = 255; // Z (pointing up)
    data[i * 4 + 3] = 255; // A
  }

  return { data, width: size, height: size };
}

/**
 * Create a GPU texture for flat normal map.
 */
export function createFlatNormalTexture(device: GPUDevice, size: number = 4): GPUTexture {
  const { data, width, height } = generateFlatNormalMap(size);

  const texture = device.createTexture({
    label: 'fallback-flat-normal',
    size: { width, height },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    data.buffer as ArrayBuffer,
    { bytesPerRow: width * 4, offset: data.byteOffset },
    { width, height }
  );

  return texture;
}

