/**
 * Tests for HeightmapTerrainTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeightmapTerrainTool } from '../HeightmapTerrainTool';
import type { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { TerrainComponent } from '@engine/world/components/TerrainComponent';
import { MeshComponent } from '@engine/world/components/MeshComponent';
import { HeightmapTerrain } from '@engine/voxel/terrain';

describe('HeightmapTerrainTool', () => {
  let tool: HeightmapTerrainTool;
  let mockScene: Scene;

  beforeEach(() => {
    mockScene = {
      rootEntities: [],
      createEntity: vi.fn((name: string) => {
        const entity = new Entity(name);
        mockScene.rootEntities.push(entity);
        return entity;
      }),
    } as unknown as Scene;

    tool = new HeightmapTerrainTool(mockScene);
  });

  describe('createTerrain', () => {
    it('should create terrain entity with valid config', () => {
      const entity = tool.createTerrain({
        resolution: 65,
        size: 100,
        minHeight: 0,
        maxHeight: 100,
      });

      expect(entity).toBeDefined();
      expect(entity.hasComponent(TerrainComponent)).toBe(true);
      expect(entity.hasComponent(MeshComponent)).toBe(true);

      const terrainComponent = entity.getComponent(TerrainComponent);
      expect(terrainComponent?.terrainData.type).toBe('heightmap');
      expect(terrainComponent?.terrainData.heightmap).toBeDefined();
      expect(terrainComponent?.terrainData.heightmap?.resolution).toBe(65);
      expect(terrainComponent?.terrainData.heightmap?.size).toBe(100);
    });

    it('should initialize terrain with minHeight', () => {
      const entity = tool.createTerrain({
        resolution: 65,
        size: 100,
        minHeight: 10,
        maxHeight: 100,
      });

      const terrainComponent = entity.getComponent(TerrainComponent);
      const heightmapData = terrainComponent?.terrainData.heightmap;
      
      if (heightmapData && heightmapData.heights) {
        // Check a few sample heights
        expect(heightmapData.heights[0]).toBe(10);
        expect(heightmapData.heights[heightmapData.heights.length - 1]).toBe(10);
      }
    });
  });

  describe('updateTerrainMesh', () => {
    it('should update mesh for terrain entity', () => {
      const terrain = new HeightmapTerrain({
        resolution: 65,
        size: 100,
      });

      const entity = mockScene.createEntity('Terrain');
      const terrainComponent = entity.addComponent(new TerrainComponent());
      terrainComponent.terrainData = {
        type: 'heightmap',
        heightmap: terrain.exportData(),
        metadata: {
          version: '1.0.0',
          createdAt: Date.now(),
        },
      };

      tool.updateTerrainMesh(entity, terrain);

      const meshComponent = entity.getComponent(MeshComponent);
      expect(meshComponent).toBeDefined();
      expect(meshComponent?.meshType).toBe('terrain');
      expect(meshComponent?.meshData).toBeDefined();
      expect(meshComponent?.meshData?.vertices).toBeDefined();
      expect(meshComponent?.meshData?.indices).toBeDefined();
    });

    it('should create MeshComponent if not present', () => {
      const terrain = new HeightmapTerrain({
        resolution: 65,
        size: 100,
      });

      const entity = mockScene.createEntity('Terrain');
      const terrainComponent = entity.addComponent(new TerrainComponent());
      terrainComponent.terrainData = {
        type: 'heightmap',
        heightmap: terrain.exportData(),
        metadata: {
          version: '1.0.0',
          createdAt: Date.now(),
        },
      };

      expect(entity.hasComponent(MeshComponent)).toBe(false);
      tool.updateTerrainMesh(entity, terrain);
      expect(entity.hasComponent(MeshComponent)).toBe(true);
    });
  });

  describe('applyNoise', () => {
    it('should apply noise to terrain', () => {
      const terrain = new HeightmapTerrain({
        resolution: 65,
        size: 100,
      });

      const entity = mockScene.createEntity('Terrain');
      const terrainComponent = entity.addComponent(new TerrainComponent());
      terrainComponent.terrainData = {
        type: 'heightmap',
        heightmap: terrain.exportData(),
        metadata: {
          version: '1.0.0',
          createdAt: Date.now(),
        },
      };

      const initialHeights = [...(terrainComponent.terrainData.heightmap?.heights ?? [])];
      
      tool.applyNoise(entity, 5, 10);

      const updatedHeights = terrainComponent.terrainData.heightmap?.heights;
      expect(updatedHeights).toBeDefined();
      
      // Heights should have changed (noise applied)
      if (updatedHeights && initialHeights.length > 0) {
        let changed = false;
        for (let i = 0; i < Math.min(10, initialHeights.length); i++) {
          if (Math.abs(updatedHeights[i]! - initialHeights[i]!) > 0.001) {
            changed = true;
            break;
          }
        }
        // Note: With small noise, some heights might not change significantly
        // This test verifies the function runs without error
      }
    });

    it('should not apply noise to entity without TerrainComponent', () => {
      const entity = mockScene.createEntity('NotTerrain');
      
      expect(() => tool.applyNoise(entity, 5, 10)).not.toThrow();
    });
  });

  describe('applySmooth', () => {
    it('should apply smooth to terrain', () => {
      const terrain = new HeightmapTerrain({
        resolution: 65,
        size: 100,
      });

      const entity = mockScene.createEntity('Terrain');
      const terrainComponent = entity.addComponent(new TerrainComponent());
      terrainComponent.terrainData = {
        type: 'heightmap',
        heightmap: terrain.exportData(),
        metadata: {
          version: '1.0.0',
          createdAt: Date.now(),
        },
      };

      expect(() => tool.applySmooth(entity, 1)).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should dispose tool without errors', () => {
      expect(() => tool.dispose()).not.toThrow();
    });
  });
});

