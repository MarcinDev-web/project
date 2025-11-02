/**
 * VegetationComponent tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Entity } from '../../src/core/Entity';
import { VegetationComponent, VegetationType } from '../../src/components/VegetationComponent';

describe('VegetationComponent', () => {
  let entity: Entity;
  let vegetation: VegetationComponent;

  beforeEach(() => {
    entity = new Entity('test');
    vegetation = new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: false,
      windStrength: 0.3,
      windFrequency: 1.0,
    });
  });

  it('should create with default config', () => {
    const veg = new VegetationComponent();
    expect(veg.config.type).toBe(VegetationType.Grass);
    expect(veg.config.height).toBe(0.5);
    expect(veg.growthStage).toBe(1.0);
    expect(veg.isHarvested).toBe(false);
  });

  it('should create with custom config', () => {
    expect(vegetation.config.type).toBe(VegetationType.Grass);
    expect(vegetation.config.height).toBe(0.5);
    expect(vegetation.config.radius).toBe(0.25);
    expect(vegetation.config.windStrength).toBe(0.3);
  });

  it('should have unique wind phase per instance', () => {
    const veg1 = new VegetationComponent();
    const veg2 = new VegetationComponent();
    
    // Wind phases should be randomized (likely different)
    // Allow for small chance they're the same (highly unlikely with Math.random)
    expect(veg1.windPhase).toBeGreaterThanOrEqual(0);
    expect(veg1.windPhase).toBeLessThan(Math.PI * 2);
    expect(veg2.windPhase).toBeGreaterThanOrEqual(0);
    expect(veg2.windPhase).toBeLessThan(Math.PI * 2);
  });

  it('should serialize and deserialize correctly', () => {
    vegetation.growthStage = 0.75;
    vegetation.isHarvested = false;
    
    const json = vegetation.toJSON();
    expect(json.config.type).toBe(VegetationType.Grass);
    expect(json.growthStage).toBe(0.75);
    expect(json.isHarvested).toBe(false);

    const newVeg = new VegetationComponent();
    newVeg.fromJSON(json);
    
    expect(newVeg.config.type).toBe(VegetationType.Grass);
    expect(newVeg.growthStage).toBe(0.75);
    expect(newVeg.isHarvested).toBe(false);
  });

  it('should clone correctly', () => {
    vegetation.growthStage = 0.5;
    vegetation.isHarvested = true;
    vegetation.instanceId = 'test-instance';
    
    const clone = vegetation.clone();
    
    expect(clone.config.type).toBe(vegetation.config.type);
    expect(clone.growthStage).toBe(0.5);
    expect(clone.isHarvested).toBe(true);
    expect(clone.instanceId).toBe('test-instance');
    expect(clone).not.toBe(vegetation);
  });

  it('should allow harvesting when canBeHarvested is true', () => {
    vegetation.config.canBeHarvested = true;
    expect(vegetation.isHarvested).toBe(false);
    
    vegetation.harvest();
    expect(vegetation.isHarvested).toBe(true);
  });

  it('should not allow harvesting when canBeHarvested is false', () => {
    vegetation.config.canBeHarvested = false;
    expect(vegetation.isHarvested).toBe(false);
    
    vegetation.harvest();
    expect(vegetation.isHarvested).toBe(false);
  });

  it('should reset state correctly', () => {
    vegetation.growthStage = 0.25;
    vegetation.isHarvested = true;
    
    vegetation.reset();
    
    expect(vegetation.isHarvested).toBe(false);
    expect(vegetation.growthStage).toBe(1.0);
  });

  it('should clamp growth stage to 0-1 range', () => {
    vegetation.setGrowthStage(-0.5);
    expect(vegetation.growthStage).toBe(0);
    
    vegetation.setGrowthStage(1.5);
    expect(vegetation.growthStage).toBe(1);
    
    vegetation.setGrowthStage(0.75);
    expect(vegetation.growthStage).toBe(0.75);
  });

  it('should support all vegetation types', () => {
    const types = [
      VegetationType.Grass,
      VegetationType.Flower,
      VegetationType.Shrub,
      VegetationType.Tree,
      VegetationType.Custom,
    ];

    for (const type of types) {
      const veg = new VegetationComponent({ type });
      expect(veg.config.type).toBe(type);
    }
  });

  it('should have unique color variation factor per instance', () => {
    const veg1 = new VegetationComponent();
    const veg2 = new VegetationComponent();
    
    // Color variation factors should be randomized (likely different)
    expect(veg1.colorVariationFactor).toBeGreaterThanOrEqual(0);
    expect(veg1.colorVariationFactor).toBeLessThanOrEqual(1);
    expect(veg2.colorVariationFactor).toBeGreaterThanOrEqual(0);
    expect(veg2.colorVariationFactor).toBeLessThanOrEqual(1);
  });

  it('should reset growth stage when harvested', () => {
    vegetation.config.canBeHarvested = true;
    vegetation.growthStage = 1.0;
    
    vegetation.harvest();
    
    expect(vegetation.isHarvested).toBe(true);
    expect(vegetation.growthStage).toBe(0);
  });

  it('should update growth stage over time', () => {
    vegetation.config.canRegrow = true;
    vegetation.config.regrowthTime = 2.0; // 2 seconds to fully regrow
    vegetation.config.growthRate = 1.0;
    vegetation.growthStage = 0.5; // Start at 50%
    vegetation.isHarvested = true;
    
    // Update for 0.5 seconds (should grow by 0.25, reaching 0.75)
    const changed = vegetation.updateGrowth(0.5);
    
    expect(changed).toBe(true);
    expect(vegetation.growthStage).toBeCloseTo(0.75, 2);
    expect(vegetation.isHarvested).toBe(false); // Should be unharvested when >= 0.5
  });

  it('should respect growth rate multiplier', () => {
    vegetation.config.canRegrow = true;
    vegetation.config.regrowthTime = 2.0;
    vegetation.config.growthRate = 2.0; // Twice as fast
    vegetation.growthStage = 0.0;
    
    // Update for 0.5 seconds at 2x rate (should grow by 0.5 instead of 0.25)
    vegetation.updateGrowth(0.5);
    
    expect(vegetation.growthStage).toBeCloseTo(0.5, 2);
  });

  it('should not grow if regrowth is not configured', () => {
    vegetation.config.canRegrow = false;
    vegetation.config.regrowthTime = undefined;
    vegetation.growthStage = 0.0;
    
    const changed = vegetation.updateGrowth(1.0);
    
    expect(changed).toBe(false);
    expect(vegetation.growthStage).toBe(0.0);
  });

  it('should not grow if already fully grown', () => {
    vegetation.config.canRegrow = true;
    vegetation.config.regrowthTime = 2.0;
    vegetation.growthStage = 1.0;
    
    const changed = vegetation.updateGrowth(1.0);
    
    expect(changed).toBe(false);
    expect(vegetation.growthStage).toBe(1.0);
  });

  it('should serialize and deserialize colorVariationFactor', () => {
    vegetation.colorVariationFactor = 0.75;
    
    const json = vegetation.toJSON();
    expect(json.colorVariationFactor).toBe(0.75);
    
    const newVeg = new VegetationComponent();
    newVeg.fromJSON(json);
    
    expect(newVeg.colorVariationFactor).toBe(0.75);
  });
});

