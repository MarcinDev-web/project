import { Component } from './Component';
import type { RgbaColor } from '../utils/colors';
export type AlphaMode = 'opaque' | 'mask' | 'blend';
export declare class MaterialComponent extends Component {
    static readonly type = "Material";
    static readonly FLAG_EMISSIVE: number;
    static readonly FLAG_TRANSPARENT: number;
    /**
     * Maximum material ID supported by the atlas (0-15 for default atlas).
     * Can be updated if more materials are added to the atlas.
     */
    static MAX_MATERIAL_ID: number;
    private _materialId;
    private _primaryColor;
    private _secondaryColor;
    private _accentColor;
    private _emissiveColor;
    private _emissiveIntensity;
    private _opacity;
    metallic: number;
    roughness: number;
    alphaMode: AlphaMode;
    flags: number;
    /**
     * Material ID in the texture atlas (0-based index).
     * Used to determine UV offset when sampling from atlas.
     * Default 0 = first material in atlas.
     * Automatically clamped to [0, MAX_MATERIAL_ID] to prevent black blocks.
     */
    get materialId(): number;
    set materialId(value: number);
    get primaryColor(): RgbaColor;
    set primaryColor(color: RgbaColor);
    get secondaryColor(): RgbaColor;
    set secondaryColor(color: RgbaColor);
    get accentColor(): RgbaColor;
    set accentColor(color: RgbaColor);
    get emissiveColor(): RgbaColor;
    set emissiveColor(color: RgbaColor);
    get emissiveIntensity(): number;
    set emissiveIntensity(value: number);
    get opacity(): number;
    set opacity(value: number);
    /**
     * Backwards compatibility: treat `color` as alias for primaryColor.
     */
    get color(): RgbaColor;
    set color(color: RgbaColor);
    getType(): string;
    updateFlags(): void;
    clone(): MaterialComponent;
    toJSON(): {
        primaryColor: RgbaColor;
        secondaryColor: RgbaColor;
        accentColor: RgbaColor;
        emissiveColor: RgbaColor;
        emissiveIntensity: number;
        opacity: number;
        alphaMode: AlphaMode;
        metallic: number;
        roughness: number;
        materialId: number;
        flags: number;
    };
    fromJSON(data: {
        primaryColor?: RgbaColor;
        secondaryColor?: RgbaColor;
        accentColor?: RgbaColor;
        emissiveColor?: RgbaColor;
        emissiveIntensity?: number;
        opacity?: number;
        alphaMode?: AlphaMode;
        metallic?: number;
        roughness?: number;
        materialId?: number;
        flags?: number;
        color?: RgbaColor;
    }): void;
}
//# sourceMappingURL=MaterialComponent.d.ts.map