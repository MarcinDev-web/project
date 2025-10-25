import { Component } from './Component';
import type { RgbaColor } from '../utils/colors';
export declare class MaterialComponent extends Component {
    static readonly type = "Material";
    color: RgbaColor;
    metallic: number;
    roughness: number;
    /**
     * Maximum material ID supported by the atlas (0-15 for default atlas).
     * Can be updated if more materials are added to the atlas.
     */
    static MAX_MATERIAL_ID: number;
    private _materialId;
    /**
     * Material ID in the texture atlas (0-based index).
     * Used to determine UV offset when sampling from atlas.
     * Default 0 = first material in atlas.
     * Automatically clamped to [0, MAX_MATERIAL_ID] to prevent black blocks.
     */
    get materialId(): number;
    set materialId(value: number);
    getType(): string;
    clone(): MaterialComponent;
    toJSON(): {
        color: RgbaColor;
        metallic: number;
        roughness: number;
        materialId: number;
    };
    fromJSON(data: {
        color?: RgbaColor;
        metallic?: number;
        roughness?: number;
        materialId?: number;
    }): void;
}
//# sourceMappingURL=MaterialComponent.d.ts.map