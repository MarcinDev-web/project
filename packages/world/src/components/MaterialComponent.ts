import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { RgbaColor } from '../utils/colors.js';

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

  /**
   * Default material reference when none is specified.
   */
  static readonly DEFAULT_MATERIAL_REF = 'default';

  private _materialId = 0;
  private _materialRef: string = MaterialComponent.DEFAULT_MATERIAL_REF;
  private _primaryColor: RgbaColor = [1, 1, 1, 1];
  private _secondaryColor: RgbaColor = [1, 1, 1, 1];
  private _accentColor: RgbaColor = [1, 1, 1, 1];
  private _emissiveColor: RgbaColor = [0, 0, 0, 1];
  private _emissiveIntensity = 0;
  private _alphaMode: AlphaMode = 'opaque';

  metallic = 0;
  roughness = 1;
  flags = 0;

  /**
   * Material ID in the texture atlas (0-based index).
   * Used to determine UV offset when sampling from atlas.
   * Default 0 = first material in atlas.
   * Automatically clamped to [0, MAX_MATERIAL_ID] to prevent black blocks.
   * 
   * @deprecated Prefer using `materialRef` for string-based material references.
   * This numeric ID is maintained for backward compatibility with the atlas system.
   */
  get materialId(): number {
    return this._materialId;
  }

  set materialId(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      // console.warn(`[MaterialComponent] Invalid materialId ${value}, clamping to 0`);
      this._materialId = 0;
    } else if (value > MaterialComponent.MAX_MATERIAL_ID) {
      // console.warn(
      //   `[MaterialComponent] materialId ${value} exceeds MAX_MATERIAL_ID (${MaterialComponent.MAX_MATERIAL_ID}), clamping to max`
      // );
      this._materialId = MaterialComponent.MAX_MATERIAL_ID;
    } else {
      this._materialId = Math.floor(value);
    }
  }

  /**
   * Material reference - string identifier for the material (e.g., "stone", "oak_planks").
   * This provides a human-readable way to reference materials and works with the
   * MaterialRegistry system for validation and resolution.
   * 
   * Use this in combination with ResourceManager to:
   * - Validate that the material exists
   * - Resolve to the correct atlasIndex
   * - Get detailed information about the material
   * 
   * @example
   * ```typescript
   * const material = entity.getComponent(MaterialComponent);
   * material.materialRef = 'stone';
   * 
   * // Later, resolve to atlas index via ResourceManager
   * const atlasIndex = resourceManager.resolveAtlasIndex(material.materialRef);
   * ```
   */
  get materialRef(): string {
    return this._materialRef;
  }

  set materialRef(value: string) {
    this._materialRef = value || MaterialComponent.DEFAULT_MATERIAL_REF;
  }

  /**
   * Check if this material has a custom reference (not the default).
   */
  hasCustomMaterialRef(): boolean {
    return this._materialRef !== MaterialComponent.DEFAULT_MATERIAL_REF;
  }

  get primaryColor(): RgbaColor {
    return this._primaryColor;
  }

  set primaryColor(color: RgbaColor) {
    this._primaryColor = cloneColor(color);
    // Ensure alphaMode is consistent with opacity if not explicitly set
    if (this._primaryColor[3] < 0.999 && this._alphaMode === 'opaque') {
      this._alphaMode = 'blend';
    }
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
    return this._primaryColor[3];
  }

  set opacity(value: number) {
    const newOpacity = Number.isFinite(value) ? value : 1;
    this._primaryColor[3] = newOpacity;
    // Do NOT automatically change alphaMode here to avoid destroying 'mask' mode
    this.updateFlags();
  }

  get alphaMode(): AlphaMode {
    return this._alphaMode;
  }

  set alphaMode(value: AlphaMode) {
    this._alphaMode = value;
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
    
    // Check opacity from primaryColor
    if (this._alphaMode === 'blend' || this._primaryColor[3] < 0.999) {
      flags |= MaterialComponent.FLAG_TRANSPARENT;
    }
    this.flags = flags;
  }

  clone(): MaterialComponent {
    const copy = new MaterialComponent();
    // Direct copy to avoid double allocation and side effects
    copy._primaryColor = [...this._primaryColor];
    copy._secondaryColor = [...this._secondaryColor];
    copy._accentColor = [...this._accentColor];
    copy._emissiveColor = [...this._emissiveColor];
    
    copy.metallic = this.metallic;
    copy.roughness = this.roughness;
    copy._emissiveIntensity = this._emissiveIntensity;
    // copy.opacity is derived from primaryColor, no need to copy separately
    copy._alphaMode = this._alphaMode;
    copy.flags = this.flags;
    copy._materialId = this._materialId;
    copy._materialRef = this._materialRef;
    
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
    materialRef: string;
    flags: number;
  } {
    return {
      primaryColor: [...this._primaryColor],
      secondaryColor: [...this._secondaryColor],
      accentColor: [...this._accentColor],
      emissiveColor: [...this._emissiveColor],
      emissiveIntensity: this._emissiveIntensity,
      opacity: this._primaryColor[3],
      alphaMode: this._alphaMode,
      metallic: this.metallic,
      roughness: this.roughness,
      materialId: this._materialId,
      materialRef: this._materialRef,
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
    materialRef?: string;
    flags?: number;
    color?: RgbaColor; // legacy fallback
  }): void {
    // Set simple properties first
    if (typeof data.metallic === 'number') this.metallic = data.metallic;
    if (typeof data.roughness === 'number') this.roughness = data.roughness;
    if (typeof data.materialId === 'number') this.materialId = data.materialId;
    if (typeof data.materialRef === 'string') this._materialRef = data.materialRef;
    if (typeof data.emissiveIntensity === 'number') this._emissiveIntensity = data.emissiveIntensity;
    
    // Colors
    if (data.secondaryColor) this._secondaryColor = cloneColor(data.secondaryColor);
    if (data.accentColor) this._accentColor = cloneColor(data.accentColor);
    if (data.emissiveColor) this._emissiveColor = cloneColor(data.emissiveColor);

    // Primary color & Opacity handling
    // 1. Set primary color if available
    if (data.primaryColor) {
      this._primaryColor = cloneColor(data.primaryColor);
    } else if (data.color) {
      this._primaryColor = cloneColor(data.color);
    }

    // 2. Override opacity if explicitly provided (legacy support or specific override)
    if (typeof data.opacity === 'number') {
      this._primaryColor[3] = data.opacity;
    }

    // 3. Set alpha mode explicitly if provided
    if (data.alphaMode) {
      this._alphaMode = data.alphaMode;
    } else {
      // Auto-detect if not provided
      this._alphaMode = this._primaryColor[3] < 0.999 ? 'blend' : 'opaque';
    }

    // 4. Flags - allow override but updateFlags will recalculate based on state
    if (typeof data.flags === 'number') this.flags = data.flags;
    
    // Final consistency check
    this.updateFlags();
  }
}

registerComponent(MaterialComponent.type, MaterialComponent);
