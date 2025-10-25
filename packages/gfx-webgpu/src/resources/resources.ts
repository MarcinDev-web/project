import { createMainShaderCode } from '../shaders/main';
import { ShaderEntryPoint } from '../shaders/types';
import { DEFAULT_INSTANCE_GRID } from '../config';
import { Logger } from '@engine/core/utils';
import { TextureAtlas, type MaterialTextureData } from '../textures/TextureAtlas';

// Warn-once flag for mock environments lacking copyBufferToTexture
let warnedNoCopyBufferToTexture = false;

export interface GeometryData {
  vertices: Uint8Array;
  indices: Uint16Array;
  instanceCount: number;
  instanceOffsetData: Float32Array;
  instanceColorScaleData: Float32Array;
  instanceRotationData: Float32Array;
  instanceMaterialIdData?: Float32Array; // NEW: For texture atlas (optional)
}

export interface FrameResources {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  instanceOffsetBuffer: GPUBuffer;
  instanceColorScaleBuffer: GPUBuffer;
  instanceRotationBuffer: GPUBuffer;
  instanceMaterialIdBuffer: GPUBuffer; // NEW: For texture atlas
  uniformBuffer: GPUBuffer;
  uniformBindGroupLayout: GPUBindGroupLayout;
  textureBindGroupLayout: GPUBindGroupLayout;
  uniformData: Float32Array;
  renderPipeline: GPURenderPipeline;
  overlayPipeline: GPURenderPipeline;
  uniformBindGroup: GPUBindGroup;
  textureBindGroup: GPUBindGroup;
  /** Normal atlas texture handle for re-binding when regrouping materials */
  normalAtlasTexture: GPUTexture;
  atlasMetaBuffer?: GPUBuffer; // NEW: metadata buffer for atlas sampling and material params
  timestampQuerySet: GPUQuerySet | null;
  timestampResolveBuffer: GPUBuffer | null;
  timestampReadBuffer: GPUBuffer | null;
  timestampPeriod: number;
  sideTexture: GPUTexture;
  topTexture: GPUTexture;
  sampler: GPUSampler;
  depthTexture: GPUTexture;
  msaaColorTexture: GPUTexture;
  depthTextureView: GPUTextureView;
  msaaColorView: GPUTextureView;
}

/**
 * Validates geometry buffers before uploading them to the GPU, logging any inconsistencies.
 *
 * @param geometry - Packed vertex and index data alongside instancing buffers to verify.
 */
export function validateGeometryData(geometry: GeometryData): void {
  const strideBytes = 24;
  const numVertices = geometry.vertices.byteLength / strideBytes;

  if (!Number.isInteger(numVertices)) {
    Logger.error('Vertex buffer byteLength must be a multiple of 24 bytes');
  }
  if (geometry.indices.length % 3 !== 0) {
    Logger.error('Indices length should be a multiple of 3');
  }
  if (!geometry.indices.every((i) => i >= 0 && i < numVertices)) {
    Logger.error('Invalid index: references out-of-range vertex');
  }
  if (geometry.indices.byteLength % 2 !== 0) {
    Logger.error('Index buffer byteLength not 2-byte aligned');
  }

  // Minimum squared area threshold to treat triangles as non-degenerate.
  // Accounts for floating-point imprecision in normalized model units.
  const eps = 1e-10;
  let degenerateOk = true;
  const dv = new DataView(
    geometry.vertices.buffer as ArrayBuffer,
    geometry.vertices.byteOffset,
    geometry.vertices.byteLength
  );
  for (let i = 0; i + 2 < geometry.indices.length; i += 3) {
    const ia = geometry.indices[i]! * strideBytes;
    const ib = geometry.indices[i + 1]! * strideBytes;
    const ic = geometry.indices[i + 2]! * strideBytes;
    if (ic + 12 > geometry.vertices.byteLength) {
      degenerateOk = false;
      break;
    }
    const ax = dv.getFloat32(ia + 0, true);
    const ay = dv.getFloat32(ia + 4, true);
    const az = dv.getFloat32(ia + 8, true);
    const bx = dv.getFloat32(ib + 0, true);
    const by = dv.getFloat32(ib + 4, true);
    const bz = dv.getFloat32(ib + 8, true);
    const cx = dv.getFloat32(ic + 0, true);
    const cy = dv.getFloat32(ic + 4, true);
    const cz = dv.getFloat32(ic + 8, true);
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    const cxX = aby * acz - abz * acy;
    const cxY = abz * acx - abx * acz;
    const cxZ = abx * acy - aby * acx;
    const area2 = cxX * cxX + cxY * cxY + cxZ * cxZ;
    if (!(area2 > eps)) {
      Logger.warn('Degenerate triangle detected at tri index', i / 3, {
        i0: geometry.indices[i],
        i1: geometry.indices[i + 1],
        i2: geometry.indices[i + 2],
      });
      degenerateOk = false;
      break;
    }
  }

  if (!degenerateOk) {
    Logger.error('Degenerate triangle found in index buffer');
  }
}

/**
 * Converts a 32-bit floating point value to a 16-bit float bit pattern using truncation.
 *
 * @param value - The floating point value to convert.
 * @returns The IEEE-754 half-float representation stored in a 16-bit integer.
 */
function float32ToFloat16Bits(value: number): number {
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  f32[0] = value;
  const x = u32[0]!;
  const sign = (x >> 31) & 0x1;
  const exp = (x >> 23) & 0xff;
  let mant = x & 0x7fffff;
  if (exp === 255) {
    const isNan = mant !== 0 ? 1 : 0;
    return (sign << 15) | (0x1f << 10) | (isNan ? 0x200 : 0);
  }
  if (exp === 0) {
    return sign << 15;
  }
  const newExp = exp - 127 + 15;
  if (newExp >= 0x1f) {
    return (sign << 15) | (0x1f << 10);
  }
  if (newExp <= 0) {
    if (newExp < -10) {
      return sign << 15;
    }
    mant = (mant | 0x800000) >> (1 - newExp);
    return (sign << 15) | (mant >> 13);
  }
  return (sign << 15) | (newExp << 10) | (mant >> 13);
}

/**
 * Packs an interleaved float32 vertex buffer into the compact 20-byte-per-vertex layout used by the renderer.
 *
 * @param source - Float32 vertex attributes in [position(3), normal(3), uv(2)] order.
 * @returns A tightly packed `Uint8Array` ready for GPU upload.
 */
