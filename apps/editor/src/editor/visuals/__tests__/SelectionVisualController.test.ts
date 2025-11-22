import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SelectionVisualController } from '../SelectionVisualController';
import { Entity, Scene, SelectionManager } from '@engine/world';
import type { RgbaColor } from '../../utils/colors';

// Mock @engine/world
vi.mock('@engine/world', () => {
  class MockEntity {
    id = Math.random().toString();
    userData: Record<string, any> = {};
    _color: RgbaColor | undefined;

    constructor(public name: string) {}

    get color() {
      return this._color;
    }
    set color(v: RgbaColor | undefined) {
      this._color = v;
    }
  }

  class MockSelectionManager {
    _selected = new Set<MockEntity>();
    _listeners: Array<(s: Set<MockEntity>) => void> = [];

    get selectedEntities() {
      return this._selected;
    }

    onSelectionChanged(cb: (s: Set<MockEntity>) => void) {
      this._listeners.push(cb);
      return () => {
        this._listeners = this._listeners.filter(l => l !== cb);
      };
    }

    select(e: MockEntity) {
      this._selected.clear();
      this._selected.add(e);
      this.notify();
    }

    selectMultiple(es: MockEntity[], mode: 'set') {
      this._selected = new Set(es);
      this.notify();
    }

    removeFromSelection(e: MockEntity) {
      this._selected.delete(e);
      this.notify();
    }

    clearSelection() {
      this._selected.clear();
      this.notify();
    }

    notify() {
      this._listeners.forEach(l => l(this._selected));
    }
  }

  class MockScene {
    constructor(public name: string) {}
    addEntity() {}
  }

  return {
    Entity: MockEntity,
    SelectionManager: MockSelectionManager,
    Scene: MockScene
  };
});

describe('SelectionVisualController', () => {
  let scene: Scene;
  let selection: SelectionManager;
  let entity: Entity;
  let controller: SelectionVisualController;
  let updateSceneBuffers: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Entity, Scene, SelectionManager here are the MOCKED versions because of vi.mock
    scene = new Scene('TestScene');
    selection = new SelectionManager();
    entity = new Entity('TestEntity');
    
    // Helper to set initial color on mock
    (entity as any).color = [0.5, 0.5, 0.5, 1.0]; 
    
    updateSceneBuffers = vi.fn();
    controller = new SelectionVisualController(scene, selection, updateSceneBuffers);
  });

  afterEach(() => {
    controller.dispose();
  });

  it('highlights entity when selected', () => {
    selection.select(entity);

    // Check if color changed (should be highlighted)
    expect((entity as any).color).not.toEqual([0.5, 0.5, 0.5, 1.0]);
    expect((entity as any).color![0]).toBeGreaterThan(0.5); // Red channel boosted/tinted
    
    // Check if updateSceneBuffers was called
    expect(updateSceneBuffers).toHaveBeenCalled();
  });

  it('restores original color when deselected', () => {
    selection.select(entity);
    const highlightedColor = [...(entity as any).color!];

    selection.clearSelection();

    // Should return to original gray
    expect((entity as any).color).toEqual([0.5, 0.5, 0.5, 1.0]);
    expect((entity as any).color).not.toEqual(highlightedColor);
  });

  it('stores base color in userData automatically', () => {
    // Initially no userData.baseColor
    expect(entity.userData.baseColor).toBeUndefined();

    selection.select(entity);

    // Should have stored the original color
    expect(entity.userData.baseColor).toEqual([0.5, 0.5, 0.5, 1.0]);
  });

  it('handles existing baseColor in userData', () => {
    // Pre-set a base color that is different from current (simulating a state where it was already tracked)
    const baseColor: RgbaColor = [0.2, 0.2, 0.2, 1.0];
    entity.userData.baseColor = baseColor;
    (entity as any).color = [0.2, 0.2, 0.2, 1.0];

    selection.select(entity);

    // Should highlight based on baseColor
    expect((entity as any).color![0]).toBeGreaterThan(0.2);

    selection.clearSelection();

    // Should restore to baseColor
    expect((entity as any).color).toEqual(baseColor);
  });

  it('removes highlight when dragging starts', () => {
    selection.select(entity);
    const highlightedColor = [...(entity as any).color!];

    // Start dragging
    controller.setDragging(true);

    // Should revert to base color during drag
    expect((entity as any).color).toEqual([0.5, 0.5, 0.5, 1.0]);

    // Stop dragging
    controller.setDragging(false);

    // Should re-apply highlight
    expect((entity as any).color).toEqual(highlightedColor);
  });

  it('does not highlight new selection if dragging is active', () => {
    controller.setDragging(true);
    selection.select(entity);

    // Should NOT be highlighted
    expect((entity as any).color).toEqual([0.5, 0.5, 0.5, 1.0]);

    controller.setDragging(false);

    // Should now apply highlight
    expect((entity as any).color![0]).toBeGreaterThan(0.5);
  });

  it('handles multiple entities', () => {
    const entity2 = new Entity('Entity2');
    (entity2 as any).color = [0.8, 0.8, 0.8, 1.0];
    
    // Use explicit casting or bypass TS check for selectMultiple as our mock signature matches but TS might complain about types
    (selection as any).selectMultiple([entity, entity2], 'set');

    expect((entity as any).color![0]).toBeGreaterThan(0.5);
    expect((entity2 as any).color![0]).toBeGreaterThan(0.8);

    selection.removeFromSelection(entity);

    expect((entity as any).color).toEqual([0.5, 0.5, 0.5, 1.0]); // Restored
    expect((entity2 as any).color![0]).toBeGreaterThan(0.8); // Still highlighted
  });

  it('restores all colors on dispose', () => {
    selection.select(entity);
    expect((entity as any).color).not.toEqual([0.5, 0.5, 0.5, 1.0]);

    controller.dispose();

    expect((entity as any).color).toEqual([0.5, 0.5, 0.5, 1.0]);
  });

  it('forces refresh correctly', () => {
    selection.select(entity);
    
    // Manually tamper with color
    (entity as any).color = [0.0, 0.0, 0.0, 1.0];

    controller.refresh();

    // Should be re-highlighted
    expect((entity as any).color![0]).toBeGreaterThan(0.5);
  });
});
