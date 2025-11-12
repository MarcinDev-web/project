import { describe, it, expect, beforeEach } from 'vitest';
import { SaveSystem } from '../systems/SaveSystem.js';

describe('SaveSystem', () => {
  let saveSystem: SaveSystem;

  beforeEach(() => {
    saveSystem = new SaveSystem();
    saveSystem.initialize('test-build-id');
    
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize correctly', () => {
    expect(saveSystem).toBeDefined();
  });

  it('should save and load game state', () => {
    const position = [10, 20, 30] as const;
    const rotation = 1.5;
    
    const saved = saveSystem.saveGame('test-slot', position, rotation);
    expect(saved).toBe(true);
    
    const loaded = saveSystem.loadGame('test-slot');
    expect(loaded).not.toBeNull();
    expect(loaded?.playerPosition).toEqual(position);
    expect(loaded?.playerRotation).toBe(rotation);
    expect(loaded?.buildId).toBe('test-build-id');
  });

  it('should return null for non-existent save', () => {
    const loaded = saveSystem.loadGame('non-existent');
    expect(loaded).toBeNull();
  });

  it('should delete save slot', () => {
    const position = [0, 0, 0] as const;
    saveSystem.saveGame('test-slot', position, 0);
    
    const deleted = saveSystem.deleteSave('test-slot');
    expect(deleted).toBe(true);
    
    const loaded = saveSystem.loadGame('test-slot');
    expect(loaded).toBeNull();
  });

  it('should list saves', () => {
    saveSystem.saveGame('slot1', [0, 0, 0] as const, 0);
    saveSystem.saveGame('slot2', [1, 1, 1] as const, 0);
    
    const saves = saveSystem.listSaves();
    expect(saves.length).toBeGreaterThanOrEqual(2);
  });

  it('should auto-save', () => {
    const position = [5, 5, 5] as const;
    saveSystem.autoSave(position, 0);
    
    const autoSave = saveSystem.loadAutoSave();
    expect(autoSave).not.toBeNull();
    expect(autoSave?.slotId).toBe('autosave');
  });
});

