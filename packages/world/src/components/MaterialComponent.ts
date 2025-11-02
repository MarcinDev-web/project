import { Component } from './Component';
import { registerComponent } from './registry';
import type { RgbaColor } from '../utils/colors';

export type AlphaMode = 'opaque' | 'mask' | 'blend';

function cloneColor(color: RgbaColor): RgbaColor {
  return [color[0], color[1], color[2], color[3]];
}

export class MaterialComponent extends Component {
  static readonly type = 'Material';

  static readonly FLAG_EMISSIVE = 1 << 0;
  static readonly FLAG_TRANSPARENT = 1 << 1;

  /**
   * Maximum material ID supported by the atlas (0-15 for default atlas).
   * Can be updated if more materials are added to the atlas.
   */
  static MAX_MATERIAL_ID = 15;

  private _materialId = 0;
  private _primaryColor: RgbaColor = [1, 1, 1, 1];
  private _secondaryColor: RgbaColor = [1, 1, 1, 1];
  private _accentColor: RgbaColor = [1, 1, 1, 1];
  private _emissiveColor: RgbaColor = [0, 0, 0, 1];
  private _emissiveIntensity = 0;
  private _opacity = 1;

  metallic = 0;
  roughness = 1;
  alphaMode: AlphaMode = 'opaque';
  flags = 0;

  /**
   * Material ID in the texture atlas (0-based index).
   * Used to determine UV offset when sampling from atlas.
   * Default 0 = first material in atlas.
   * Automatically clamped to [0, MAX_MATERIAL_ID] to prevent black blocks.
   */
  get materialId(): number {
    return this._materialId;
  }

  set materialId(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      console.warn(`[MaterialComponent] Invalid materialId ${value}, clamping to 0`);
      this._materialId = 0;
    } else if (value > MaterialComponent.MAX_MATERIAL_ID) {
      console.warn(
        `[MaterialComponent] materialId ${value} exceeds MAX_MATERIAL_ID (${MaterialComponent.MAX_MATERIAL_ID}), clamping to max`
      );
      this._materialId = MaterialComponent.MAX_MATERIAL_ID;
    } else {
      this._materialId = Math.floor(value);
    }
  }

  get primaryColor(): RgbaColor {
    return this._primaryColor;
  }

  set primaryColor(color: RgbaColor) {
    this._primaryColor = cloneColor(color);
    this.opacity = color[3] ?? 1;
    this.updateFlags();
  }

  get secondaryColor(): RgbaColor {
    return this._secondaryColor;
  }

  set secondaryColor(color: RgbaColor) {
    this._secondaryColor = cloneColor(color);
  }

  get accentColor(): RgbaColor {
    return this._accentColor;
  }

  set accentColor(color: RgbaColor) {
    this._accentColor = cloneColor(color);
  }

  get emissiveColor(): RgbaColor {
    return this._emissiveColor;
  }

  set emissiveColor(color: RgbaColor) {
    this._emissiveColor = cloneColor(color);
    this.updateFlags();
  }

  get emissiveIntensity(): number {
    return this._emissiveIntensity;
  }

  set emissiveIntensity(value: number) {
    this._emissiveIntensity = Number.isFinite(value) ? value : 0;
    this.updateFlags();
  }

  get opacity(): number {
    return this._opacity;
  }

  set opacity(value: number) {
    this._opacity = Number.isFinite(value) ? value : 1;
    this.alphaMode = this._opacity < 0.999 ? 'blend' : 'opaque';
    this.updateFlags();
  }

  /**
   * Backwards compatibility: treat `color` as alias for primaryColor.
   */
  get color(): RgbaColor {
    return this.primaryColor;
  }

  set color(color: RgbaColor) {
    this.primaryColor = color;
  }

  getType(): string {
    return MaterialComponent.type;
  }

  updateFlags(): void {
    let flags = 0;
    const emissiveStrength =
      this.emissiveIntensity *
      (Math.abs(this._emissiveColor[0]) +
        Math.abs(this._emissiveColor[1]) +
        Math.abs(this._emissiveColor[2]));
    if (emissiveStrength > 1e-4) flags |= MaterialComponent.FLAG_EMISSIVE;
    if (this.alphaMode === 'blend' || this.opacity < 0.999) {
      flags |= MaterialComponent.FLAG_TRANSPARENT;
    }
    this.flags = flags;
  }

  clone(): MaterialComponent {
    const copy = new MaterialComponent();
    copy.primaryColor = [...this.primaryColor];
    copy.secondaryColor = [...this.secondaryColor];
    copy.accentColor = [...this.accentColor];
    copy.emissiveColor = [...this.emissiveColor];
    copy.metallic = this.metallic;
    copy.roughness = this.roughness;
    copy.emissiveIntensity = this.emissiveIntensity;
    copy.opacity = this.opacity;
    copy.alphaMode = this.alphaMode;
    copy.flags = this.flags;
    copy.materialId = this._materialId; // Use private field to avoid warning in clone
    return copy;
  }

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
  } {
    return {
      primaryColor: [...this.primaryColor],
      secondaryColor: [...this.secondaryColor],
      accentColor: [...this.accentColor],
      emissiveColor: [...this.emissiveColor],
      emissiveIntensity: this.emissiveIntensity,
      opacity: this.opacity,
      alphaMode: this.alphaMode,
      metallic: this.metallic,
      roughness: this.roughness,
      materialId: this._materialId,
      flags: this.flags,
    };
  }

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
    color?: RgbaColor; // legacy fallback
  }): void {
    if (data.primaryColor) this.primaryColor = data.primaryColor;
    else if (data.color) this.primaryColor = data.color; // legacy support
    if (data.secondaryColor) this.secondaryColor = data.secondaryColor;
    if (data.accentColor) this.accentColor = data.accentColor;
    if (data.emissiveColor) this.emissiveColor = data.emissiveColor;
    if (typeof data.emissiveIntensity === 'number') this.emissiveIntensity = data.emissiveIntensity;
    if (typeof data.opacity === 'number') {
      this.opacity = data.opacity;
      this.alphaMode = this.opacity < 0.999 ? 'blend' : this.alphaMode;
    }
    if (data.alphaMode) this.alphaMode = data.alphaMode;
    if (typeof data.metallic === 'number') this.metallic = data.metallic;
    if (typeof data.roughness === 'number') this.roughness = data.roughness;
    if (typeof data.materialId === 'number') this.materialId = data.materialId; // Use setter for validation
    if (typeof data.flags === 'number') this.flags = data.flags;
    this.updateFlags();
  }
}

registerComponent(MaterialComponent.type, MaterialComponent);
