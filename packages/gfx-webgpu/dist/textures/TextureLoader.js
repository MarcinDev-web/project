/**
 * TextureLoader - Loads real texture images from files/URLs
 *
 * Supports:
 * - PNG, JPG, WebP formats
 * - Data URLs
 * - Async loading with progress
 * - Image preprocessing (resize, flip, etc.)
 * - Integration with TextureCache
 */
import { globalTextureCache } from './TextureCache';
export class TextureLoader {
    loadingTextures = new Map();
    /**
     * Load texture from URL or data URL
     */
    async load(url, options = {}) {
        const cacheId = options.cacheId || url;
        // Check cache first
        if (options.cache !== false) {
            const cached = globalTextureCache.get(cacheId);
            if (cached) {
                return {
                    id: cacheId,
                    data: cached.data,
                    width: cached.width,
                    height: cached.height,
                    ...(cached.mipmaps !== undefined ? { mipmaps: cached.mipmaps } : {}),
                };
            }
        }
        // Check if already loading
        if (this.loadingTextures.has(url)) {
            return this.loadingTextures.get(url);
        }
        // Start loading
        const promise = this.loadInternal(url, options);
        this.loadingTextures.set(url, promise);
        try {
            const texture = await promise;
            // Add to cache if enabled
            if (options.cache !== false) {
                globalTextureCache.add(cacheId, texture.data, texture.width, texture.height, texture.mipmaps);
            }
            return texture;
        }
        finally {
            this.loadingTextures.delete(url);
        }
    }
    /**
     * Internal loading implementation
     */
    async loadInternal(url, options) {
        // Load image
        const image = await this.loadImage(url);
        // Create canvas for pixel extraction
        const canvas = document.createElement('canvas');
        let width = options.width || image.width;
        let height = options.height || image.height;
        // Maintain aspect ratio if only one dimension specified
        if (options.width && !options.height) {
            height = (image.height / image.width) * options.width;
        }
        else if (options.height && !options.width) {
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
        let mipmaps;
        if (options.generateMipmaps) {
            mipmaps = this.generateMipmaps(data, width, height);
        }
        return {
            id: options.cacheId || url,
            data,
            width,
            height,
            image,
            ...(mipmaps !== undefined ? { mipmaps } : {}),
        };
    }
    /**
     * Load image from URL
     */
    loadImage(url) {
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
    generateMipmaps(baseData, baseWidth, baseHeight) {
        const mipmaps = [baseData];
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
    downsample(srcData, srcWidth, srcHeight, dstWidth, dstHeight) {
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
                        r += srcData[srcIdx + 0];
                        g += srcData[srcIdx + 1];
                        b += srcData[srcIdx + 2];
                        a += srcData[srcIdx + 3];
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
    async loadBatch(urls, options = {}) {
        const promises = urls.map(url => this.load(url, options));
        return Promise.all(promises);
    }
    /**
     * Preload textures without returning them
     */
    async preload(urls, options = {}) {
        await this.loadBatch(urls, { ...options, cache: true });
    }
    /**
     * Create texture from raw pixel data
     */
    createFromPixels(id, data, width, height, options = {}) {
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
        let mipmaps;
        if (options.generateMipmaps) {
            mipmaps = this.generateMipmaps(processedData, processedWidth, processedHeight);
        }
        // Add to cache if enabled
        if (options.cache !== false) {
            globalTextureCache.add(id, processedData, processedWidth, processedHeight, mipmaps);
        }
        return {
            id,
            data: processedData,
            width: processedWidth,
            height: processedHeight,
            ...(mipmaps !== undefined ? { mipmaps } : {}),
        };
    }
    /**
     * Create solid color texture
     */
    createSolidColor(id, r, g, b, a = 255, size = 4) {
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size; i++) {
            data[i * 4 + 0] = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = a;
        }
        return this.createFromPixels(id, data, size, size, { cache: true });
    }
    /**
     * Clear loading queue
     */
    clearQueue() {
        this.loadingTextures.clear();
    }
}
/**
 * Global texture loader instance
 */
export const globalTextureLoader = new TextureLoader();
//# sourceMappingURL=TextureLoader.js.map