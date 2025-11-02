/**
 * Tests for hotbar integration with placement system
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

describe('Hotbar Placement Integration', () => {
  let scene: Scene;
  let state: EditorState;
  let placementMode: PlacementMode;
  let panel: UnifiedBuildPanel;
  let onPlacementStart: ReturnType<typeof vi.fn>;
  let onStatusUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    state = new EditorState(scene);
    
    const snapSystem = new SnapSystem(state.snapConfig.value);
    const collisionDetector = new CollisionDetector(scene);
    placementMode = new PlacementMode(scene, snapSystem, collisionDetector);

    onPlacementStart = vi.fn();
    onStatusUpdate = vi.fn();

    panel = new UnifiedBuildPanel({
      scene,
      state,
      placementMode,
      onPlacementStart,
      onStatusUpdate,
    });

    panel.mount();
  });

  afterEach(() => {
    panel.dispose();
  });

  it('should start placement when hotbar slot is activated', () => {
    // Get a test asset
    const blocks = Object.values(BLOCK_LIBRARY);
    if (blocks.length === 0) {
      return; // Skip if no blocks available
    }

    const testBlock = blocks[0];
    if (!testBlock) {
      return; // Skip if block is undefined
    }

    const testAsset = blockToAsset(testBlock);
    
    // Add asset to hotbar
    panel.addToHotbar(testAsset);

    // Activate slot 0
    const hotbar = panel.getHotbar();
    expect(hotbar).not.toBeNull();
    
    hotbar!.activateSlot(0);

    // Verify placement was started
    const coordinator = panel.getCoordinator();
    expect(coordinator.isPlacementActive()).toBe(true);
    expect(coordinator.getCurrentAsset()).toEqual(testAsset);
    expect(coordinator.getCurrentSource()).toBe('hotbar');
    expect(onPlacementStart).toHaveBeenCalledWith(testAsset, undefined, 'hotbar');
  });

  it('should start placement via keyboard shortcut (1-9)', () => {
    const blocks = Object.values(BLOCK_LIBRARY);
    if (blocks.length === 0) {
      return;
    }

    const testBlock = blocks[0];
    if (!testBlock) {
      return;
    }

    const testAsset = blockToAsset(testBlock);
    panel.addToHotbar(testAsset);

    // Simulate pressing '1' key
    const event = new KeyboardEvent('keydown', {
      key: '1',
      bubbles: true,
    });

    document.dispatchEvent(event);

    // Verify placement was started
    const coordinator = panel.getCoordinator();
    expect(coordinator.isPlacementActive()).toBe(true);
    expect(coordinator.getCurrentAsset()).toEqual(testAsset);
  });

  it('should cancel previous placement when new hotbar slot is activated', () => {
    const blocks = Object.values(BLOCK_LIBRARY);
    if (blocks.length < 2) {
      return;
    }

    const block1 = blocks[0];
    const block2 = blocks[1];
    if (!block1 || !block2) {
      return;
    }

    const asset1 = blockToAsset(block1);
    const asset2 = blockToAsset(block2);

    // Add both assets to hotbar
    panel.addToHotbar(asset1);
    panel.addToHotbar(asset2);

    // Activate first slot
    const hotbar = panel.getHotbar();
    hotbar!.activateSlot(0);
    
    const coordinator = panel.getCoordinator();
    expect(coordinator.isPlacementActive()).toBe(true);
    expect(coordinator.getCurrentAsset()).toEqual(asset1);

    // Activate second slot - should cancel first and start second
    hotbar!.activateSlot(1);
    
    expect(coordinator.isPlacementActive()).toBe(true);
    expect(coordinator.getCurrentAsset()).toEqual(asset2);
  });

  it('should handle rotation during placement from hotbar', async () => {
    const blocks = Object.values(BLOCK_LIBRARY);
    if (blocks.length === 0) {
      return;
    }

    const testBlock = blocks[0];
    if (!testBlock) {
      return;
    }

    const testAsset = blockToAsset(testBlock);
    panel.addToHotbar(testAsset);

    // Start placement
    const hotbar = panel.getHotbar();
    hotbar!.activateSlot(0);

    const coordinator = panel.getCoordinator();
    expect(coordinator.isPlacementActive()).toBe(true);

    // Simulate Q key (rotate counter-clockwise)
    const qEvent = new KeyboardEvent('keydown', {
      key: 'q',
      bubbles: true,
    });
    document.dispatchEvent(qEvent);

    // Wait a bit for async rotation
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate E key (rotate clockwise)
    const eEvent = new KeyboardEvent('keydown', {
      key: 'e',
      bubbles: true,
    });
    document.dispatchEvent(eEvent);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Placement should still be active
    expect(coordinator.isPlacementActive()).toBe(true);
  });

  it('should confirm placement from hotbar via Enter key', () => {
    const blocks = Object.values(BLOCK_LIBRARY);
    if (blocks.length === 0) {
      return;
    }

    const testBlock = blocks[0];
    if (!testBlock) {
      return;
    }

    const testAsset = blockToAsset(testBlock);
    panel.addToHotbar(testAsset);

    // Start placement
    const hotbar = panel.getHotbar();
    hotbar!.activateSlot(0);

    const coordinator = panel.getCoordinator();
    expect(coordinator.isPlacementActive()).toBe(true);

    // Simulate Enter key
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    });
    document.dispatchEvent(enterEvent);

    // Placement should be inactive after confirmation (if placement succeeded)
    // Note: Actual placement success depends on collision check, but coordinator
    // should handle the confirmation attempt
    expect(coordinator.isPlacementActive()).toBe(false);
  });

  it('should cancel placement from hotbar via Escape key', () => {
    const blocks = Object.values(BLOCK_LIBRARY);
    if (blocks.length === 0) {
      return;
    }

    const testBlock = blocks[0];
    if (!testBlock) {
      return;
    }

    const testAsset = blockToAsset(testBlock);
    panel.addToHotbar(testAsset);

    // Start placement
    const hotbar = panel.getHotbar();
    hotbar!.activateSlot(0);

    const coordinator = panel.getCoordinator();
    expect(coordinator.isPlacementActive()).toBe(true);

    // Simulate Escape key
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    document.dispatchEvent(escapeEvent);

    // Placement should be cancelled
    expect(coordinator.isPlacementActive()).toBe(false);
    expect(coordinator.getCurrentAsset()).toBeNull();
  });

  it('should track source as hotbar when placement starts from hotbar', () => {
    const blocks = Object.values(BLOCK_LIBRARY);
    if (blocks.length === 0) {
      return;
    }

    const testBlock = blocks[0];
    if (!testBlock) {
      return;
    }

    const testAsset = blockToAsset(testBlock);
    panel.addToHotbar(testAsset);

    const hotbar = panel.getHotbar();
    hotbar!.activateSlot(0);

    const coordinator = panel.getCoordinator();
    expect(coordinator.getCurrentSource()).toBe('hotbar');
    expect(onPlacementStart).toHaveBeenCalledWith(
      expect.objectContaining({ name: testAsset.name }),
      undefined,
      'hotbar'
    );
  });
});

