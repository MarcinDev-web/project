/**
 * UnifiedBuildPanel Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedBuildPanel } from '../UnifiedBuildPanel';
import { Scene } from '@engine/world';
import { EditorState } from '../../core/state';
import { PlacementMode } from '../../placement/PlacementMode';
import { SnapSystem } from '@engine/editor-utils';
import { CollisionDetector } from '../../placement/CollisionDetector';
import { BLOCK_LIBRARY } from '@engine/blocks';
import { blockToAsset } from '../../types/BlockAssetTypes';

describe('UnifiedBuildPanel', () => {
  let scene: Scene;
  let state: EditorState;
  let placementMode: PlacementMode;
  let panel: UnifiedBuildPanel;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    state = new EditorState(scene);
    
    const snapSystem = new SnapSystem(state.snapConfig.value);
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
      
      expect(hotbar).toBeDefined();
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

      const firstBlock = blocks[0];
      if (!firstBlock) {
        return;
      }

      const testAsset = blockToAsset(firstBlock);
      const success = panel.addToHotbar(testAsset);
      
      expect(success).toBe(true);
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