function packVerticesFloat32ToPacked20(source: Float32Array): Uint8Array {
  const floatsPerVertex = 8;
  const vertexCount = Math.floor(source.length / floatsPerVertex);
  const out = new Uint8Array(vertexCount * 20);
  const dv = new DataView(out.buffer);
  let inIdx = 0;
  for (let v = 0; v < vertexCount; v++) {
    const base = v * 20;
    dv.setFloat32(base + 0, source[inIdx + 0]!, true);
    dv.setFloat32(base + 4, source[inIdx + 1]!, true);
    dv.setFloat32(base + 8, source[inIdx + 2]!, true);
    const nx = Math.max(-1, Math.min(1, source[inIdx + 3]!));
    const ny = Math.max(-1, Math.min(1, source[inIdx + 4]!));
    const nz = Math.max(-1, Math.min(1, source[inIdx + 5]!));
    out[base + 12] = (Math.round(nx * 127) & 0xff) >>> 0;
    out[base + 13] = (Math.round(ny * 127) & 0xff) >>> 0;
    out[base + 14] = (Math.round(nz * 127) & 0xff) >>> 0;
    out[base + 15] = 0;
    const u = source[inIdx + 6]!;
    const vCoord = source[inIdx + 7]!;
    dv.setUint16(base + 16, float32ToFloat16Bits(u), true);
    dv.setUint16(base + 18, float32ToFloat16Bits(vCoord), true);
    inIdx += floatsPerVertex;
  }
  return out;
}

/**
 * Packs an interleaved float32 vertex buffer into the compact 24-byte-per-vertex layout:
 * position float32x3 (12B), normal snorm8x4 (4B), uv float16x2 (4B), AO unorm8x4 (4B).
 * AO is stored in the X channel; YZW are zero.
 */
function packVerticesFloat32ToPacked24(source: Float32Array, defaultAO = 1.0): Uint8Array {
  const floatsPerVertex = 8;
  const vertexCount = Math.floor(source.length / floatsPerVertex);
  const out = new Uint8Array(vertexCount * 24);
  const dv = new DataView(out.buffer);
  let inIdx = 0;
  const aoByte = Math.max(0, Math.min(255, Math.round(defaultAO * 255))) >>> 0;
  for (let v = 0; v < vertexCount; v++) {
    const base = v * 24;
    dv.setFloat32(base + 0, source[inIdx + 0]!, true);
    dv.setFloat32(base + 4, source[inIdx + 1]!, true);
    dv.setFloat32(base + 8, source[inIdx + 2]!, true);
    const nx = Math.max(-1, Math.min(1, source[inIdx + 3]!));
    const ny = Math.max(-1, Math.min(1, source[inIdx + 4]!));
    const nz = Math.max(-1, Math.min(1, source[inIdx + 5]!));
    out[base + 12] = (Math.round(nx * 127) & 0xff) >>> 0;
    out[base + 13] = (Math.round(ny * 127) & 0xff) >>> 0;
    out[base + 14] = (Math.round(nz * 127) & 0xff) >>> 0;
    out[base + 15] = 0;
    const u = source[inIdx + 6]!;
    const vCoord = source[inIdx + 7]!;
    dv.setUint16(base + 16, float32ToFloat16Bits(u), true);
    dv.setUint16(base + 18, float32ToFloat16Bits(vCoord), true);
    // AO unorm8x4 at offset 20
    out[base + 20] = aoByte;
    out[base + 21] = 0;
    out[base + 22] = 0;
    out[base + 23] = 0;
    inIdx += floatsPerVertex;
  }
  return out;
}

// Removed unused DEFAULT_GEOMETRY_SOURCE_VERTICES (kept subdivided cube instead)

// Procedurally generate a subdivided cube to increase the number of vertices
// compared to the fixed 24-vertex cube above. This provides denser geometry
// for testing performance and shading without changing higher-level APIs.
function buildSubdividedCube(segmentsPerEdge: number): { vertices: Float32Array; indices: Uint16Array } {
  const clampSegments = Math.max(1, Math.min(segmentsPerEdge | 0, 32));
  const seg = clampSegments;
  const vertsPerFace = (seg + 1) * (seg + 1);
  const trisPerFace = seg * seg * 2;
  const faces = 6;

  const vertexFloats = new Float32Array(faces * vertsPerFace * 8);
  const indices = new Uint16Array(faces * trisPerFace * 3);

  let vCursor = 0;
  let iCursor = 0;

  // Define per-face frames where tangentU x tangentV = normal (ensures CCW winding)
  const facesDef: Array<{ center: [number, number, number]; normal: [number, number, number]; u: [number, number, number]; v: [number, number, number] }> = [
    { center: [0, 0, 0.5], normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, // +Z (front)
    { center: [0, 0, -0.5], normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }, // -Z (back)
    { center: [0.5, 0, 0], normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, // +X (right)
    { center: [-0.5, 0, 0], normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] }, // -X (left)
    { center: [0, 0.5, 0], normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, // +Y (top)
    { center: [0, -0.5, 0], normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] }, // -Y (bottom)
  ];

  for (const f of facesDef) {
    // Generate vertices for this face
    for (let y = 0; y <= seg; y++) {
      const v01 = y / seg;
      const vOff = v01 - 0.5;
      for (let x = 0; x <= seg; x++) {
        const u01 = x / seg;
        const uOff = u01 - 0.5;

        const px = f.center[0] + uOff * f.u[0] + vOff * f.v[0];
        const py = f.center[1] + uOff * f.u[1] + vOff * f.v[1];
        const pz = f.center[2] + uOff * f.u[2] + vOff * f.v[2];

        // position(3)
        vertexFloats[vCursor + 0] = px;
        vertexFloats[vCursor + 1] = py;
        vertexFloats[vCursor + 2] = pz;
        // normal(3) - constant per face
        vertexFloats[vCursor + 3] = f.normal[0];
        vertexFloats[vCursor + 4] = f.normal[1];
        vertexFloats[vCursor + 5] = f.normal[2];
        // uv(2)
        vertexFloats[vCursor + 6] = u01;
        vertexFloats[vCursor + 7] = v01;
        vCursor += 8;
      }
    }

    // Generate indices for this face (CCW in (u,v) space)
    const faceBase = (vCursor / 8) - vertsPerFace;
    for (let y = 0; y < seg; y++) {
      for (let x = 0; x < seg; x++) {
        const rowStride = seg + 1;
        const v00 = faceBase + y * rowStride + x;
        const v10 = v00 + 1;
        const v01 = v00 + rowStride;
        const v11 = v01 + 1;
        indices[iCursor++] = v00;
        indices[iCursor++] = v10;
        indices[iCursor++] = v11;
        indices[iCursor++] = v00;
        indices[iCursor++] = v11;
        indices[iCursor++] = v01;
      }
    }
  }

  return { vertices: vertexFloats, indices };
}

// Increase default vertex count via a 4x4 subdivision per face (adjust as needed)
const SUBDIVIDED_CUBE_SEGMENTS = 4;
const SUBDIVIDED_CUBE = buildSubdividedCube(SUBDIVIDED_CUBE_SEGMENTS);

export const DEFAULT_GEOMETRY: GeometryData = {
  vertices: packVerticesFloat32ToPacked24(SUBDIVIDED_CUBE.vertices, 1.0),
  indices: SUBDIVIDED_CUBE.indices,
  // Generate a small grid of instances to exercise instanced rendering by default
  // dimensions x dimensions grid
  instanceCount: DEFAULT_INSTANCE_GRID.dimensions * DEFAULT_INSTANCE_GRID.dimensions,
  instanceOffsetData: (() => {
    const dim = DEFAULT_INSTANCE_GRID.dimensions;
    const spacing = DEFAULT_INSTANCE_GRID.spacing;
    const data = new Float32Array(dim * dim * 3);
    let i = 0;
    const half = (dim - 1) * 0.5 * spacing;
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        data[i++] = x * spacing - half;
        data[i++] = 0;
        data[i++] = y * spacing - half;
      }
    }
    return data;
  })(),
  instanceColorScaleData: (() => {
    const dim = DEFAULT_INSTANCE_GRID.dimensions;
    const data = new Float32Array(dim * dim * 4);
    let i = 0;
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const fx = x / (dim - 1);
        const fy = y / (dim - 1);
        // simple color ramp; scale (w) stays 1
        data[i++] = 0.3 + 0.7 * fx;
        data[i++] = 0.3 + 0.7 * fy;
        data[i++] = 0.35 + 0.6 * (1 - fx * fy);
        data[i++] = 1.0;
      }
    }
    return data;
  })(),
  instanceRotationData: (() => {
    const dim = DEFAULT_INSTANCE_GRID.dimensions;
    const count = dim * dim;
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      // identity quaternion
      data[i * 4 + 0] = 0;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 1;
    }
    return data;
  })(),
  // NEW: Material IDs for texture atlas (all instances use material 0 by default)
  instanceMaterialIdData: (() => {
    const dim = DEFAULT_INSTANCE_GRID.dimensions;
    const count = dim * dim;
    const data = new Float32Array(count);
    data.fill(0); // All instances use default material (ID 0)
    return data;
  })(),
};

