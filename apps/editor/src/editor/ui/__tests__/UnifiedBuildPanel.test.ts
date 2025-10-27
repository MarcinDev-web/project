/**
 * UnifiedBuildPanel Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedBuildPanel } from '../UnifiedBuildPanel';
import { Scene } from '@engine/world';
import { EditorState } from '../../core/state';
import { PlacementMode } from '../../placement/PlacementMode';
import { SnapSystem } from '../../snap/SnapSystem';
import { CollisionDetector } from '../../placement/CollisionDetector';
import type { Asset } from '../../types/BlockAssetTypes';
import { BLOCK_LIBRARY } from '@engine/gfx-webgpu/blocks/BlockLibrary';
import { blockToAsset } from '../../types/BlockAssetTypes';

describe('UnifiedBuildPanel', () => {
  let scene: Scene;
  let state: EditorState;
  let placementMode: PlacementMode;
  let panel: UnifiedBuildPanel;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    state = new EditorState(scene);
    
    const snapSystem = new SnapSystem(state.snapConfig);
    const collisionDetector = new CollisionDetector(scene);
    placementMode = new PlacementMode(scene, snapSystem, collisionDetector);

    panel = new UnifiedBuildPanel({
      scene,
      state,
      placementMode,
      onStatusUpdate: vi.fn(),
    });
  });

  afterEach(() => {
    panel.dispose();
  });

  describe('Initialization', () => {
    it('should create panel without errors', () => {
      expect(panel).toBeDefined();
    });

    it('should mount to DOM', () => {
      panel.mount();
      
      const hotbar = panel.getHotbar();
      const catalog = panel.getCatalog();
      
      expect(hotbar).toBeDefined();
      expect(catalog).toBeDefined();
    });
  });

  describe('Visibility', () => {
    beforeEach(() => {
      panel.mount();
    });

    it('should show when visibility is true', () => {
      panel.setVisibility(true);
      expect(panel.isVisible()).toBe(true);
    });

    it('should hide when visibility is false', () => {
      panel.setVisibility(false);
      expect(panel.isVisible()).toBe(false);
    });
  });

  describe('Hotbar Integration', () => {
    beforeEach(() => {
      panel.mount();
    });

    it('should have hotbar component', () => {
      const hotbar = panel.getHotbar();
      expect(hotbar).not.toBeNull();
    });

    it('should add asset to hotbar', () => {
      // Get a test asset from BlockLibrary
      const blocks = Object.values(BLOCK_LIBRARY);
      if (blocks.length === 0) {
        // Skip if no blocks available
        return;
      }

      const testAsset = blockToAsset(blocks[0]);
      const success = panel.addToHotbar(testAsset);
      
      expect(success).toBe(true);
    });
  });

  describe('Catalog Integration', () => {
    beforeEach(() => {
      panel.mount();
    });

    it('should have catalog component', () => {
      const catalog = panel.getCatalog();
      expect(catalog).not.toBeNull();
    });

    it('should refresh catalog', () => {
      const catalog = panel.getCatalog();
      expect(() => catalog?.refresh()).not.toThrow();
    });
  });

  describe('Placement Coordination', () => {
    beforeEach(() => {
      panel.mount();
    });

    it('should have placement coordinator', () => {
      const coordinator = panel.getCoordinator();
      expect(coordinator).toBeDefined();
    });

    it('should not have active placement initially', () => {
      const coordinator = panel.getCoordinator();
      expect(coordinator.isPlacementActive()).toBe(false);
    });
  });

  describe('Refresh', () => {
    beforeEach(() => {
      panel.mount();
    });

    it('should refresh without errors', () => {
      expect(() => panel.refresh()).not.toThrow();
    });
  });
});


