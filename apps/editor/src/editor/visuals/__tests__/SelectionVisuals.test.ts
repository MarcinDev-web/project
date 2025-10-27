import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeBaseColor,
  applySelectionVisuals,
  HIGHLIGHT_COLOR_BOOST,
} from '../SelectionVisuals';
import { SelectionManager } from '@engine/world';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import type { RgbaColor } from '../../../utils/colors';

describe('SelectionVisuals', () => {
  let scene: Scene;
  let selection: SelectionManager;
  let entity: Entity;

  beforeEach(() => {
    scene = new Scene('TestScene');
    selection = new SelectionManager();
    entity = new Entity('TestEntity');
    scene.addEntity(entity);
  });

  describe('initializeBaseColor', () => {
    it('initializes entity color and stores base color', () => {
      const baseColor: RgbaColor = [0.5, 0.3, 0.7, 1.0];

      initializeBaseColor(entity, baseColor);

      expect(entity.color).toBeDefined();
      expect(entity.userData.baseColor).toBeDefined();

      const storedColor = entity.userData.baseColor as RgbaColor;
      expect(storedColor[0]).toBe(0.5);
      expect(storedColor[1]).toBe(0.3);
      expect(storedColor[2]).toBe(0.7);
      expect(storedColor[3]).toBe(1.0);

      expect(entity.color[0]).toBe(0.5);
      expect(entity.color[1]).toBe(0.3);
      expect(entity.color[2]).toBe(0.7);
      expect(entity.color[3]).toBe(1.0);
    });

    it('updates color values when initialized multiple times', () => {
      const baseColor1: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      const baseColor2: RgbaColor = [0.8, 0.2, 0.2, 1.0];

      initializeBaseColor(entity, baseColor1);
      expect(entity.color[0]).toBe(0.5);
      expect(entity.userData.baseColor).toBeDefined();

      initializeBaseColor(entity, baseColor2);

      // Values should be updated
      expect(entity.color[0]).toBe(0.8);
      expect(entity.color[1]).toBe(0.2);
      expect(entity.color[2]).toBe(0.2);

      const storedBase = entity.userData.baseColor as RgbaColor;
      expect(storedBase[0]).toBe(0.8);
      expect(storedBase[1]).toBe(0.2);
      expect(storedBase[2]).toBe(0.2);
    });

    it('handles entity without existing material component', () => {
      // Create entity without MaterialComponent
      const newEntity = new Entity('NewEntity');
      // Don't set color, so no MaterialComponent exists yet

      const baseColor: RgbaColor = [1.0, 0.0, 0.0, 1.0];
      initializeBaseColor(newEntity, baseColor);

      expect(newEntity.color).toBeDefined();
      expect(newEntity.color[0]).toBe(1.0);
      expect(newEntity.color[1]).toBe(0.0);
      expect(newEntity.color[2]).toBe(0.0);
    });
  });

  describe('applySelectionVisuals', () => {
    beforeEach(() => {
      // Initialize entities with base colors
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);
    });

    it('highlights selected entity', () => {
      selection.select(entity);
      applySelectionVisuals(scene, selection);

      // Color should be lightened
      expect(entity.color[0]).toBeGreaterThan(0.5);
      expect(entity.color[1]).toBeGreaterThan(0.5);
      expect(entity.color[2]).toBeGreaterThan(0.5);
    });

    it('does not highlight unselected entity', () => {
      applySelectionVisuals(scene, selection);

      // Color should remain at base value
      expect(entity.color[0]).toBe(0.5);
      expect(entity.color[1]).toBe(0.5);
      expect(entity.color[2]).toBe(0.5);
    });

    it('restores base color when entity is deselected', () => {
      const baseColor: RgbaColor = [0.3, 0.4, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      // Select and apply highlight
      selection.select(entity);
      applySelectionVisuals(scene, selection);

      const highlightedColor = [...entity.color];
      expect(highlightedColor[0]).toBeGreaterThan(0.3);

      // Deselect and restore
      selection.clearSelection();
      applySelectionVisuals(scene, selection);

      expect(entity.color[0]).toBe(0.3);
      expect(entity.color[1]).toBe(0.4);
      expect(entity.color[2]).toBe(0.5);
      expect(entity.color[3]).toBe(1.0);
    });

    it('uses custom highlight boost when provided', () => {
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      selection.select(entity);

      const customBoost = 0.4;
      applySelectionVisuals(scene, selection, customBoost);

      // With boost of 0.4, colors should be 0.5 + 0.4 = 0.9
      expect(entity.color[0]).toBeCloseTo(0.9, 2);
      expect(entity.color[1]).toBeCloseTo(0.9, 2);
      expect(entity.color[2]).toBeCloseTo(0.9, 2);
    });

    it('uses default highlight boost when not provided', () => {
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      selection.select(entity);
      applySelectionVisuals(scene, selection);

      // With default boost, colors should be 0.5 + HIGHLIGHT_COLOR_BOOST
      const expectedColor = 0.5 + HIGHLIGHT_COLOR_BOOST;
      expect(entity.color[0]).toBeCloseTo(expectedColor, 2);
      expect(entity.color[1]).toBeCloseTo(expectedColor, 2);
      expect(entity.color[2]).toBeCloseTo(expectedColor, 2);
    });

    it('handles multiple entities correctly', () => {
      const entity2 = new Entity('Entity2');
      const entity3 = new Entity('Entity3');
      scene.addEntity(entity2);
      scene.addEntity(entity3);

      const color1: RgbaColor = [0.3, 0.3, 0.3, 1.0];
      const color2: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      const color3: RgbaColor = [0.7, 0.7, 0.7, 1.0];

      initializeBaseColor(entity, color1);
      initializeBaseColor(entity2, color2);
      initializeBaseColor(entity3, color3);

      // Select only entity1 and entity3
      selection.selectMultiple([entity, entity3], 'set');
      applySelectionVisuals(scene, selection);

      // Entity1 and Entity3 should be highlighted
      expect(entity.color[0]).toBeGreaterThan(0.3);
      expect(entity3.color[0]).toBeGreaterThan(0.7);

      // Entity2 should remain at base color
      expect(entity2.color[0]).toBe(0.5);
      expect(entity2.color[1]).toBe(0.5);
      expect(entity2.color[2]).toBe(0.5);
    });

    it('handles entity hierarchy (traverses children)', () => {
      const child = new Entity('Child');
      entity.addChild(child);

      const parentColor: RgbaColor = [0.4, 0.4, 0.4, 1.0];
      const childColor: RgbaColor = [0.6, 0.6, 0.6, 1.0];

      initializeBaseColor(entity, parentColor);
      initializeBaseColor(child, childColor);

      // Select only child
      selection.select(child);
      applySelectionVisuals(scene, selection);

      // Parent should not be highlighted
      expect(entity.color[0]).toBe(0.4);

      // Child should be highlighted
      expect(child.color[0]).toBeGreaterThan(0.6);
    });

    it('clamps color values to [0, 1] range', () => {
      const brightColor: RgbaColor = [0.9, 0.9, 0.9, 1.0];
      initializeBaseColor(entity, brightColor);

      selection.select(entity);
      applySelectionVisuals(scene, selection);

      // Colors should not exceed 1.0
      expect(entity.color[0]).toBeLessThanOrEqual(1.0);
      expect(entity.color[1]).toBeLessThanOrEqual(1.0);
      expect(entity.color[2]).toBeLessThanOrEqual(1.0);
    });

    it('does not modify alpha channel', () => {
      const colorWithAlpha: RgbaColor = [0.5, 0.5, 0.5, 0.7];
      initializeBaseColor(entity, colorWithAlpha);

      selection.select(entity);
      applySelectionVisuals(scene, selection);

      // Alpha should remain unchanged
      expect(entity.color[3]).toBe(0.7);
    });

    it('initializes baseColor on first call if missing', () => {
      // Create entity without initializing base color
      const newEntity = new Entity('NewEntity');
      newEntity.color = [0.3, 0.4, 0.5, 1.0];
      scene.addEntity(newEntity);

      applySelectionVisuals(scene, selection);

      // Should auto-initialize baseColor from current color
      expect(newEntity.userData.baseColor).toBeDefined();
      const storedBase = newEntity.userData.baseColor as RgbaColor;
      expect(storedBase[0]).toBe(0.3);
      expect(storedBase[1]).toBe(0.4);
      expect(storedBase[2]).toBe(0.5);
    });

    it('creates default color if entity has no color', () => {
      const newEntity = new Entity('NewEntity');
      // Don't set color - entity will return default [1,1,1,1] from getter
      scene.addEntity(newEntity);

      applySelectionVisuals(scene, selection);

      // Should create default white color (from Entity's getter default)
      expect(newEntity.color).toBeDefined();
      expect(newEntity.color[0]).toBe(1);
      expect(newEntity.color[1]).toBe(1);
      expect(newEntity.color[2]).toBe(1);
    });

    it('avoids redundant writes when color already matches', () => {
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      // Apply visuals twice without changing selection
      applySelectionVisuals(scene, selection);
      const colorRef1 = entity.color;

      applySelectionVisuals(scene, selection);
      const colorRef2 = entity.color;

      // Should be same reference (no new allocation)
      expect(colorRef1).toBe(colorRef2);

      // Values should remain stable
      expect(entity.color[0]).toBe(0.5);
    });

    it('updates correctly when selection changes multiple times', () => {
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      // Select
      selection.select(entity);
      applySelectionVisuals(scene, selection);
      expect(entity.color[0]).toBeGreaterThan(0.5);

      // Deselect
      selection.clearSelection();
      applySelectionVisuals(scene, selection);
      expect(entity.color[0]).toBe(0.5);

      // Reselect
      selection.select(entity);
      applySelectionVisuals(scene, selection);
      expect(entity.color[0]).toBeGreaterThan(0.5);
    });
  });

  describe('performance and optimization', () => {
    it('reuses color arrays across multiple calls', () => {
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      const initialColorRef = entity.color;
      const initialBaseRef = entity.userData.baseColor;

      // Apply visuals multiple times
      for (let i = 0; i < 10; i++) {
        applySelectionVisuals(scene, selection);
      }

      // References should remain the same (no new allocations)
      expect(entity.color).toBe(initialColorRef);
      expect(entity.userData.baseColor).toBe(initialBaseRef);
    });

    it('handles large number of entities efficiently', () => {
      // Create 100 entities
      const entities: Entity[] = [];
      for (let i = 0; i < 100; i++) {
        const e = new Entity(`Entity${i}`);
        const color: RgbaColor = [Math.random(), Math.random(), Math.random(), 1.0];
        initializeBaseColor(e, color);
        scene.addEntity(e);
        entities.push(e);
      }

      // Select half of them
      const selected = entities.filter((_, i) => i % 2 === 0);
      selection.selectMultiple(selected, 'set');

      // This should complete quickly
      const startTime = performance.now();
      applySelectionVisuals(scene, selection);
      const endTime = performance.now();

      // Should take less than 10ms for 100 entities
      expect(endTime - startTime).toBeLessThan(10);

      // Verify correctness
      entities.forEach((e, i) => {
        const baseColor = e.userData.baseColor as RgbaColor;
        if (i % 2 === 0) {
          // Selected - should be lighter
          expect(e.color[0]).toBeGreaterThan(baseColor[0]);
        } else {
          // Not selected - should match base
          expect(e.color[0]).toBe(baseColor[0]);
        }
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty scene', () => {
      const emptyScene = new Scene('EmptyScene');
      expect(() => {
        applySelectionVisuals(emptyScene, selection);
      }).not.toThrow();
    });

    it('handles empty selection', () => {
      initializeBaseColor(entity, [0.5, 0.5, 0.5, 1.0]);

      expect(() => {
        applySelectionVisuals(scene, selection);
      }).not.toThrow();

      // Entity should keep base color
      expect(entity.color[0]).toBe(0.5);
    });

    it('handles entity with extreme color values', () => {
      const blackColor: RgbaColor = [0.0, 0.0, 0.0, 1.0];
      initializeBaseColor(entity, blackColor);

      selection.select(entity);
      applySelectionVisuals(scene, selection);

      // Should lighten even black color
      expect(entity.color[0]).toBeGreaterThan(0.0);
      expect(entity.color[1]).toBeGreaterThan(0.0);
      expect(entity.color[2]).toBeGreaterThan(0.0);
    });

    it('handles entity with white color', () => {
      const whiteColor: RgbaColor = [1.0, 1.0, 1.0, 1.0];
      initializeBaseColor(entity, whiteColor);

      selection.select(entity);
      applySelectionVisuals(scene, selection);

      // Should clamp at 1.0
      expect(entity.color[0]).toBe(1.0);
      expect(entity.color[1]).toBe(1.0);
      expect(entity.color[2]).toBe(1.0);
    });

    it('handles negative highlight boost (darken)', () => {
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      selection.select(entity);
      applySelectionVisuals(scene, selection, -0.2);

      // Should darken
      expect(entity.color[0]).toBeLessThan(0.5);
      expect(entity.color[1]).toBeLessThan(0.5);
      expect(entity.color[2]).toBeLessThan(0.5);
    });

    it('skips highlighting when skipHighlight is true', () => {
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      selection.select(entity);
      applySelectionVisuals(scene, selection, HIGHLIGHT_COLOR_BOOST, true);

      // Color should remain at base value even though entity is selected
      expect(entity.color[0]).toBe(0.5);
      expect(entity.color[1]).toBe(0.5);
      expect(entity.color[2]).toBe(0.5);
      expect(entity.color[3]).toBe(1.0);
    });

    it('applies highlighting when skipHighlight is false', () => {
      const baseColor: RgbaColor = [0.5, 0.5, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      selection.select(entity);
      applySelectionVisuals(scene, selection, HIGHLIGHT_COLOR_BOOST, false);

      // Color should be lightened
      expect(entity.color[0]).toBeGreaterThan(0.5);
      expect(entity.color[1]).toBeGreaterThan(0.5);
      expect(entity.color[2]).toBeGreaterThan(0.5);
    });

    it('restores base color when skipHighlight is true after highlighting', () => {
      const baseColor: RgbaColor = [0.4, 0.5, 0.6, 1.0];
      initializeBaseColor(entity, baseColor);

      selection.select(entity);
      
      // First apply with highlighting
      applySelectionVisuals(scene, selection, HIGHLIGHT_COLOR_BOOST, false);
      expect(entity.color[0]).toBeGreaterThan(0.4);

      // Then apply with skipHighlight - should restore base color
      applySelectionVisuals(scene, selection, HIGHLIGHT_COLOR_BOOST, true);
      expect(entity.color[0]).toBe(0.4);
      expect(entity.color[1]).toBe(0.5);
      expect(entity.color[2]).toBe(0.6);
    });

    it('handles skipHighlight with multiple selected entities', () => {
      const baseColor: RgbaColor = [0.3, 0.4, 0.5, 1.0];
      initializeBaseColor(entity, baseColor);

      const entity2 = new Entity('TestEntity2');
      scene.addEntity(entity2);
      initializeBaseColor(entity2, [0.6, 0.7, 0.8, 1.0]);

      selection.selectMultiple([entity, entity2], 'set');
      applySelectionVisuals(scene, selection, HIGHLIGHT_COLOR_BOOST, true);

      // Both entities should keep their base colors
      expect(entity.color[0]).toBe(0.3);
      expect(entity.color[1]).toBe(0.4);
      expect(entity.color[2]).toBe(0.5);
      
      expect(entity2.color[0]).toBe(0.6);
      expect(entity2.color[1]).toBe(0.7);
      expect(entity2.color[2]).toBe(0.8);
    });
  });
});
