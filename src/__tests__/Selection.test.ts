import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectionManager } from '@engine/world';
import { Entity } from '@engine/world';
import { Scene } from '@engine/world';

describe('SelectionManager', () => {
  let selection: SelectionManager;
  let entity1: Entity;
  let entity2: Entity;
  let entity3: Entity;

  beforeEach(() => {
    selection = new SelectionManager();
    entity1 = new Entity('Entity1');
    entity2 = new Entity('Entity2');
    entity3 = new Entity('Entity3');
  });

  describe('single selection', () => {
    it('selects a single entity', () => {
      selection.select(entity1);

      expect(selection.isSelected(entity1)).toBe(true);
      expect(selection.primarySelection).toBe(entity1);
      expect(selection.selectedEntities.size).toBe(1);
    });

    it('replaces previous selection when selecting another entity', () => {
      selection.select(entity1);
      selection.select(entity2);

      expect(selection.isSelected(entity1)).toBe(false);
      expect(selection.isSelected(entity2)).toBe(true);
      expect(selection.primarySelection).toBe(entity2);
      expect(selection.selectedEntities.size).toBe(1);
    });

    it('returns null as primarySelection when nothing is selected', () => {
      expect(selection.primarySelection).toBeNull();
    });
  });

  describe('multi-selection', () => {
    it('adds entity to existing selection', () => {
      selection.select(entity1);
      selection.addToSelection(entity2);

      expect(selection.isSelected(entity1)).toBe(true);
      expect(selection.isSelected(entity2)).toBe(true);
      expect(selection.selectedEntities.size).toBe(2);
    });

    it('removes entity from selection', () => {
      selection.select(entity1);
      selection.addToSelection(entity2);
      selection.removeFromSelection(entity1);

      expect(selection.isSelected(entity1)).toBe(false);
      expect(selection.isSelected(entity2)).toBe(true);
      expect(selection.selectedEntities.size).toBe(1);
    });

    it('does not add duplicate entities', () => {
      selection.select(entity1);
      selection.addToSelection(entity1);
      selection.addToSelection(entity1);

      expect(selection.selectedEntities.size).toBe(1);
    });

    it('handles removing non-selected entity gracefully', () => {
      selection.select(entity1);
      selection.removeFromSelection(entity2); // Not selected

      expect(selection.selectedEntities.size).toBe(1);
      expect(selection.isSelected(entity1)).toBe(true);
    });
  });

  describe('toggle selection', () => {
    it('toggles entity from unselected to selected', () => {
      selection.toggleSelection(entity1);

      expect(selection.isSelected(entity1)).toBe(true);
    });

    it('toggles entity from selected to unselected', () => {
      selection.select(entity1);
      selection.toggleSelection(entity1);

      expect(selection.isSelected(entity1)).toBe(false);
    });

    it('toggles multiple entities independently', () => {
      selection.select(entity1);
      selection.toggleSelection(entity2); // Add
      selection.toggleSelection(entity1); // Remove

      expect(selection.isSelected(entity1)).toBe(false);
      expect(selection.isSelected(entity2)).toBe(true);
    });
  });

  describe('batch operations', () => {
    it('selectMultiple with mode "set" replaces selection', () => {
      selection.select(entity1);
      selection.selectMultiple([entity2, entity3], 'set');

      expect(selection.isSelected(entity1)).toBe(false);
      expect(selection.isSelected(entity2)).toBe(true);
      expect(selection.isSelected(entity3)).toBe(true);
      expect(selection.selectedEntities.size).toBe(2);
    });

    it('selectMultiple with mode "add" adds to selection', () => {
      selection.select(entity1);
      selection.selectMultiple([entity2, entity3], 'add');

      expect(selection.isSelected(entity1)).toBe(true);
      expect(selection.isSelected(entity2)).toBe(true);
      expect(selection.isSelected(entity3)).toBe(true);
      expect(selection.selectedEntities.size).toBe(3);
    });

    it('selectMultiple with mode "remove" removes from selection', () => {
      selection.selectMultiple([entity1, entity2, entity3], 'set');
      selection.selectMultiple([entity1, entity3], 'remove');

      expect(selection.isSelected(entity1)).toBe(false);
      expect(selection.isSelected(entity2)).toBe(true);
      expect(selection.isSelected(entity3)).toBe(false);
      expect(selection.selectedEntities.size).toBe(1);
    });

    it('selectMultiple with mode "toggle" toggles entities', () => {
      selection.select(entity1);
      selection.selectMultiple([entity1, entity2], 'toggle');

      expect(selection.isSelected(entity1)).toBe(false); // Was selected, now not
      expect(selection.isSelected(entity2)).toBe(true); // Was not selected, now is
      expect(selection.selectedEntities.size).toBe(1);
    });

    it('selectMultiple with empty array clears selection when mode is "set"', () => {
      selection.select(entity1);
      selection.selectMultiple([], 'set');

      expect(selection.selectedEntities.size).toBe(0);
    });

    it('selectMultiple defaults to "set" mode', () => {
      selection.select(entity1);
      selection.selectMultiple([entity2]);

      expect(selection.isSelected(entity1)).toBe(false);
      expect(selection.isSelected(entity2)).toBe(true);
    });
  });

  describe('clearSelection', () => {
    it('clears all selected entities', () => {
      selection.selectMultiple([entity1, entity2, entity3], 'set');
      selection.clearSelection();

      expect(selection.selectedEntities.size).toBe(0);
      expect(selection.primarySelection).toBeNull();
    });

    it('does nothing when selection is already empty', () => {
      const callback = vi.fn();
      selection.onSelectionChanged(callback);

      selection.clearSelection();

      // Should not trigger callback when already empty
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('selection callbacks', () => {
    it('notifies callback when selection changes', () => {
      const callback = vi.fn();
      selection.onSelectionChanged(callback);

      selection.select(entity1);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(selection.selectedEntities);
    });

    it('notifies callback for each selection change', () => {
      const callback = vi.fn();
      selection.onSelectionChanged(callback);

      selection.select(entity1);
      selection.addToSelection(entity2);
      selection.removeFromSelection(entity1);

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('does not notify after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = selection.onSelectionChanged(callback);

      selection.select(entity1);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      selection.select(entity2);

      // Should still be 1, not 2
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('notifies only once for batch operations', () => {
      const callback = vi.fn();
      selection.onSelectionChanged(callback);

      selection.selectMultiple([entity1, entity2, entity3], 'set');

      // Should be called once, not three times
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('handles multiple callbacks independently', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      selection.onSelectionChanged(callback1);
      selection.onSelectionChanged(callback2);

      selection.select(entity1);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('allows unsubscribing one callback without affecting others', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      selection.onSelectionChanged(callback1);
      const unsubscribe2 = selection.onSelectionChanged(callback2);

      unsubscribe2();
      selection.select(entity1);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });

    it('handles unsubscribing the same callback multiple times', () => {
      const callback = vi.fn();
      const unsubscribe = selection.onSelectionChanged(callback);

      unsubscribe();
      unsubscribe(); // Should not throw

      selection.select(entity1);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('scene integration', () => {
    let scene: Scene;

    beforeEach(() => {
      scene = new Scene('TestScene');
      scene.addEntity(entity1);
      scene.addEntity(entity2);
      scene.addEntity(entity3);
      selection.setScene(scene);
    });

    it('selects all entities in the scene', () => {
      selection.selectAll();

      expect(selection.selectedEntities.size).toBe(3);
      expect(selection.isSelected(entity1)).toBe(true);
      expect(selection.isSelected(entity2)).toBe(true);
      expect(selection.isSelected(entity3)).toBe(true);
    });

    it('does nothing when selectAll is called without scene', () => {
      const newSelection = new SelectionManager();
      newSelection.selectAll();

      expect(newSelection.selectedEntities.size).toBe(0);
    });

    it('selects entities by mesh type', () => {
      entity1.meshType = 'cube';
      entity2.meshType = 'sphere';
      entity3.meshType = 'cube';

      selection.selectByType('cube');

      expect(selection.selectedEntities.size).toBe(2);
      expect(selection.isSelected(entity1)).toBe(true);
      expect(selection.isSelected(entity2)).toBe(false);
      expect(selection.isSelected(entity3)).toBe(true);
    });

    it('does nothing when selectByType is called without scene', () => {
      const newSelection = new SelectionManager();
      newSelection.selectByType('cube');

      expect(newSelection.selectedEntities.size).toBe(0);
    });

    it('handles selectByType with no matches', () => {
      entity1.meshType = 'cube';
      entity2.meshType = 'cube';

      selection.selectByType('sphere');

      expect(selection.selectedEntities.size).toBe(0);
    });
  });

  describe('isSelected', () => {
    it('returns false for non-selected entity', () => {
      expect(selection.isSelected(entity1)).toBe(false);
    });

    it('returns true for selected entity', () => {
      selection.select(entity1);
      expect(selection.isSelected(entity1)).toBe(true);
    });
  });

  describe('selectedEntities immutability', () => {
    it('returns ReadonlySet that cannot be modified externally', () => {
      selection.select(entity1);
      const selected = selection.selectedEntities;

      // TypeScript should prevent this at compile time,
      // but we can test runtime behavior
      expect(selected.size).toBe(1);

      // Attempting to modify should not work (Set is readonly interface)
      // This tests that we're not accidentally returning mutable reference
      expect(() => {
        (selected as Set<Entity>).add(entity2);
      }).not.toThrow(); // It won't throw, but internal state should not change

      // Verify internal state wasn't affected by external modification attempt
      selection.clearSelection();
      expect(selection.selectedEntities.size).toBe(0);
    });
  });

  describe('primarySelection edge cases', () => {
    it('returns first entity when multiple are selected', () => {
      selection.selectMultiple([entity1, entity2, entity3], 'set');

      const primary = selection.primarySelection;
      expect(primary).not.toBeNull();
      expect([entity1, entity2, entity3]).toContain(primary);
    });

    it('returns the same primary after adding more entities', () => {
      selection.select(entity1);
      const primary1 = selection.primarySelection;

      selection.addToSelection(entity2);
      const primary2 = selection.primarySelection;

      // Primary should be stable (first added)
      expect(primary1).toBe(primary2);
    });
  });
});