// Validate bundled default geometry at module load time to catch errors early.
validateGeometryData(DEFAULT_GEOMETRY);

export interface TimestampResources {
  querySet: GPUQuerySet | null;
  resolveBuffer: GPUBuffer | null;
  readBuffer: GPUBuffer | null;
}

/**
 * Creates timestamp query resources when supported by the adapter.
 *
 * @param device - Active GPU device used to allocate query resources.
 * @param supportsTimestampQueries - Indicates whether the adapter exposes timestamp queries.
 * @param counts - Configuration for the number of queries and buffer size in bytes.
 * @returns Query set, resolve buffer, and read buffer handles (null when unsupported).
 */
export function createTimestampResources(
  device: GPUDevice,
  supportsTimestampQueries: boolean,
  counts: { queryCount: number; bufferSize: number }
): TimestampResources {
  if (!supportsTimestampQueries) {
    return { querySet: null, resolveBuffer: null, readBuffer: null };
  }

  const querySet = device.createQuerySet({
    label: 'frame-timestamp-query-set',
    type: 'timestamp',
    count: counts.queryCount,
  });

  const resolveBuffer = device.createBuffer({
    label: 'frame-timestamp-resolve-buffer',
    size: counts.bufferSize,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });

  const readBuffer = device.createBuffer({
    label: 'frame-timestamp-read-buffer',
    size: counts.bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  return { querySet, resolveBuffer, readBuffer };
}

/**
 * Creates GPU buffers for the provided geometry and uploads their contents to the device.
 *
 * @param device - Active GPU device used for buffer allocation and uploads.
 * @param geometry - Geometry payload including packed vertices, indices, and instancing data.
 * @returns GPU buffer references for vertex, index, and instancing attributes.
 */
export function createGeometryBuffers(
  device: GPUDevice,
  geometry: GeometryData
): {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  instanceOffsetBuffer: GPUBuffer;
  instanceColorScaleBuffer: GPUBuffer;
  instanceRotationBuffer: GPUBuffer;
  instanceMaterialIdBuffer: GPUBuffer; // NEW
} {
  // Validate provided geometry early to surface issues before GPU resource creation.
  validateGeometryData(geometry);
  const vertexBuffer = device.createBuffer({
    label: 'cube-vertex-buffer',
    size: geometry.vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    vertexBuffer,
    0,
    geometry.vertices.buffer as ArrayBuffer,
    geometry.vertices.byteOffset,
    geometry.vertices.byteLength
  );

  const indexBuffer = device.createBuffer({
    label: 'cube-index-buffer',
    size: geometry.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    indexBuffer,
    0,
    geometry.indices.buffer as ArrayBuffer,
    geometry.indices.byteOffset,
    geometry.indices.byteLength
  );

  const instanceOffsetBuffer = device.createBuffer({
    label: 'instance-offset-buffer',
    size: geometry.instanceOffsetData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    instanceOffsetBuffer,
    0,
    geometry.instanceOffsetData.buffer as ArrayBuffer,
    geometry.instanceOffsetData.byteOffset,
    geometry.instanceOffsetData.byteLength
  );

  const instanceColorScaleBuffer = device.createBuffer({
    label: 'instance-color-scale-buffer',
    size: geometry.instanceColorScaleData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    instanceColorScaleBuffer,
    0,
    geometry.instanceColorScaleData.buffer as ArrayBuffer,
    geometry.instanceColorScaleData.byteOffset,
    geometry.instanceColorScaleData.byteLength
  );

  const instanceRotationBuffer = device.createBuffer({
    label: 'instance-rotation-buffer',
    size: geometry.instanceRotationData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    instanceRotationBuffer,
    0,
    geometry.instanceRotationData.buffer as ArrayBuffer,
    geometry.instanceRotationData.byteOffset,
    geometry.instanceRotationData.byteLength
  );

  // NEW: Material ID buffer for texture atlas
  const expectedMaterialIdsBytes = Math.max(
    geometry.instanceMaterialIdData?.byteLength ?? 0,
    Math.max(0, geometry.instanceCount) * 4
  );
  const instanceMaterialIdBuffer = device.createBuffer({
    label: 'instance-material-id-buffer',
    size: expectedMaterialIdsBytes,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  if (geometry.instanceMaterialIdData && geometry.instanceMaterialIdData.byteLength > 0) {
    device.queue.writeBuffer(
      instanceMaterialIdBuffer,
      0,
      geometry.instanceMaterialIdData.buffer as ArrayBuffer,
      geometry.instanceMaterialIdData.byteOffset,
      geometry.instanceMaterialIdData.byteLength
    );
  } else if (expectedMaterialIdsBytes > 0) {
    // Initialize with zeros to ensure defined data; default to material 0
    const zeros = new Uint8Array(expectedMaterialIdsBytes);
    device.queue.writeBuffer(instanceMaterialIdBuffer, 0, zeros);
  }

  return {
    vertexBuffer,
    indexBuffer,
    instanceOffsetBuffer,
    instanceColorScaleBuffer,
    instanceRotationBuffer,
    instanceMaterialIdBuffer, // NEW
  };
}

/**
 * Allocates a uniform buffer and accompanying bind group layout for per-frame data.
 *
 * @param device - Active GPU device used to allocate resources.
 * @param options - Uniform buffer configuration including byte size and float array length.
 * @returns The GPU buffer, bind group layout, and CPU-side backing array.
 */
export function createUniformResources(
  device: GPUDevice,
  options: { bufferSize: number; dataLength: number }
): {
  uniformBuffer: GPUBuffer;
  uniformBindGroupLayout: GPUBindGroupLayout;
  uniformData: Float32Array;
} {
  const uniformBuffer = device.createBuffer({
    label: 'frame-uniform-buffer',
    size: options.bufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroupLayout = device.createBindGroupLayout({
    label: 'frame-uniform-bgl',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const uniformData = new Float32Array(options.dataLength);

  return { uniformBuffer, uniformBindGroupLayout, uniformData };
}

/**
 * Creates procedural textures, sampler, and bind group for material sampling.
 *
 * @param device - Active GPU device used to create textures and sampler.
 * @param textureBindGroupLayout - Optional existing layout to reuse; created when omitted.
 * @param textureSize - Width and height in pixels of the generated textures.
 * @returns Generated textures, sampler, layout, and bind group references.
 */
export function createTextureResources(
  device: GPUDevice,
  textureBindGroupLayout?: GPUBindGroupLayout,
  textureSize = 128
): {
  sideTexture: GPUTexture;
  topTexture: GPUTexture;
  sampler: GPUSampler;
  textureBindGroupLayout: GPUBindGroupLayout;
  textureBindGroup: GPUBindGroup;
} {
  const layout =
    textureBindGroupLayout ??
    device.createBindGroupLayout({
      label: 'material-texture-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

  const sideTexData = makeTextureData(textureSize, textureSize, 'stripes');
  const topTexData = makeTextureData(textureSize, textureSize, 'grid');
  const sideTexture = createTextureFromData(
    device,
    textureSize,
    textureSize,
    sideTexData,
    'side-texture'
  );
  const topTexture = createTextureFromData(
    device,
    textureSize,
    textureSize,
    topTexData,
    'top-texture'
  );

  const sampler = device.createSampler({
    label: 'material-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
  });

  const textureBindGroup = device.createBindGroup({
    label: 'material-texture-bg',
    layout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: sideTexture.createView({ label: 'side-texture-view' }) },
      { binding: 2, resource: topTexture.createView({ label: 'top-texture-view' }) },
    ],
  });

  return { sideTexture, topTexture, sampler, textureBindGroupLayout: layout, textureBindGroup };
}

// Procedural texture generation helpers for atlas materials
// NOTE: For advanced procedural textures with PBR support, see ProceduralTextureGenerator
// These simple functions are kept for backward compatibility and quick atlas generation

function createStoneTexture(size: number, color: [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const [r, g, b, a] = color;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Add noise and variation
      const noise = (Math.random() - 0.5) * 0.3;
      const darkPatch = (x % 8 < 2 || y % 8 < 2) ? -0.1 : 0;
      data[i + 0] = Math.max(0, Math.min(255, (r + noise + darkPatch) * 255));
      data[i + 1] = Math.max(0, Math.min(255, (g + noise + darkPatch) * 255));
      data[i + 2] = Math.max(0, Math.min(255, (b + noise + darkPatch) * 255));
      data[i + 3] = a * 255;
    }
  }
  return data;
}

function createWoodTexture(size: number, color: [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const [r, g, b, a] = color;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Wood grain pattern
      const grain = Math.sin(y * 0.2) * 0.1;
      const plankLine = (y % (size / 4) < 2) ? -0.2 : 0;
      const noise = (Math.random() - 0.5) * 0.1;
      data[i + 0] = Math.max(0, Math.min(255, (r + grain + plankLine + noise) * 255));
      data[i + 1] = Math.max(0, Math.min(255, (g + grain + plankLine + noise) * 255));
      data[i + 2] = Math.max(0, Math.min(255, (b + grain + plankLine + noise) * 255));
      data[i + 3] = a * 255;
    }
  }
  return data;
}

function createMetalTexture(size: number, color: [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const [r, g, b, a] = color;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Smooth metallic look with subtle gradient
      const gradient = (y / size) * 0.1 - 0.05;
      const noise = (Math.random() - 0.5) * 0.05;
      data[i + 0] = Math.max(0, Math.min(255, (r + gradient + noise) * 255));
      data[i + 1] = Math.max(0, Math.min(255, (g + gradient + noise) * 255));
      data[i + 2] = Math.max(0, Math.min(255, (b + gradient + noise) * 255));
      data[i + 3] = a * 255;
    }
  }
  return data;
}

function createNoiseTexture(size: number, color: [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const [r, g, b, a] = color;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Strong noise pattern for dirt/grass
      const noise = (Math.random() - 0.5) * 0.3;
      data[i + 0] = Math.max(0, Math.min(255, (r + noise) * 255));
      data[i + 1] = Math.max(0, Math.min(255, (g + noise) * 255));
      data[i + 2] = Math.max(0, Math.min(255, (b + noise) * 255));
      data[i + 3] = a * 255;
    }
  }
  return data;
}

function createBrickTexture(size: number, color: [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const [r, g, b, a] = color;
  const brickHeight = size / 4;
  const mortarColor = 0.35; // Gray mortar
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const row = Math.floor(y / brickHeight);
      const offset = (row % 2) * (size / 2);
      const localX = (x + size - offset) % size;
      
      // Mortar lines
      const isMortar = (y % brickHeight < 2) || (localX % (size / 2) < 2);
      const noise = (Math.random() - 0.5) * 0.1;
      
      if (isMortar) {
        data[i + 0] = mortarColor * 255;
        data[i + 1] = mortarColor * 255;
        data[i + 2] = mortarColor * 255;
      } else {
        data[i + 0] = Math.max(0, Math.min(255, (r + noise) * 255));
        data[i + 1] = Math.max(0, Math.min(255, (g + noise) * 255));
        data[i + 2] = Math.max(0, Math.min(255, (b + noise) * 255));
      }
      data[i + 3] = a * 255;
    }
  }
  return data;
}

/**
 * Creates a texture atlas with default materials.
 *
 * PERFORMANCE OPTIMIZATION:
 * - Single atlas texture instead of N separate textures
 * - Reduces bind calls from 2*N to 2 (atlas + sampler)
 * - Example: 100 materials = 2 calls instead of 200!
 *
 * @param device - Active GPU device used to create the atlas texture.
 * @param textureBindGroupLayout - Optional existing layout to reuse.
 * @param atlasSize - Size of the atlas texture (default 2048x2048).
 * @param materialTextureSize - Size of individual material textures (default 128x128).
 * @returns Atlas texture, sampler, layout, bind group, and TextureAtlas instance.
 */
export function createTextureAtlas(
  device: GPUDevice,
  _textureBindGroupLayout?: GPUBindGroupLayout,
  atlasSize = 2048,
  materialTextureSize = 128
): {
  atlasTexture: GPUTexture;
  normalAtlasTexture: GPUTexture;
  sampler: GPUSampler;
  textureBindGroupLayout: GPUBindGroupLayout;
  textureBindGroup: GPUBindGroup;
  atlasMetaBuffer: GPUBuffer;
  atlas: TextureAtlas;
} {
  // Note: override provided layout to include normal atlas binding

  // Create atlas with mipmapping and anisotropic filtering enabled
  const atlas = new TextureAtlas({
    atlasSize,
    materialTextureSize,
    padding: 2,
    generateMipmaps: true,
    filterMode: 'anisotropic',
    anisotropyLevel: 8,
  });

  // Add default materials to atlas (16 varied materials to prevent black blocks)
  // Using procedural generation for variety
  const defaultMaterials: MaterialTextureData[] = [
    // 0: Default (gray stripes/grid)
    {
      name: 'default',
      sideData: makeTextureData(materialTextureSize, materialTextureSize, 'stripes'),
      topData: makeTextureData(materialTextureSize, materialTextureSize, 'grid'),
      size: materialTextureSize,
    },
    // 1: Stone (gray, cobblestone-like)
    {
      name: 'stone',
      sideData: createStoneTexture(materialTextureSize, [0.5, 0.5, 0.5, 1]),
      topData: createStoneTexture(materialTextureSize, [0.5, 0.5, 0.5, 1]),
      size: materialTextureSize,
    },
    // 2: Wood (brown planks)
    {
      name: 'wood',
      sideData: createWoodTexture(materialTextureSize, [0.55, 0.35, 0.2, 1]),
      topData: makeTextureData(materialTextureSize, materialTextureSize, 'grid'),
      size: materialTextureSize,
    },
    // 3: Metal (silver smooth)
    {
      name: 'metal',
      sideData: createMetalTexture(materialTextureSize, [0.7, 0.7, 0.75, 1]),
      topData: createMetalTexture(materialTextureSize, [0.7, 0.7, 0.75, 1]),
      size: materialTextureSize,
    },
    // 4: Grass (green top, brown sides)
    {
      name: 'grass',
      sideData: createNoiseTexture(materialTextureSize, [0.4, 0.3, 0.2, 1]),
      topData: createNoiseTexture(materialTextureSize, [0.3, 0.6, 0.2, 1]),
      size: materialTextureSize,
    },
    // 5: Dirt (brown noise)
    {
      name: 'dirt',
      sideData: createNoiseTexture(materialTextureSize, [0.4, 0.3, 0.2, 1]),
      topData: createNoiseTexture(materialTextureSize, [0.4, 0.3, 0.2, 1]),
      size: materialTextureSize,
    },
    // 6: Brick (red bricks)
    {
      name: 'brick',
      sideData: createBrickTexture(materialTextureSize, [0.7, 0.2, 0.15, 1]),
      topData: createBrickTexture(materialTextureSize, [0.7, 0.2, 0.15, 1]),
      size: materialTextureSize,
    },
    // 7: Glass (light blue, smooth)
    {
      name: 'glass',
      sideData: createMetalTexture(materialTextureSize, [0.6, 0.7, 0.85, 1]),
      topData: createMetalTexture(materialTextureSize, [0.6, 0.7, 0.85, 1]),
      size: materialTextureSize,
    },
    // 8: Gold (yellow/gold)
    {
      name: 'gold',
      sideData: createMetalTexture(materialTextureSize, [0.9, 0.7, 0.2, 1]),
      topData: createMetalTexture(materialTextureSize, [0.9, 0.7, 0.2, 1]),
      size: materialTextureSize,
    },
    // 9: Sand (tan noise)
    {
      name: 'sand',
      sideData: createNoiseTexture(materialTextureSize, [0.85, 0.75, 0.5, 1]),
      topData: createNoiseTexture(materialTextureSize, [0.85, 0.75, 0.5, 1]),
      size: materialTextureSize,
    },
    // 10: Plastic Red (smooth, bright red)
    {
      name: 'plastic_red',
      sideData: createMetalTexture(materialTextureSize, [0.9, 0.15, 0.15, 1]),
      topData: createMetalTexture(materialTextureSize, [0.9, 0.15, 0.15, 1]),
      size: materialTextureSize,
    },
    // 11: Plastic Blue (smooth, bright blue)
    {
      name: 'plastic_blue',
      sideData: createMetalTexture(materialTextureSize, [0.15, 0.4, 0.9, 1]),
      topData: createMetalTexture(materialTextureSize, [0.15, 0.4, 0.9, 1]),
      size: materialTextureSize,
    },
    // 12: Plastic Green (smooth, bright green)
    {
      name: 'plastic_green',
      sideData: createMetalTexture(materialTextureSize, [0.15, 0.85, 0.15, 1]),
      topData: createMetalTexture(materialTextureSize, [0.15, 0.85, 0.15, 1]),
      size: materialTextureSize,
    },
    // 13: Plastic Yellow (smooth, bright yellow)
    {
      name: 'plastic_yellow',
      sideData: createMetalTexture(materialTextureSize, [0.95, 0.9, 0.15, 1]),
      topData: createMetalTexture(materialTextureSize, [0.95, 0.9, 0.15, 1]),
      size: materialTextureSize,
    },
    // 14: Concrete (gray, smooth)
    {
      name: 'concrete',
      sideData: createNoiseTexture(materialTextureSize, [0.6, 0.6, 0.6, 1]),
      topData: createNoiseTexture(materialTextureSize, [0.6, 0.6, 0.6, 1]),
      size: materialTextureSize,
    },
    // 15: Ice (light blue, smooth)
    {
      name: 'ice',
      sideData: createMetalTexture(materialTextureSize, [0.7, 0.85, 0.95, 1]),
      topData: createMetalTexture(materialTextureSize, [0.7, 0.85, 0.95, 1]),
      size: materialTextureSize,
    },
  ];

  for (const material of defaultMaterials) {
    atlas.addMaterial(material);
  }

  // Build atlas texture data with mipmaps
  const { baseLevel: atlasData, mipmaps: atlasMipmaps } = atlas.buildAtlasDataWithMipmaps();
  const { baseLevel: normalAtlasData, mipmaps: normalMipmaps } = atlas.buildNormalAtlasDataWithMipmaps();

  // Calculate mip level count
  const mipLevelCount = Math.floor(Math.log2(atlasSize)) + 1;

  // Create GPU texture from atlas with mipmaps
  const atlasTexture = device.createTexture({
    label: 'material-atlas',
    size: [atlasSize, atlasSize, 1],
    format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    mipLevelCount: atlas.getConfig().generateMipmaps ? mipLevelCount : 1,
  });

  const normalAtlasTexture = device.createTexture({
    label: 'material-normal-atlas',
    size: [atlasSize, atlasSize, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    mipLevelCount: atlas.getConfig().generateMipmaps ? mipLevelCount : 1,
  });

  // Upload base level and mipmaps
  if (atlas.getConfig().generateMipmaps && atlasMipmaps.length > 0) {
    for (let mipLevel = 0; mipLevel < atlasMipmaps.length; mipLevel++) {
      const mipData = atlasMipmaps[mipLevel]!;
      const mipSize = Math.max(1, atlasSize >> mipLevel);
      
      device.queue.writeTexture(
        { texture: atlasTexture, mipLevel },
        mipData as unknown as GPUAllowSharedBufferSource,
        { bytesPerRow: mipSize * 4, rowsPerImage: mipSize },
        [mipSize, mipSize, 1]
      );
    }

    for (let mipLevel = 0; mipLevel < normalMipmaps.length; mipLevel++) {
      const mipData = normalMipmaps[mipLevel]!;
      const mipSize = Math.max(1, atlasSize >> mipLevel);
      
      device.queue.writeTexture(
        { texture: normalAtlasTexture, mipLevel },
        mipData as unknown as GPUAllowSharedBufferSource,
        { bytesPerRow: mipSize * 4, rowsPerImage: mipSize },
        [mipSize, mipSize, 1]
      );
    }
  } else {
    // Fallback to single level
    device.queue.writeTexture(
      { texture: atlasTexture },
      atlasData as unknown as GPUAllowSharedBufferSource,
      { bytesPerRow: atlasSize * 4, rowsPerImage: atlasSize },
      [atlasSize, atlasSize, 1]
    );

    device.queue.writeTexture(
      { texture: normalAtlasTexture },
      normalAtlasData as unknown as GPUAllowSharedBufferSource,
      { bytesPerRow: atlasSize * 4, rowsPerImage: atlasSize },
      [atlasSize, atlasSize, 1]
    );
  }

  // Create sampler with mipmapping and anisotropic filtering
  const config = atlas.getConfig();
  const sampler = device.createSampler({
    label: 'material-atlas-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: config.generateMipmaps ? 'linear' : 'nearest',
    addressModeU: 'clamp-to-edge', // Important: prevent sampling across materials
    addressModeV: 'clamp-to-edge',
    maxAnisotropy: config.filterMode === 'anisotropic' ? (config.anisotropyLevel || 8) : 1,
  });

  // Expand layout to include normal atlas at binding 2 and metadata storage buffer at binding 3
  const extendedLayout = device.createBindGroupLayout({
    label: 'material-atlas-bgl+normal',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      // Shadow atlas depth + comparison sampler (placeholders initially)
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      // IBL resources (placeholders initially)
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // brdf LUT 2D
      { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: 'cube' } }, // prefiltered env cube
    ],
  });

  // Create placeholder shadow resources (1x1) to satisfy layout; replaced later by ShadowPass
  const shadowPlaceholder = device.createTexture({
    label: 'shadow-atlas-placeholder',
    size: [1, 1, 1],
    format: 'depth32float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const shadowSamplerCmp = device.createSampler({
    label: 'shadow-comparison-sampler',
    compare: 'less-equal',
    magFilter: 'linear',
    minFilter: 'linear',
  });

  // Placeholders for IBL
  const brdfLutPlaceholder = device.createTexture({
    label: 'brdf-lut-placeholder',
    size: [4, 4, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const envCubePlaceholder = device.createTexture({
    label: 'prefiltered-env-placeholder',
    size: [1, 1, 6],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const textureBindGroup = device.createBindGroup({
    label: 'material-atlas-bg',
    layout: extendedLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: atlasTexture.createView({ label: 'atlas-texture-view' }) },
      { binding: 2, resource: normalAtlasTexture.createView({ label: 'atlas-normal-texture-view' }) },
      // binding(3) filled after atlasMetaBuffer creation below
      { binding: 4, resource: shadowPlaceholder.createView({ label: 'shadow-atlas-depth-view' }) },
      { binding: 5, resource: shadowSamplerCmp },
      { binding: 6, resource: brdfLutPlaceholder.createView({ label: 'brdf-lut-view' }) },
      { binding: 7, resource: envCubePlaceholder.createView({ dimension: 'cube' }) },
    ],
  });

  // Limit noisy logs by routing through logger (which can be filtered) and avoid repeats here
  // Note: creation count is already logged in TextureAtlas itself (once per session)
  // Keeping this info-level log for debugging while reducing spam compared to console.log
  Logger.info(`[TextureAtlas] Created with ${atlas.getMaterialCount()} materials`);

  // --------- NEW: Build atlas metadata storage buffer ---------
  // Each material has 2 rects (side, top), and material params packed into 48 bytes per entry
  // struct AtlasMeta {
  //   sideRect : vec4<f32>; // xy = offset, zw = scale
  //   topRect  : vec4<f32>;
  //   flags    : u32;       // bit0: hasNormal
  //   saturation: f32;      // default 1.15
  //   metallic : f32;       // default 0.0
  //   roughness: f32;       // default 0.6
  // };
  const matCount = atlas.getMaterialCount();
  const metaStrideFloats = 12; // 48 bytes
  const metaBufferData = new ArrayBuffer(matCount * metaStrideFloats * 4);
  const metaF32 = new Float32Array(metaBufferData);
  const metaU32 = new Uint32Array(metaBufferData);

  for (let i = 0; i < matCount; i++) {
    const side = atlas.getSideRegion(i)!;
    const top = atlas.getTopRegion(i)!;
    const base = i * metaStrideFloats;
    // sideRect
    metaF32[base + 0] = side.offsetX;
    metaF32[base + 1] = side.offsetY;
    metaF32[base + 2] = side.scaleX;
    metaF32[base + 3] = side.scaleY;
    // topRect
    metaF32[base + 4] = top.offsetX;
    metaF32[base + 5] = top.offsetY;
    metaF32[base + 6] = top.scaleX;
    metaF32[base + 7] = top.scaleY;
    // flags + params
    // flags at u32 slot (base+8 as u32), then saturation/metallic/roughness as f32
    const hasNormals = true; // we always fill normal atlas (flat if missing)
    metaU32[base + 8] = hasNormals ? 1 : 0;
    metaF32[base + 9] = 1.15; // saturationScale
    metaF32[base + 10] = 0.0; // metallic default
    metaF32[base + 11] = 0.6; // roughness default
  }

  const atlasMetaBuffer = device.createBuffer({
    label: 'material-atlas-meta-buffer',
    size: metaF32.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });
  device.queue.writeBuffer(atlasMetaBuffer, 0, metaBufferData);

  // Recreate bind group with storage buffer binding 3 (cannot modify entries array in place on WebGPU)
  const atlasBindGroup = device.createBindGroup({
    label: 'material-atlas-bg',
    layout: extendedLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: atlasTexture.createView({ label: 'atlas-texture-view' }) },
      { binding: 2, resource: normalAtlasTexture.createView({ label: 'atlas-normal-texture-view' }) },
      { binding: 3, resource: { buffer: atlasMetaBuffer } },
      { binding: 4, resource: shadowPlaceholder.createView({ label: 'shadow-atlas-depth-view' }) },
      { binding: 5, resource: shadowSamplerCmp },
      { binding: 6, resource: brdfLutPlaceholder.createView({ label: 'brdf-lut-view' }) },
      { binding: 7, resource: envCubePlaceholder.createView({ dimension: 'cube' }) },
    ],
  });

  return {
    atlasTexture,
    normalAtlasTexture,
    sampler,
    textureBindGroupLayout: extendedLayout,
    textureBindGroup: atlasBindGroup,
    atlasMetaBuffer,
    atlas,
  };
}

// Cache shader module per device to avoid duplicate module creation when pipelines are recreated
const deviceIdToShaderModule = new WeakMap<GPUDevice, GPUShaderModule>();

/**
 * Builds the primary render and overlay pipelines, reusing cached shader modules per device.
 *
 * @param device - Active GPU device used to compile pipelines.
 * @param presentationFormat - Swap chain texture format supplied by the canvas context.
 * @param uniformBindGroupLayout - Bind group layout containing camera and frame uniforms.
 * @param textureBindGroupLayout - Bind group layout describing material textures and sampler.
 * @param vertexBuffers - Vertex buffer layouts consumed by the vertex stage.
 * @param options - Pipeline creation options including MSAA sample count and status element.
 * @returns Promise resolving to the render and overlay pipelines when validation succeeds.
 */
export function createPipelines(
  device: GPUDevice,
  colorFormat: GPUTextureFormat,
  uniformBindGroupLayout: GPUBindGroupLayout,
  textureBindGroupLayout: GPUBindGroupLayout,
  vertexBuffers: GPUVertexBufferLayout[],
  options: { sampleCount: number; statusEl: HTMLElement }
): Promise<{ renderPipeline: GPURenderPipeline; overlayPipeline: GPURenderPipeline }> {
  let shaderModule = deviceIdToShaderModule.get(device);
  if (!shaderModule) {
    shaderModule = device.createShaderModule({
      label: 'main-shader',
      code: createMainShaderCode(),
    });
    deviceIdToShaderModule.set(device, shaderModule);
  }

  const shaderModuleAny = shaderModule as unknown as { getCompilationInfo?: () => Promise<{ messages: Array<{ type: string }> }> };
  return Promise.resolve()
    .then(() => (typeof shaderModuleAny.getCompilationInfo === 'function' ? shaderModuleAny.getCompilationInfo() : { messages: [] as Array<{ type: string }> }))
    .then((compilationInfo) => {
      const messages = Array.isArray((compilationInfo as any).messages) ? (compilationInfo as any).messages as Array<{ type: string }> : [] as Array<{ type: string }>;
      const shaderWarnings = messages.filter((m: { type: string }) => m.type === 'warning');
      if (shaderWarnings.length > 0) {
        Logger.warn('WGSL warnings:', shaderWarnings);
      }
      const shaderErrors = messages.filter((m: { type: string }) => m.type === 'error');
      if (shaderErrors.length > 0) {
        Logger.error('WGSL compilation errors:', shaderErrors as unknown as Error);
        options.statusEl.textContent = 'Shader compilation error. See console for details.';
        throw new Error('Shader compilation error');
      }
    })
    .then(async () => {
      const pipelineLayout = device.createPipelineLayout({
        label: 'cube-pipeline-layout',
        bindGroupLayouts: [uniformBindGroupLayout, textureBindGroupLayout],
      });

      const devAny = device as unknown as { pushErrorScope?: (scope: GPUErrorFilter) => void; popErrorScope?: () => Promise<GPUError | null> };
      const hasErrorScope = typeof devAny.pushErrorScope === 'function' && typeof devAny.popErrorScope === 'function';
      if (hasErrorScope) devAny.pushErrorScope!('validation');
      const renderPipeline = device.createRenderPipeline({
        label: 'cube-pipeline',
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: ShaderEntryPoint.VERTEX_MAIN,
          buffers: vertexBuffers,
        },
        fragment: {
          module: shaderModule,
          entryPoint: ShaderEntryPoint.FRAGMENT_MAIN,
          targets: [{ format: colorFormat }],
        },
        primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
        depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
        multisample: { count: options.sampleCount },
      });
      if (hasErrorScope) {
        const pipelineError = await devAny.popErrorScope!();
        if (pipelineError) {
          Logger.error('Pipeline validation error:', pipelineError as unknown as Error);
          options.statusEl.textContent = 'Pipeline error. See console for details.';
          throw new Error('Render pipeline creation failed');
        }
      }

      if (hasErrorScope) devAny.pushErrorScope!('validation');
      const overlayPipeline = device.createRenderPipeline({
        label: 'overlay-pipeline',
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: ShaderEntryPoint.VERTEX_MAIN,
          buffers: vertexBuffers,
        },
        fragment: {
          module: shaderModule,
          entryPoint: ShaderEntryPoint.FRAGMENT_OVERLAY,
          targets: [
            {
              format: colorFormat,
              blend: {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              },
            },
          ],
        },
        primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
        depthStencil: {
          depthWriteEnabled: false,
          depthCompare: 'less-equal',
          depthBias: 1,
          depthBiasSlopeScale: 1,
          format: 'depth24plus',
        },
        multisample: { count: options.sampleCount },
      });
      if (hasErrorScope) {
        const overlayPipelineError = await devAny.popErrorScope!();
        if (overlayPipelineError) {
          Logger.error('Overlay pipeline validation error:', overlayPipelineError as unknown as Error);
          options.statusEl.textContent = 'Overlay pipeline error. See console for details.';
          throw new Error('Overlay pipeline creation failed');
        }
      }

      return { renderPipeline, overlayPipeline };
    });
}

/**
 * Creates a depth attachment texture sized to the current canvas dimensions.
 *
 * @param device - Active GPU device used to create the texture.
 * @param canvasElement - Canvas whose dimensions determine the texture size.
 * @param sampleCount - MSAA sample count to apply to the depth attachment.
 * @returns A GPU texture usable as a depth attachment.
 */
export function createDepthTexture(
  device: GPUDevice,
  canvasElement: HTMLCanvasElement,
  sampleCount: number
): GPUTexture {
  return createRenderAttachmentTexture(
    device,
    canvasElement,
    'depth24plus',
    sampleCount,
    'frame-depth-texture'
  );
}

/**
 * Creates an MSAA color attachment for multi-sampled rendering when required.
 *
 * @param device - Active GPU device used to create the texture.
 * @param canvasElement - Canvas whose dimensions determine the texture size.
 * @param format - Color format matching the presentation surface.
 * @param sampleCount - MSAA sample count to apply to the color attachment.
 * @returns A GPU texture suitable for use as an MSAA render target.
 */
export function createMsaaColorTarget(
  device: GPUDevice,
  canvasElement: HTMLCanvasElement,
  format: GPUTextureFormat,
  sampleCount: number
): GPUTexture {
  return createRenderAttachmentTexture(
    device,
    canvasElement,
    format,
    sampleCount,
    'frame-msaa-color-texture'
  );
}

/**
 * Creates an HDR color target (single-sampled) used as resolve target for the main pass.
 */
export function createHdrColorTarget(
  device: GPUDevice,
  canvasElement: HTMLCanvasElement
): GPUTexture {
  return device.createTexture({
    label: 'frame-hdr-color-texture',
    size: { width: canvasElement.width, height: canvasElement.height, depthOrArrayLayers: 1 },
    format: 'rgba16float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    sampleCount: 1,
  });
}

/**
 * Helper for allocating a render attachment texture with the same footprint as the canvas.
 *
 * @param device - Active GPU device used to create the texture.
 * @param canvasElement - Canvas whose dimensions determine the texture extent.
 * @param format - GPU texture format to use for the attachment.
 * @param sampleCount - Number of samples per pixel, typically 1 or the MSAA count.
 * @param label - Descriptive label applied to the created GPU texture.
 * @returns A GPU texture configured for render attachment usage.
 */
export function createRenderAttachmentTexture(
  device: GPUDevice,
  canvasElement: HTMLCanvasElement,
  format: GPUTextureFormat,
  sampleCount: number,
  label: string
): GPUTexture {
  return device.createTexture({
    label,
    size: { width: canvasElement.width, height: canvasElement.height, depthOrArrayLayers: 1 },
    format,
    sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

export type TexturePattern = 'stripes' | 'grid';

/**
 * Generates pixel data for a procedural debug texture.
 *
 * @param width - Texture width in pixels.
 * @param height - Texture height in pixels.
 * @param pattern - Procedural pattern to render (`stripes` or `grid`).
 * @returns A `Uint8Array` containing RGBA texel data.
 */
export function makeTextureData(
  width: number,
  height: number,
  pattern: TexturePattern
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let v = 0;
      if (pattern === 'stripes') {
        v = ((y >> 2) & 1) * 30;
      } else {
        const gx = x % 16 === 0 ? 1 : 0;
        const gy = y % 16 === 0 ? 1 : 0;
        v = (gx | gy) * 40;
      }
      data[i + 0] = 180 - v;
      data[i + 1] = 160 - v;
      data[i + 2] = 140 - v;
      data[i + 3] = 255;
    }
  }
  return data;
}

/**
 * Uploads raw pixel data into a GPU texture configured for sampling and rendering.
 *
 * @param device - Active GPU device used to create and populate the texture.
 * @param width - Texture width in pixels.
 * @param height - Texture height in pixels.
 * @param data - RGBA pixel data laid out row-major.
 * @param label - Debug label applied to the created texture.
 * @returns A GPU texture populated with the provided pixel data.
 */
export function createTextureFromData(
  device: GPUDevice,
  width: number,
  height: number,
  data: Uint8Array,
  label: string
): GPUTexture {
  const texture = device.createTexture({
    label,
    size: { width, height },
    format: 'rgba8unorm-srgb',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const queueAny = device.queue as unknown as { writeTexture?: Function; writeBuffer: Function; submit: Function };
  if (typeof queueAny.writeTexture === 'function') {
    queueAny.writeTexture(
      { texture },
      data.buffer as ArrayBuffer,
      { bytesPerRow: width * 4 },
      { width, height }
    );
  } else {
    // Fallback path for environments where writeTexture is not available.
    const bytesPerPixel = 4;
    const unpaddedBytesPerRow = width * bytesPerPixel;
    const alignment = 256;
    const paddedBytesPerRow = Math.ceil(unpaddedBytesPerRow / alignment) * alignment;
    const bufferSize = paddedBytesPerRow * height;

    // Create padded buffer and copy each row into the padded layout
    const padded = new Uint8Array(bufferSize);
    for (let y = 0; y < height; y++) {
      const srcOffset = y * unpaddedBytesPerRow;
      const dstOffset = y * paddedBytesPerRow;
      padded.set(data.subarray(srcOffset, srcOffset + unpaddedBytesPerRow), dstOffset);
    }

    const stagingBuffer = device.createBuffer({
      label: `${label}-staging-buffer`,
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC,
    });

    queueAny.writeBuffer(stagingBuffer, 0, padded.buffer as ArrayBuffer);

    const encoder = device.createCommandEncoder({ label: `${label}-copy-encoder` });
    const anyEncoder = encoder as unknown as { copyBufferToTexture?: Function; finish: () => GPUCommandBuffer };
      if (typeof anyEncoder.copyBufferToTexture === 'function') {
      anyEncoder.copyBufferToTexture(
        { buffer: stagingBuffer, bytesPerRow: paddedBytesPerRow },
        { texture },
        { width, height }
      );
    } else {
      // In minimal/mock environments, copyBufferToTexture may be unavailable.
      // Skip the copy to avoid runtime errors; tests typically don't assert texel values.
        if (!warnedNoCopyBufferToTexture) {
          Logger.warn('[WebGPU Mock] copyBufferToTexture not available; skipping texture upload');
        warnedNoCopyBufferToTexture = true;
      }
    }
    queueAny.submit([anyEncoder.finish() as unknown as GPUCommandBuffer]);
  }
  return texture;
}
