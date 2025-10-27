/**
 * Test setup for @engine/gfx-webgpu
 * Mocks WebGPU globals that are not available in Node.js/jsdom
 */

// WebGPU Buffer Usage Flags
(globalThis as any).GPUBufferUsage = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
};

// WebGPU Texture Usage Flags
(globalThis as any).GPUTextureUsage = {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  STORAGE_BINDING: 0x08,
  RENDER_ATTACHMENT: 0x10,
};

// WebGPU Shader Stage Flags
(globalThis as any).GPUShaderStage = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
};

// WebGPU Color Write Flags
(globalThis as any).GPUColorWrite = {
  RED: 0x1,
  GREEN: 0x2,
  BLUE: 0x4,
  ALPHA: 0x8,
  ALL: 0xF,
};

// WebGPU Map Mode Flags
(globalThis as any).GPUMapMode = {
  READ: 0x0001,
  WRITE: 0x0002,
};

// Additional WebGPU constants that might be needed
(globalThis as any).GPUTextureFormat = {
  // Common formats
  RGBA8Unorm: 'rgba8unorm',
  RGBA8UnormSRGB: 'rgba8unorm-srgb',
  BGRA8Unorm: 'bgra8unorm',
  BGRA8UnormSRGB: 'bgra8unorm-srgb',
  Depth24Plus: 'depth24plus',
  Depth24PlusStencil8: 'depth24plus-stencil8',
};

