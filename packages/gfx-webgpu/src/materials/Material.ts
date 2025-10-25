import type { RgbaColor } from '../../utils/colors';

export type AlphaMode = 'OPAQUE' | 'MASK' | 'BLEND';

export class Material {
  // Base PBR properties
  color: RgbaColor = [1, 1, 1, 1];
  metallic = 0;
  roughness = 1;

  // Extended PBR maps
  texture?: GPUTexture; // baseColor/albedo atlas cell
  normalMap?: GPUTexture; // normal atlas cell or normal atlas
  metallicRoughnessMap?: GPUTexture;
  aoMap?: GPUTexture;
  emissiveMap?: GPUTexture;
  heightMap?: GPUTexture;

  // Emissive
  emissive: [number, number, number] = [0, 0, 0];
  emissiveIntensity = 0;

  // Transparency / sidedness
  opacity = 1;
  alphaMode: AlphaMode = 'OPAQUE';
  alphaCutoff = 0.5;
  doubleSided = false;
}
