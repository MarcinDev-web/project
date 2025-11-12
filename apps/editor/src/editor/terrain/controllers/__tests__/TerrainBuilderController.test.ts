/**
 * Tests for TerrainBuilderController
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerrainBuilderController } from '../TerrainBuilderController';
import type { Scene } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import type { EditorState } from '../../../core/state';
import { Entity } from '@engine/world';
import { TerrainComponent } from '@engine/world/components/TerrainComponent';
import { CameraComponent } from '@engine/world/components/CameraComponent';
import { HeightmapTerrain } from '@engine/voxel/terrain';

describe('TerrainBuilderController', () => {
  let mockScene: Scene;
  let mockControls: OrbitControls;
  let mockState: EditorState;
  let mockCanvas: HTMLCanvasElement;
  let controller: TerrainBuilderController;

  beforeEach(() => {
    // Create mock canvas
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    // Create mock scene
    mockScene = {
      rootEntities: [],
      primaryCamera: null,
      createEntity: vi.fn((name: string) => {
        const entity = new Entity(name);
        mockScene.rootEntities.push(entity);
        return entity;
      }),
    } as unknown as Scene;

    // Create mock controls
    mockControls = {} as OrbitControls;

    // Create mock state
    mockState = {} as EditorState;

    controller = new TerrainBuilderController({
      canvas: mockCanvas,
      scene: mockScene,
      controls: mockControls,
      state: mockState,
    });
  });

  describe('constructor', () => {
    it('should create controller with valid config', () => {
      expect(controller).toBeDefined();
      expect(controller.isEditingActive()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize controller and return cleanup function', () => {
      const cleanup = controller.initialize();
      expect(cleanup).toBeDefined();
      expect(typeof cleanup).toBe('function');
      
      // Cleanup should dispose controller
      cleanup();
      expect(controller.isEditingActive()).toBe(false);
    });
  });

  describe('activate', () => {
    it('should activate with valid terrain entity', () => {
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

      controller.initialize();
      controller.activate(entity);

      expect(controller.isEditingActive()).toBe(true);
    });

    it('should not activate with invalid entity', () => {
      const entity = mockScene.createEntity('NotTerrain');
      
      controller.initialize();
      const onStatusMessage = vi.fn();
      controller = new TerrainBuilderController({
        canvas: mockCanvas,
        scene: mockScene,
        controls: mockControls,
        state: mockState,
        onStatusMessage,
      });
      controller.initialize();

      controller.activate(entity);

      expect(controller.isEditingActive()).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith('Invalid terrain entity', 2000);
    });

    it('should find terrain entity if not provided', () => {
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

      controller.initialize();
      controller.activate();

      expect(controller.isEditingActive()).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('should deactivate editing mode', () => {
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

      controller.initialize();
      controller.activate(entity);
      expect(controller.isEditingActive()).toBe(true);

      controller.deactivate();
      expect(controller.isEditingActive()).toBe(false);
    });
  });

  describe('setOperation', () => {
    it('should set brush operation', () => {
      controller.initialize();
      
      const operations: Array<'raise' | 'lower' | 'smooth' | 'flatten' | 'pinch'> = [
        'raise',
        'lower',
        'smooth',
        'flatten',
        'pinch',
      ];

      for (const op of operations) {
        controller.setOperation(op);
        // Operation is set internally, verify no errors
        expect(() => controller.setOperation(op)).not.toThrow();
      }
    });
  });

  describe('dispose', () => {
    it('should dispose controller and cleanup resources', () => {
      controller.initialize();
      controller.activate();
      
      expect(() => controller.dispose()).not.toThrow();
      expect(controller.isEditingActive()).toBe(false);
    });
  });
});

