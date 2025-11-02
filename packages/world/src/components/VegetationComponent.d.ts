import { Component } from './Component';
/**
 * Types of vegetation that can be placed in the scene
 */
export declare enum VegetationType {
    Grass = "grass",
    Flower = "flower",
    Shrub = "shrub",
    Tree = "tree",
    Custom = "custom"
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
export declare class VegetationComponent extends Component {
    static readonly type = "Vegetation";
    /** Vegetation configuration */
    config: VegetationConfig;
    /** Growth stage (0-1) for growth animation (0 = newly planted/harvested, 1 = fully grown) */
    growthStage: number;
    /** Whether this vegetation has been harvested */
    isHarvested: boolean;
    /** Instance ID for instanced rendering (used by renderer) */
    instanceId: string;
    /** Unique phase offset for wind animation (randomized per instance) */
    windPhase: number;
    /** Unique color variation per instance (0-1, for visual variety) */
    colorVariationFactor: number;
    constructor(config?: Partial<VegetationConfig>);
    getType(): string;
    clone(): VegetationComponent;
    toJSON(): {
        config: VegetationConfig;
        growthStage: number;
        isHarvested: boolean;
        instanceId: string;
        windPhase: number;
        colorVariationFactor: number;
    };
    fromJSON(data: {
        config?: Partial<VegetationConfig>;
        growthStage?: number;
        isHarvested?: boolean;
        instanceId?: string;
        windPhase?: number;
        colorVariationFactor?: number;
    }): void;
    /**
     * Marks this vegetation as harvested
     */
    harvest(): void;
    /**
     * Resets vegetation state (for respawning/regrowth)
     */
    reset(): void;
    /**
     * Updates growth stage based on deltaTime and growth rate
     * @param deltaTime Time elapsed in seconds
     * @returns true if growth stage changed
     */
    updateGrowth(deltaTime: number): boolean;
    /**
     * Updates growth stage (0-1)
     */
    setGrowthStage(stage: number): void;
}
//# sourceMappingURL=VegetationComponent.d.ts.map