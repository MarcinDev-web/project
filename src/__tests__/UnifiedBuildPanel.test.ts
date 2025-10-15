/**
 * UnifiedBuildPanel Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedBuildPanel } from '../editor/ui/UnifiedBuildPanel';
import { Scene } from '../scene/Scene';
import { EditorState } from '../editor/core/state';
import { PlacementMode } from '../editor/placement/PlacementMode';
import { SnapSystem } from '../editor/snap/SnapSystem';
import { CollisionDetector } from '../editor/placement/CollisionDetector';
import { assetRegistry } from '../editor/assets/AssetRegistry';
import type { Asset } from '../editor/assets/AssetTypes';

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
      // Get a test asset
      const assets = assetRegistry.getAll();
      if (assets.length === 0) {
        // Skip if no assets available
        return;
      }

      const testAsset = assets[0] as Asset;
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

