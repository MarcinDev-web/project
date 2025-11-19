import { describe, it, expect, beforeEach } from 'vitest';
import { CheckpointSystem } from './CheckpointSystem.js';
import { Scene } from '../core/Scene.js';

describe('CheckpointSystem', () => {
  let checkpointSystem: CheckpointSystem;
  let scene: Scene;

  beforeEach(() => {
    checkpointSystem = new CheckpointSystem();
    scene = new Scene('Test Scene');
    checkpointSystem.initialize(scene);
  });

  it('should initialize correctly', () => {
    expect(checkpointSystem).toBeDefined();
  });

  it('should return default spawn when no checkpoint active', () => {
    const defaultSpawn = { position: [0, 0, 0] as any, rotation: 0 };
    const respawnData = checkpointSystem.getRespawnData(defaultSpawn);
    
    expect(respawnData.position).toEqual(defaultSpawn.position);
    expect(respawnData.rotation).toBe(defaultSpawn.rotation);
  });

  it('should clear active checkpoint', () => {
    checkpointSystem.clear();
    const checkpoint = checkpointSystem.getActiveCheckpoint();
    expect(checkpoint).toBeNull();
  });

  it('should dispose correctly', () => {
    checkpointSystem.dispose();
    const checkpoint = checkpointSystem.getActiveCheckpoint();
    expect(checkpoint).toBeNull();
  });
});

