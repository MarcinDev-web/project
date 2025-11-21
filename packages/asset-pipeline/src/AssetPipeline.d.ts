import { TextureLoader, type TextureLoadOptions, type RawTexture } from './loaders/texture/TextureLoader.js';
import { type ParsedGlb } from './formats/gltf/parseGLB.js';
export declare class AssetPipeline {
    readonly textureLoader: TextureLoader;
    loadTexture(url: string, options?: TextureLoadOptions): Promise<RawTexture>;
    parseGlb(buffer: ArrayBuffer): ParsedGlb;
}
//# sourceMappingURL=AssetPipeline.d.ts.map