import { TextureAtlas } from '../textures/TextureAtlas';
export interface GeometryData {
    vertices: Uint8Array;
    indices: Uint16Array;
    instanceCount: number;
    instanceOffsetData: Float32Array;
    instanceColorScaleData: Float32Array;
    instanceRotationData: Float32Array;
    instanceMaterialIdData?: Float32Array;
}
export interface FrameResources {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    instanceOffsetBuffer: GPUBuffer;
    instanceColorScaleBuffer: GPUBuffer;
    instanceRotationBuffer: GPUBuffer;
    instanceMaterialIdBuffer: GPUBuffer;
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
    atlasMetaBuffer?: GPUBuffer;
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
export declare function validateGeometryData(geometry: GeometryData): void;
export declare const DEFAULT_GEOMETRY: GeometryData;
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
export declare function createTimestampResources(device: GPUDevice, supportsTimestampQueries: boolean, counts: {
    queryCount: number;
    bufferSize: number;
}): TimestampResources;
/**
 * Creates GPU buffers for the provided geometry and uploads their contents to the device.
 *
 * @param device - Active GPU device used for buffer allocation and uploads.
 * @param geometry - Geometry payload including packed vertices, indices, and instancing data.
 * @returns GPU buffer references for vertex, index, and instancing attributes.
 */
export declare function createGeometryBuffers(device: GPUDevice, geometry: GeometryData): {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    instanceOffsetBuffer: GPUBuffer;
    instanceColorScaleBuffer: GPUBuffer;
    instanceRotationBuffer: GPUBuffer;
    instanceMaterialIdBuffer: GPUBuffer;
};
/**
 * Allocates a uniform buffer and accompanying bind group layout for per-frame data.
 *
 * @param device - Active GPU device used to allocate resources.
 * @param options - Uniform buffer configuration including byte size and float array length.
 * @returns The GPU buffer, bind group layout, and CPU-side backing array.
 */
export declare function createUniformResources(device: GPUDevice, options: {
    bufferSize: number;
    dataLength: number;
}): {
    uniformBuffer: GPUBuffer;
    uniformBindGroupLayout: GPUBindGroupLayout;
    uniformData: Float32Array;
};
/**
 * Creates procedural textures, sampler, and bind group for material sampling.
 *
 * @param device - Active GPU device used to create textures and sampler.
 * @param textureBindGroupLayout - Optional existing layout to reuse; created when omitted.
 * @param textureSize - Width and height in pixels of the generated textures.
 * @returns Generated textures, sampler, layout, and bind group references.
 */
export declare function createTextureResources(device: GPUDevice, textureBindGroupLayout?: GPUBindGroupLayout, textureSize?: number): {
    sideTexture: GPUTexture;
    topTexture: GPUTexture;
    sampler: GPUSampler;
    textureBindGroupLayout: GPUBindGroupLayout;
    textureBindGroup: GPUBindGroup;
};
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
export declare function createTextureAtlas(device: GPUDevice, _textureBindGroupLayout?: GPUBindGroupLayout, atlasSize?: number, materialTextureSize?: number): {
    atlasTexture: GPUTexture;
    normalAtlasTexture: GPUTexture;
    sampler: GPUSampler;
    textureBindGroupLayout: GPUBindGroupLayout;
    textureBindGroup: GPUBindGroup;
    atlasMetaBuffer: GPUBuffer;
    atlas: TextureAtlas;
};
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
export declare function createPipelines(device: GPUDevice, colorFormat: GPUTextureFormat, uniformBindGroupLayout: GPUBindGroupLayout, textureBindGroupLayout: GPUBindGroupLayout, vertexBuffers: GPUVertexBufferLayout[], options: {
    sampleCount: number;
    statusEl: HTMLElement;
}): Promise<{
    renderPipeline: GPURenderPipeline;
    overlayPipeline: GPURenderPipeline;
}>;
/**
 * Creates a depth attachment texture sized to the current canvas dimensions.
 *
 * @param device - Active GPU device used to create the texture.
 * @param canvasElement - Canvas whose dimensions determine the texture size.
 * @param sampleCount - MSAA sample count to apply to the depth attachment.
 * @returns A GPU texture usable as a depth attachment.
 */
export declare function createDepthTexture(device: GPUDevice, canvasElement: HTMLCanvasElement, sampleCount: number): GPUTexture;
/**
 * Creates an MSAA color attachment for multi-sampled rendering when required.
 *
 * @param device - Active GPU device used to create the texture.
 * @param canvasElement - Canvas whose dimensions determine the texture size.
 * @param format - Color format matching the presentation surface.
 * @param sampleCount - MSAA sample count to apply to the color attachment.
 * @returns A GPU texture suitable for use as an MSAA render target.
 */
export declare function createMsaaColorTarget(device: GPUDevice, canvasElement: HTMLCanvasElement, format: GPUTextureFormat, sampleCount: number): GPUTexture;
/**
 * Creates an HDR color target (single-sampled) used as resolve target for the main pass.
 */
export declare function createHdrColorTarget(device: GPUDevice, canvasElement: HTMLCanvasElement): GPUTexture;
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
export declare function createRenderAttachmentTexture(device: GPUDevice, canvasElement: HTMLCanvasElement, format: GPUTextureFormat, sampleCount: number, label: string): GPUTexture;
export type TexturePattern = 'stripes' | 'grid';
/**
 * Generates pixel data for a procedural debug texture.
 *
 * @param width - Texture width in pixels.
 * @param height - Texture height in pixels.
 * @param pattern - Procedural pattern to render (`stripes` or `grid`).
 * @returns A `Uint8Array` containing RGBA texel data.
 */
export declare function makeTextureData(width: number, height: number, pattern: TexturePattern): Uint8Array;
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
export declare function createTextureFromData(device: GPUDevice, width: number, height: number, data: Uint8Array, label: string): GPUTexture;
//# sourceMappingURL=resources.d.ts.map