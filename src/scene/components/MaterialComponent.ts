import { Component } from './Component';
import { registerComponent } from './registry';
import type { RgbaColor } from '../../utils/colors';

export class MaterialComponent extends Component {
  static readonly type = 'Material';

  color: RgbaColor = [1, 1, 1, 1];
  metallic = 0;
  roughness = 1;

  /**
   * Maximum material ID supported by the atlas (0-15 for default atlas).
   * Can be updated if more materials are added to the atlas.
   */
  static MAX_MATERIAL_ID = 15;

  private _materialId = 0;

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

  getType(): string {
    return MaterialComponent.type;
  }

  clone(): MaterialComponent {
    const copy = new MaterialComponent();
    copy.color = [...this.color];
    copy.metallic = this.metallic;
    copy.roughness = this.roughness;
    copy.materialId = this._materialId; // Use private field to avoid warning in clone
    return copy;
  }

  toJSON(): { color: RgbaColor; metallic: number; roughness: number; materialId: number } {
    return {
      color: [...this.color],
      metallic: this.metallic,
      roughness: this.roughness,
      materialId: this._materialId,
    };
  }

  fromJSON(data: {
    color?: RgbaColor;
    metallic?: number;
    roughness?: number;
    materialId?: number;
  }): void {
    if (data.color) this.color = [...data.color];
    if (typeof data.metallic === 'number') this.metallic = data.metallic;
    if (typeof data.roughness === 'number') this.roughness = data.roughness;
    if (typeof data.materialId === 'number') this.materialId = data.materialId; // Use setter for validation
  }
}

registerComponent(MaterialComponent.type, MaterialComponent);
