/**
 * Tests for PatternPlacer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternPlacer } from '../PatternPlacer';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import type { CollisionDetector } from '../CollisionDetector';

describe('PatternPlacer', () => {
  let scene: Scene;
  let patternPlacer: PatternPlacer;
  let mockCollisionDetector: CollisionDetector;

  beforeEach(() => {
    scene = new Scene();
    mockCollisionDetector = {
      checkCollisionOBB: vi.fn().mockReturnValue({ hasCollision: false, collidingEntities: [] }),
    } as any;
    patternPlacer = new PatternPlacer(scene, mockCollisionDetector);
  });

  describe('generateLinePattern', () => {
    it('should generate line pattern with correct spacing', () => {
      const positions = patternPlacer.generateLinePattern({
        start: [0, 0, 0],
        end: [10, 0, 0],
        spacing: 2,
      });

      expect(positions.length).toBeGreaterThan(1);
      expect(positions[0]?.position).toEqual([0, 0, 0]);
      expect(positions[positions.length - 1]?.position).toEqual([10, 0, 0]);
    });

    it('should handle zero distance (same start and end)', () => {
      const positions = patternPlacer.generateLinePattern({
        start: [5, 5, 5],
        end: [5, 5, 5],
        spacing: 1,
      });

      expect(positions.length).toBe(1);
      expect(positions[0]?.position).toEqual([5, 5, 5]);
    });

    it('should generate positions along diagonal', () => {
      const positions = patternPlacer.generateLinePattern({
        start: [0, 0, 0],
        end: [3, 3, 3],
        spacing: 1,
      });

      expect(positions.length).toBeGreaterThan(2);
      // First and last should be at start and end
      expect(positions[0]?.position).toEqual([0, 0, 0]);
      expect(positions[positions.length - 1]?.position).toEqual([3, 3, 3]);
    });
  });

  describe('generateGridPattern', () => {
    it('should generate grid pattern with correct dimensions', () => {
      const positions = patternPlacer.generateGridPattern({
        center: [0, 0, 0],
        width: 3,
        height: 3,
        spacing: 1,
      });

      expect(positions.length).toBe(9); // 3x3 grid
    });

    it('should center grid around center point', () => {
      const positions = patternPlacer.generateGridPattern({
        center: [0, 0, 0],
        width: 3,
        height: 3,
        spacing: 2,
      });

      // Check that grid is centered
      const xValues = positions.map(p => p.position[0]);
      const zValues = positions.map(p => p.position[2]);

      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const minZ = Math.min(...zValues);
      const maxZ = Math.max(...zValues);

      // Grid should be symmetric around 0
      expect(minX + maxX).toBeCloseTo(0, 5);
      expect(minZ + maxZ).toBeCloseTo(0, 5);
    });

    it('should handle single cell grid', () => {
      const positions = patternPlacer.generateGridPattern({
        center: [5, 0, 5],
        width: 1,
        height: 1,
        spacing: 1,
      });

      expect(positions.length).toBe(1);
      expect(positions[0]?.position).toEqual([5, 0, 5]);
    });
  });

  describe('generateCirclePattern', () => {
    it('should generate circle pattern with correct count', () => {
      const positions = patternPlacer.generateCirclePattern({
        center: [0, 0, 0],
        radius: 5,
        count: 8,
      });

      expect(positions.length).toBe(8);
    });

    it('should place points at correct radius', () => {
      const positions = patternPlacer.generateCirclePattern({
        center: [0, 0, 0],
        radius: 10,
        count: 4,
      });

      for (const pos of positions) {
        const dx = pos.position[0] - 0;
        const dz = pos.position[2] - 0;
        const distance = Math.sqrt(dx * dx + dz * dz);
        expect(distance).toBeCloseTo(10, 5);
      }
    });

    it('should respect start angle', () => {
      const positions = patternPlacer.generateCirclePattern({
        center: [0, 0, 0],
        radius: 5,
        count: 4,
        startAngle: 0,
      });

      // First point should be at angle 0 (positive X axis)
      expect(positions[0]?.position[0]).toBeCloseTo(5, 5);
      expect(positions[0]?.position[2]).toBeCloseTo(0, 5);
    });

    it('should maintain same Y coordinate as center', () => {
      const positions = patternPlacer.generateCirclePattern({
        center: [0, 10, 0],
        radius: 5,
        count: 8,
      });

      for (const pos of positions) {
        expect(pos.position[1]).toBe(10);
      }
    });
  });

  describe('validatePositions', () => {
    it('should mark positions as invalid when collision detected', () => {
      const entity = new Entity('test');
      entity.transform.scale = [1, 1, 1];

      mockCollisionDetector.checkCollisionOBB = vi.fn().mockReturnValue({
        hasCollision: true,
        collidingEntities: [],
      });

      const positions = [
        { position: [0, 0, 0] as [number, number, number], valid: true },
        { position: [1, 0, 0] as [number, number, number], valid: true },
      ];

      patternPlacer.validatePositions(positions, entity);

      expect(positions[0]?.valid).toBe(false);
      expect(positions[1]?.valid).toBe(false);
    });

    it('should mark positions as valid when no collision', () => {
      const entity = new Entity('test');
      entity.transform.scale = [1, 1, 1];

      mockCollisionDetector.checkCollisionOBB = vi.fn().mockReturnValue({
        hasCollision: false,
        collidingEntities: [],
      });

      const positions = [
        { position: [0, 0, 0] as [number, number, number], valid: false },
        { position: [1, 0, 0] as [number, number, number], valid: false },
      ];

      patternPlacer.validatePositions(positions, entity);

      expect(positions[0]?.valid).toBe(true);
      expect(positions[1]?.valid).toBe(true);
    });
  });

  describe('createPreviewEntities', () => {
    it('should create preview entities for each position', () => {
      const template = new Entity('template');
      template.transform.position = [0, 0, 0];
      template.transform.scale = [1, 1, 1];

      const positions = [
        { position: [0, 0, 0] as [number, number, number], valid: true },
        { position: [1, 0, 0] as [number, number, number], valid: false },
      ];

      const validColor: [number, number, number, number] = [0, 1, 0, 1];
      const invalidColor: [number, number, number, number] = [1, 0, 0, 1];

      patternPlacer.createPreviewEntities(positions, template, validColor, invalidColor);

      const previews = patternPlacer.getPreviewEntities();
      expect(previews.length).toBe(2);
      expect(previews[0]?.color).toEqual(validColor);
      expect(previews[1]?.color).toEqual(invalidColor);
    });

    it('should clear existing preview entities before creating new ones', () => {
      const template = new Entity('template');
      const positions = [
        { position: [0, 0, 0] as [number, number, number], valid: true },
      ];
      const validColor: [number, number, number, number] = [0, 1, 0, 1];
      const invalidColor: [number, number, number, number] = [1, 0, 0, 1];

      patternPlacer.createPreviewEntities(positions, template, validColor, invalidColor);
      expect(patternPlacer.getPreviewEntities().length).toBe(1);

      patternPlacer.createPreviewEntities(positions, template, validColor, invalidColor);
      expect(patternPlacer.getPreviewEntities().length).toBe(1);
    });
  });

  describe('placeEntities', () => {
    it('should only place entities at valid positions', () => {
      const template = new Entity('template');
      template.transform.scale = [1, 1, 1];
      template.color = [1, 1, 1, 1];

      const positions = [
        { position: [0, 0, 0] as [number, number, number], valid: true },
        { position: [1, 0, 0] as [number, number, number], valid: false },
        { position: [2, 0, 0] as [number, number, number], valid: true },
      ];

      const placed = patternPlacer.placeEntities(positions, template);

      expect(placed.length).toBe(2);
      expect(scene.getActiveEntities().length).toBe(2);
    });

    it('should copy template properties to placed entities', () => {
      const template = new Entity('TestTemplate');
      template.transform.scale = [2, 3, 4];
      template.transform.rotation = [0, 0.7071, 0, 0.7071];
      template.color = [0.5, 0.5, 0.5, 1];

      const positions = [
        { position: [5, 5, 5] as [number, number, number], valid: true },
      ];

      const placed = patternPlacer.placeEntities(positions, template);

      expect(placed[0]?.name).toBe('TestTemplate');
      expect(placed[0]?.transform.scale).toEqual([2, 3, 4]);
      // Check rotation components with tolerance for floating point precision
      expect(placed[0]?.transform.rotation[0]).toBeCloseTo(0, 5);
      expect(placed[0]?.transform.rotation[1]).toBeCloseTo(0.7071, 4);
      expect(placed[0]?.transform.rotation[2]).toBeCloseTo(0, 5);
      expect(placed[0]?.transform.rotation[3]).toBeCloseTo(0.7071, 4);
      expect(placed[0]?.color).toEqual([0.5, 0.5, 0.5, 1]);
    });
  });

  describe('getValidCount', () => {
    it('should return count of valid positions', () => {
      const positions = [
        { position: [0, 0, 0] as [number, number, number], valid: true },
        { position: [1, 0, 0] as [number, number, number], valid: false },
        { position: [2, 0, 0] as [number, number, number], valid: true },
        { position: [3, 0, 0] as [number, number, number], valid: false },
      ];

      expect(patternPlacer.getValidCount(positions)).toBe(2);
    });

    it('should return 0 for empty array', () => {
      expect(patternPlacer.getValidCount([])).toBe(0);
    });
  });

  describe('clearPreviewEntities', () => {
    it('should remove all preview entities from scene', () => {
      const template = new Entity('template');
      const positions = [
        { position: [0, 0, 0] as [number, number, number], valid: true },
        { position: [1, 0, 0] as [number, number, number], valid: true },
      ];
      const validColor: [number, number, number, number] = [0, 1, 0, 1];
      const invalidColor: [number, number, number, number] = [1, 0, 0, 1];

      patternPlacer.createPreviewEntities(positions, template, validColor, invalidColor);
      expect(patternPlacer.getPreviewEntities().length).toBe(2);

      patternPlacer.clearPreviewEntities();
      expect(patternPlacer.getPreviewEntities().length).toBe(0);
    });
  });
});


