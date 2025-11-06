import { Component } from './Component.js';
import { registerComponent } from './registry.js';

/**
 * Types of vegetation that can be placed in the scene
 */
export enum VegetationType {
  Grass = 'grass',
  Flower = 'flower',
  Shrub = 'shrub',
  Tree = 'tree',
  Custom = 'custom',
}

/**
 * Configuration for vegetation behavior and appearance
 */
export interface VegetationConfig {
  /** Type of vegetation */
  type: VegetationType;

  /** Billboard texture for grass/flowers (optional, used for billboard rendering) */
  billboardTexture?: string;
  /** Number of billboard texture variants (for variety) */
  billboardCount?: number;

  /** 3D model URL for trees/shrubs (optional, used for 3D rendering) */
  modelUrl?: string;
  /** Number of LOD levels for 3D models */
  lodLevels?: number;

  /** Physical properties */
  /** Height of vegetation in world units */
  height: number;
  /** Radius/collision size in world units */
  radius: number;
  /** Whether this vegetation can be harvested/picked */
  canBeHarvested: boolean;
  /** Time in seconds to harvest (0 = instant) */
  harvestTime?: number;

  /** Growth properties */
  /** Whether this vegetation can regrow after being harvested */
  canRegrow?: boolean;
  /** Time in seconds to fully regrow from harvested state (0 = instant, undefined = no regrowth) */
  regrowthTime?: number;
  /** Growth rate multiplier (1.0 = normal, 2.0 = twice as fast) */
  growthRate?: number;

  /** Visual parameters */
  /** Wind strength (0-1) affecting vertex displacement */
  windStrength: number;
  /** Wind frequency for animation */
  windFrequency: number;
  /** Color variation amount (0-1) */
  colorVariation: number;
  /** Scale variation amount (±value, e.g., 0.2 = ±20%) */
  scaleVariation: number;
  /** Base color tint (RGB, 0-1 range, optional) */
  colorTint?: [number, number, number];
}

/**
 * VegetationComponent - Represents vegetation entities (grass, trees, shrubs, flowers)
 *
 * Provides configuration and state for vegetation rendering and gameplay interaction.
 */
export class VegetationComponent extends Component {
  static readonly type = 'Vegetation';

  /** Vegetation configuration */
  config: VegetationConfig;

  /** Growth stage (0-1) for growth animation (0 = newly planted/harvested, 1 = fully grown) */
  growthStage: number = 1.0;

  /** Whether this vegetation has been harvested */
  isHarvested: boolean = false;

  /** Instance ID for instanced rendering (used by renderer) */
  instanceId: string = '';

  /** Unique phase offset for wind animation (randomized per instance) */
  windPhase: number = 0;

  /** Unique color variation per instance (0-1, for visual variety) */
  colorVariationFactor: number = 0;

  constructor(config?: Partial<VegetationConfig>) {
    super();

    // Default configuration
    const defaultConfig: VegetationConfig = {
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: false,
      canRegrow: false,
      growthRate: 1.0,
      windStrength: 0.3,
      windFrequency: 1.0,
      colorVariation: 0.1,
      scaleVariation: 0.15,
    };

    this.config = { ...defaultConfig, ...config };

    // Randomize wind phase for natural variation
    this.windPhase = Math.random() * Math.PI * 2;

    // Randomize color variation factor for visual variety
    this.colorVariationFactor = Math.random();
  }

  getType(): string {
    return VegetationComponent.type;
  }

  clone(): VegetationComponent {
    const copy = new VegetationComponent();
    copy.config = { ...this.config };
    copy.growthStage = this.growthStage;
    copy.isHarvested = this.isHarvested;
    copy.instanceId = this.instanceId;
    copy.windPhase = this.windPhase;
    copy.colorVariationFactor = this.colorVariationFactor;
    return copy;
  }

  toJSON(): {
    config: VegetationConfig;
    growthStage: number;
    isHarvested: boolean;
    instanceId: string;
    windPhase: number;
    colorVariationFactor: number;
  } {
    return {
      config: { ...this.config },
      growthStage: this.growthStage,
      isHarvested: this.isHarvested,
      instanceId: this.instanceId,
      windPhase: this.windPhase,
      colorVariationFactor: this.colorVariationFactor,
    };
  }

  fromJSON(data: {
    config?: Partial<VegetationConfig>;
    growthStage?: number;
    isHarvested?: boolean;
    instanceId?: string;
    windPhase?: number;
    colorVariationFactor?: number;
  }): void {
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
    if (typeof data.growthStage === 'number') {
      this.growthStage = Math.max(0, Math.min(1, data.growthStage));
    }
    if (typeof data.isHarvested === 'boolean') {
      this.isHarvested = data.isHarvested;
    }
    if (typeof data.instanceId === 'string') {
      this.instanceId = data.instanceId;
    }
    if (typeof data.windPhase === 'number') {
      this.windPhase = data.windPhase;
    }
    if (typeof data.colorVariationFactor === 'number') {
      this.colorVariationFactor = Math.max(0, Math.min(1, data.colorVariationFactor));
    }
  }

  /**
   * Marks this vegetation as harvested
   */
  harvest(): void {
    if (this.config.canBeHarvested && !this.isHarvested) {
      this.isHarvested = true;
      // Reset growth stage to 0 when harvested (for regrowth)
      this.growthStage = 0;
    }
  }

  /**
   * Resets vegetation state (for respawning/regrowth)
   */
  reset(): void {
    this.isHarvested = false;
    this.growthStage = 1.0;
  }

  /**
   * Updates growth stage based on deltaTime and growth rate
   * @param deltaTime Time elapsed in seconds
   * @returns true if growth stage changed
   */
  updateGrowth(deltaTime: number): boolean {
    if (this.growthStage >= 1.0) {
      return false; // Already fully grown
    }

    const regrowthTime = this.config.regrowthTime ?? 0;
    if (regrowthTime <= 0) {
      return false; // No regrowth configured
    }

    const growthRate = this.config.growthRate ?? 1.0;
    const growthDelta = (deltaTime / regrowthTime) * growthRate;
    const oldStage = this.growthStage;

    this.growthStage = Math.min(1.0, this.growthStage + growthDelta);

    // Mark as no longer harvested when growth reaches threshold
    if (this.isHarvested && this.growthStage >= 0.5) {
      this.isHarvested = false;
    }

    return this.growthStage !== oldStage;
  }

  /**
   * Updates growth stage (0-1)
   */
  setGrowthStage(stage: number): void {
    this.growthStage = Math.max(0, Math.min(1, stage));
  }
}

registerComponent(VegetationComponent.type, VegetationComponent);
