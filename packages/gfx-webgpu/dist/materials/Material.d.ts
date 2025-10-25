import type { RgbaColor } from '../../utils/colors';
export type AlphaMode = 'OPAQUE' | 'MASK' | 'BLEND';
export declare class Material {
    color: RgbaColor;
    metallic: number;
    roughness: number;
    texture?: GPUTexture;
    normalMap?: GPUTexture;
    metallicRoughnessMap?: GPUTexture;
    aoMap?: GPUTexture;
    emissiveMap?: GPUTexture;
    heightMap?: GPUTexture;
    emissive: [number, number, number];
    emissiveIntensity: number;
    opacity: number;
    alphaMode: AlphaMode;
    alphaCutoff: number;
    doubleSided: boolean;
}
//# sourceMappingURL=Material.d.ts.map