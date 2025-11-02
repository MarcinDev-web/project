/**
 * VegetationSystem tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '../../src/core/Scene';
import { Entity } from '../../src/core/Entity';
import { VegetationComponent, VegetationType } from '../../src/components/VegetationComponent';
import { VegetationSystem } from '../../src/systems/VegetationSystem';
import { PhysicsSystem } from '../../src/physics/PhysicsSystem';

describe('VegetationSystem', () => {
  let scene: Scene;
  let system: VegetationSystem;
  let physicsSystem: PhysicsSystem | null;

  beforeEach(() => {
    scene = new Scene('test');
    physicsSystem = null; // No physics for basic tests
    system = new VegetationSystem(scene, physicsSystem);
  });

  it('should create system with default config', () => {
    expect(system).toBeDefined();
  });

  it('should find vegetation in range', () => {
    const veg1 = new Entity('grass1');
    veg1.transform.position = [0, 0, 0];
    veg1.addComponent(new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: false,
    }));
    scene.addEntity(veg1);

    const veg2 = new Entity('grass2');
    veg2.transform.position = [5, 0, 0]; // Far away
    veg2.addComponent(new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: false,
    }));
    scene.addEntity(veg2);

    const inRange = system.getVegetationInRange([0, 0, 0], 2.0);
    expect(inRange.length).toBe(1);
    expect(inRange[0].id).toBe(veg1.id);
  });

  it('should harvest vegetation instantly when harvestTime is 0', () => {
    const veg = new Entity('harvestable');
    veg.transform.position = [0, 0, 0];
    const vegetation = new VegetationComponent({
      type: VegetationType.Flower,
      height: 0.3,
      radius: 0.15,
      canBeHarvested: true,
      harvestTime: 0, // Instant
    });
    veg.addComponent(vegetation);
    scene.addEntity(veg);

    expect(vegetation.isHarvested).toBe(false);
    
    const result = system.harvest(veg);
    
    expect(result).toBe(true);
    expect(vegetation.isHarvested).toBe(true);
  });

  it('should not harvest non-harvestable vegetation', () => {
    const veg = new Entity('non-harvestable');
    const vegetation = new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: false,
    });
    veg.addComponent(vegetation);
    scene.addEntity(veg);

    const result = system.harvest(veg);
    
    expect(result).toBe(false);
    expect(vegetation.isHarvested).toBe(false);
  });

  it('should not harvest already harvested vegetation', () => {
    const veg = new Entity('harvested');
    const vegetation = new VegetationComponent({
      type: VegetationType.Flower,
      height: 0.3,
      radius: 0.15,
      canBeHarvested: true,
    });
    vegetation.harvest(); // Already harvested
    veg.addComponent(vegetation);
    scene.addEntity(veg);

    const result = system.harvest(veg);
    
    expect(result).toBe(false);
  });

  it('should update harvesting progress over time', () => {
    const veg = new Entity('timed-harvest');
    const vegetation = new VegetationComponent({
      type: VegetationType.Flower,
      height: 0.3,
      radius: 0.15,
      canBeHarvested: true,
      harvestTime: 1.0, // 1 second
    });
    veg.addComponent(vegetation);
    scene.addEntity(veg);

    // Start harvest
    system.harvest(veg);
    expect(vegetation.isHarvested).toBe(false);

    // Update for half the time
    system.update(0.5);
    expect(vegetation.isHarvested).toBe(false);

    // Update for remaining time
    system.update(0.5);
    expect(vegetation.isHarvested).toBe(true);
  });

  it('should exclude harvested vegetation from range queries', () => {
    const veg1 = new Entity('veg1');
    veg1.transform.position = [0, 0, 0];
    const veg1Comp = new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: true,
    });
    veg1Comp.harvest();
    veg1.addComponent(veg1Comp);
    scene.addEntity(veg1);

    const veg2 = new Entity('veg2');
    veg2.transform.position = [1, 0, 0];
    veg2.addComponent(new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: false,
    }));
    scene.addEntity(veg2);

    const inRange = system.getVegetationInRange([0, 0, 0], 5.0);
    expect(inRange.length).toBe(1);
    expect(inRange[0].id).toBe(veg2.id);
  });

  it('should dispose correctly', () => {
    const veg = new Entity('test');
    scene.addEntity(veg);
    
    system.dispose();
    
    // System should be cleaned up (no exceptions on dispose)
    expect(system).toBeDefined();
  });

  it('should update growth for regrowing vegetation', () => {
    const veg = new Entity('regrowing');
    const vegetation = new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: true,
      canRegrow: true,
      regrowthTime: 2.0, // 2 seconds to regrow
      growthRate: 1.0,
    });
    vegetation.harvest(); // Sets growthStage to 0
    veg.addComponent(vegetation);
    scene.addEntity(veg);

    // Update for 1 second (should grow to 0.5)
    system.update(1.0);
    
    expect(vegetation.growthStage).toBeCloseTo(0.5, 2);
    expect(vegetation.isHarvested).toBe(false); // Should be unharvested at >= 0.5
  });

  it('should emit growth events during regrowth', () => {
    const veg = new Entity('regrowing');
    const vegetation = new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: true,
      canRegrow: true,
      regrowthTime: 1.0,
      growthRate: 1.0,
    });
    vegetation.harvest();
    veg.addComponent(vegetation);
    scene.addEntity(veg);

    const growthProgressEvents: unknown[] = [];
    const growthCompleteEvents: unknown[] = [];

    scene.events.on('vegetation:growth-progress', (e) => growthProgressEvents.push(e));
    scene.events.on('vegetation:growth-complete', (e) => growthCompleteEvents.push(e));

    // Update to full growth
    system.update(1.0);

    // Should have emitted progress events
    expect(growthProgressEvents.length).toBeGreaterThan(0);
    // Should have emitted complete event when reaching 1.0
    expect(growthCompleteEvents.length).toBeGreaterThan(0);
  });

  it('should not update growth if growth is disabled', () => {
    const systemNoGrowth = new VegetationSystem(scene, null, { enableGrowth: false });
    const veg = new Entity('regrowing');
    const vegetation = new VegetationComponent({
      type: VegetationType.Grass,
      height: 0.5,
      radius: 0.25,
      canBeHarvested: true,
      canRegrow: true,
      regrowthTime: 1.0,
    });
    vegetation.harvest();
    veg.addComponent(vegetation);
    scene.addEntity(veg);

    systemNoGrowth.update(1.0);

    // Growth should not have progressed
    expect(vegetation.growthStage).toBe(0);
  });

  it('should emit growth-start event when harvesting regrowable vegetation', () => {
    const veg = new Entity('harvestable');
    const vegetation = new VegetationComponent({
      type: VegetationType.Flower,
      height: 0.3,
      radius: 0.15,
      canBeHarvested: true,
      canRegrow: true,
      regrowthTime: 5.0,
    });
    veg.addComponent(vegetation);
    scene.addEntity(veg);

    const growthStartEvents: unknown[] = [];
    scene.events.on('vegetation:growth-start', (e) => growthStartEvents.push(e));

    system.harvest(veg);

    expect(growthStartEvents.length).toBe(1);
  });
});

