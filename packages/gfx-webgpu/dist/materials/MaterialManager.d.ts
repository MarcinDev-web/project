import { Material, type AlphaMode } from './Material';
import type { RgbaColor } from '../utils/colors';
export interface SerializedMaterial {
    color: RgbaColor;
    metallic: number;
    roughness: number;
    emissive: [number, number, number];
    emissiveIntensity: number;
    opacity: number;
    alphaMode: AlphaMode;
    alphaCutoff: number;
    doubleSided: boolean;
}
/**
 * Central registry for materials with basic cloning and serialization.
 * GPU texture fields are not serialized (non-transferable);
 * applications should manage texture assets separately and rebind on load.
 */
export declare class MaterialManager {
    private idToMaterial;
    register(id: string, material: Material): void;
    unregister(id: string): void;
    get(id: string): Material | undefined;
    has(id: string): boolean;
    listIds(): string[];
    clone(id: string, newId?: string): Material;
    serialize(id: string): SerializedMaterial;
    deserialize(id: string, data: SerializedMaterial): Material;
}
//# sourceMappingURL=MaterialManager.d.ts.map