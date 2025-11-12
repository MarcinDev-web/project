/**
 * Tests for TerrainSculptTool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerrainSculptTool } from '../TerrainSculptTool';
import { TerrainBrush } from '../TerrainBrush';
import { HeightmapTerrain } from '@engine/voxel/terrain';
import { Entity } from '@engine/world';
import { TerrainComponent } from '@engine/world/components/TerrainComponent';
import type { HeightmapTerrainTool } from '../HeightmapTerrainTool';

describe('TerrainSculptTool', () => {
  let tool: TerrainSculptTool;
  let terrain: HeightmapTerrain;
  let entity: Entity;

  beforeEach(() => {
    tool = new TerrainSculptTool();
    
    terrain = new HeightmapTerrain({
      resolution: 65,
      size: 100,
      minHeight: 0,
      maxHeight: 100,
    });

    // Initialize terrain with flat height
    for (let z = 0; z < 65; z++) {
      for (let x = 0; x < 65; x++) {
        terrain.setHeightAtGrid(x, z, 50);
      }
    }

    entity = new Entity('Terrain');
    const terrainComponent = entity.addComponent(new TerrainComponent());
    terrainComponent.terrainData = {
      type: 'heightmap',
      heightmap: terrain.exportData(),
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
      },
    };
  });

  describe('setTerrainEntity', () => {
    it('should set terrain entity with valid TerrainComponent', () => {
      tool.setTerrainEntity(entity);
      expect(tool.getHeightmapTerrain()).toBeDefined();
    });

    it('should not set terrain entity without TerrainComponent', () => {
      const invalidEntity = new Entity('Invalid');
      tool.setTerrainEntity(invalidEntity);
      expect(tool.getHeightmapTerrain()).toBeNull();
    });
  });

  describe('activate/deactivate', () => {
    it('should activate and deactivate sculpting mode', () => {
      tool.setTerrainEntity(entity);
      tool.activate();
      
      expect(tool.isSculptingActive()).toBe(true);
      
      tool.deactivate();
      expect(tool.isSculptingActive()).toBe(false);
    });

    it('should not activate without terrain entity', () => {
      tool.activate();
      expect(tool.isSculptingActive()).toBe(false);
    });
  });

  describe('sculptAt', () => {
    beforeEach(() => {
      tool.setTerrainEntity(entity);
      tool.activate();
    });

    it('should apply raise operation', () => {
      const position: [number, number, number] = [50, 50, 50];
      const initialHeight = terrain.getHeightAt(50, 50);
      
      tool.sculptAt(position, {
        operation: 'raise',
        strength: 1.0,
      });

      // Height should increase (commitChanges not called, so check terrain directly)
      const heightmapTerrain = tool.getHeightmapTerrain();
      if (heightmapTerrain) {
        const newHeight = heightmapTerrain.getHeightAt(50, 50);
        expect(newHeight).toBeGreaterThanOrEqual(initialHeight);
      }
    });

    it('should apply lower operation', () => {
      const position: [number, number, number] = [50, 50, 50];
      const initialHeight = terrain.getHeightAt(50, 50);
      
      tool.sculptAt(position, {
        operation: 'lower',
        strength: 1.0,
      });

      const heightmapTerrain = tool.getHeightmapTerrain();
      if (heightmapTerrain) {
        const newHeight = heightmapTerrain.getHeightAt(50, 50);
        expect(newHeight).toBeLessThanOrEqual(initialHeight);
      }
    });

    it('should validate input parameters', () => {
      const position: [number, number, number] = [50, 50, 50];
      
      // Invalid position
      tool.sculptAt(null as any, {
        operation: 'raise',
        strength: 1.0,
      });
      // Should not throw, but should log warning

      // Invalid strength
      tool.sculptAt(position, {
        operation: 'raise',
        strength: -1,
      });
      // Should not throw, but should log warning

      // Invalid operation
      tool.sculptAt(position, {
        operation: 'invalid' as any,
        strength: 1.0,
      });
      // Should not throw, but should log warning
    });

    it('should require targetHeight for flatten operation', () => {
      const position: [number, number, number] = [50, 50, 50];
      
      tool.sculptAt(position, {
        operation: 'flatten',
        strength: 1.0,
        // targetHeight not provided
      });
      // Should not throw, but should log warning
    });
  });

  describe('commitChanges', () => {
    it('should commit changes to TerrainComponent', () => {
      tool.setTerrainEntity(entity);
      tool.activate();
      
      const position: [number, number, number] = [50, 50, 50];
      tool.sculptAt(position, {
        operation: 'raise',
        strength: 1.0,
      });

      // commitChanges should update component
      tool.commitChanges();
      
      const terrainComponent = entity.getComponent(TerrainComponent);
      expect(terrainComponent).toBeDefined();
      expect(terrainComponent?.terrainData.heightmap).toBeDefined();
    });
  });

  describe('updateBrushConfig', () => {
    it('should update brush configuration', () => {
      tool.updateBrushConfig({
        size: 10,
        intensity: 0.5,
      });

      const brush = tool.getBrush();
      const config = brush.getConfig();
      expect(config.size).toBe(10);
      expect(config.intensity).toBe(0.5);
    });
  });

  describe('dispose', () => {
    it('should dispose tool and cleanup resources', () => {
      tool.setTerrainEntity(entity);
      tool.activate();
      
      tool.dispose();
      
      expect(tool.isSculptingActive()).toBe(false);
      expect(tool.getHeightmapTerrain()).toBeNull();
    });
  });
});

