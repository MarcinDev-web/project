import type { LoadOptions } from '../../types.js';

export type TextureFormat = 
  | 'rgba8unorm'
  | 'rgba8unorm-srgb'
  | 'bgra8unorm'
  | 'bgra8unorm-srgb'
  | 'rg8unorm'
  | 'r8unorm'
  | 'bc1-rgba-unorm'
  | 'bc2-rgba-unorm'
  | 'bc3-rgba-unorm'
  | 'bc4-r-unorm'
  | 'bc5-rg-unorm'
  | 'bc7-rgba-unorm'
  | 'etc2-rgb8unorm'
  | 'etc2-rgb8a1unorm'
  | 'etc2-rgba8unorm'
  | 'astc-4x4-unorm'
  | string; // Allow other formats

export interface TextureLoadOptions extends LoadOptions {
  /** Resize texture to this size (maintains aspect ratio if only width or height specified) */
  width?: number;
  height?: number;
  /** Flip texture vertically (useful for WebGL) */
  flipY?: boolean;
  /** Generate mipmaps */
  generateMipmaps?: boolean;
  /** Target format (hint for transcoders) */
  format?: TextureFormat;
}

export interface RawTexture {
  /** Texture ID */
  id: string;
  /** Raw pixel data (compressed or uncompressed) */
  data: Uint8Array;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Texture format */
  format: TextureFormat;
  /** Original image element (for debugging) */
  image?: HTMLImageElement;
  /** Mipmaps if generated/loaded */
  mipmaps?: Uint8Array[];
}

/**
 * Handler for specific file extensions (e.g. .ktx2, .dds)
 */
export interface TextureLoaderHandler {
  load(url: string, options: TextureLoadOptions): Promise<RawTexture>;
}

export class TextureLoader {
  private loadingTextures: Map<string, Promise<RawTexture>> = new Map();
  private handlers: Map<string, TextureLoaderHandler> = new Map();

  /**
   * Register a handler for a specific file extension
   * @param extension File extension (e.g. 'ktx2')
   * @param handler Handler instance
   */
  public registerHandler(extension: string, handler: TextureLoaderHandler): void {
    this.handlers.set(extension.toLowerCase().replace(/^\./, ''), handler);
  }

  /**
   * Load texture from URL or data URL
   */
  public async load(
    url: string,
    options: TextureLoadOptions = {}
  ): Promise<RawTexture> {
    // Check if already loading
    if (this.loadingTextures.has(url)) {
      return this.loadingTextures.get(url)!;
    }

    // Start loading
    const promise = this.loadInternal(url, options);
    this.loadingTextures.set(url, promise);

    try {
      return await promise;
    } finally {
      this.loadingTextures.delete(url);
    }
  }

  /**
   * Internal loading implementation
   */
  private async loadInternal(
    url: string,
    options: TextureLoadOptions
  ): Promise<RawTexture> {
    // Check for registered handlers
    const extension = url.split('.').pop()?.toLowerCase();
    if (extension && this.handlers.has(extension)) {
      return this.handlers.get(extension)!.load(url, options);
    }

    // Load image
    const image = await this.loadImage(url);

    // Create canvas for pixel extraction
    const canvas = document.createElement('canvas');
    let width = options.width || image.width;
    let height = options.height || image.height;

    // Maintain aspect ratio if only one dimension specified
    if (options.width && !options.height) {
      height = (image.height / image.width) * options.width;
    } else if (options.height && !options.width) {
      width = (image.width / image.height) * options.height;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    // Apply flip if needed
    if (options.flipY) {
      ctx.translate(0, height);
      ctx.scale(1, -1);
    }

    // Draw and extract pixels
    ctx.drawImage(image, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = new Uint8Array(imageData.data);

    // Generate mipmaps if requested
    let mipmaps: Uint8Array[] | undefined;
    if (options.generateMipmaps) {
      mipmaps = this.generateMipmaps(data, width, height);
    }

    return {
      id: options.cacheId || url,
      data,
      width,
      height,
      format: options.format || 'rgba8unorm',
      image,
      ...(mipmaps !== undefined ? { mipmaps } : {}),
    };
  }

  /**
   * Load image from URL
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      
      // Enable CORS for external images
      image.crossOrigin = 'anonymous';
      image.src = url;
    });
  }

  /**
   * Generate mipmaps using box filter
   */
  private generateMipmaps(
    baseData: Uint8Array,
    baseWidth: number,
    baseHeight: number
  ): Uint8Array[] {
    const mipmaps: Uint8Array[] = [baseData];
    let currentWidth = baseWidth;
    let currentHeight = baseHeight;
    let currentData = baseData;

    while (currentWidth > 1 || currentHeight > 1) {
      const newWidth = Math.max(1, Math.floor(currentWidth / 2));
      const newHeight = Math.max(1, Math.floor(currentHeight / 2));
      const newData = this.downsample(currentData, currentWidth, currentHeight, newWidth, newHeight);

      mipmaps.push(newData);
      currentData = newData;
      currentWidth = newWidth;
      currentHeight = newHeight;
    }

    return mipmaps;
  }

  /**
   * Downsample texture data
   */
  private downsample(
    srcData: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number
  ): Uint8Array {
    const dstData = new Uint8Array(dstWidth * dstHeight * 4);
    const xRatio = srcWidth / dstWidth;
    const yRatio = srcHeight / dstHeight;

    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const srcX = Math.floor(x * xRatio);
        const srcY = Math.floor(y * yRatio);

        let r = 0, g = 0, b = 0, a = 0;
        let count = 0;

        for (let dy = 0; dy < Math.ceil(yRatio); dy++) {
          for (let dx = 0; dx < Math.ceil(xRatio); dx++) {
            const sx = Math.min(srcX + dx, srcWidth - 1);
            const sy = Math.min(srcY + dy, srcHeight - 1);
            const srcIdx = (sy * srcWidth + sx) * 4;

            r += srcData[srcIdx + 0]!;
            g += srcData[srcIdx + 1]!;
            b += srcData[srcIdx + 2]!;
            a += srcData[srcIdx + 3]!;
            count++;
          }
        }

        const dstIdx = (y * dstWidth + x) * 4;
        dstData[dstIdx + 0] = Math.round(r / count);
        dstData[dstIdx + 1] = Math.round(g / count);
        dstData[dstIdx + 2] = Math.round(b / count);
        dstData[dstIdx + 3] = Math.round(a / count);
      }
    }

    return dstData;
  }

  /**
   * Load multiple textures in parallel
   */
  public async loadBatch(
    urls: string[],
    options: TextureLoadOptions = {}
  ): Promise<RawTexture[]> {
    const promises = urls.map(url => this.load(url, options));
    return Promise.all(promises);
  }

  /**
   * Create texture from raw pixel data
   */
  public createFromPixels(
    id: string,
    data: Uint8Array,
    width: number,
    height: number,
    options: TextureLoadOptions = {}
  ): RawTexture {
    let processedData = data;
    let processedWidth = width;
    let processedHeight = height;

    // Resize if needed
    if ((options.width && options.width !== width) || (options.height && options.height !== height)) {
      const newWidth = options.width || width;
      const newHeight = options.height || height;
      processedData = this.downsample(data, width, height, newWidth, newHeight);
      processedWidth = newWidth;
      processedHeight = newHeight;
    }

    // Generate mipmaps if requested
    let mipmaps: Uint8Array[] | undefined;
    if (options.generateMipmaps) {
      mipmaps = this.generateMipmaps(processedData, processedWidth, processedHeight);
    }

    return {
      id,
      data: processedData,
      width: processedWidth,
      height: processedHeight,
      format: options.format || 'rgba8unorm',
      ...(mipmaps !== undefined ? { mipmaps } : {}),
    };
  }

  /**
   * Create solid color texture
   */
  public createSolidColor(
    id: string,
    r: number,
    g: number,
    b: number,
    a: number = 255,
    size: number = 4
  ): RawTexture {
    const data = new Uint8Array(size * size * 4);
    
    for (let i = 0; i < size * size; i++) {
      data[i * 4 + 0] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = a;
    }

    return this.createFromPixels(id, data, size, size);
  }

  /**
   * Clear loading queue
   */
  public clearQueue(): void {
    this.loadingTextures.clear();
  }
}
