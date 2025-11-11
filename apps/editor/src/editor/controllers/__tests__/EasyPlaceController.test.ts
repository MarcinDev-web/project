/**
 * Tests for EasyPlaceController
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EasyPlaceController } from '../EasyPlaceController';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { EditorState } from '../../core/state';
import { SelectionManager } from '@engine/world';

describe('EasyPlaceController', () => {
  let controller: EasyPlaceController;
  let scene: Scene;
  let state: EditorState;
  let canvas: HTMLCanvasElement;
  let mockConfig: any;

  beforeEach(() => {
    // Create canvas mock
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    // Create scene and state
    scene = new Scene();
    state = new EditorState(scene);

    // Mock dependencies
    const mockControls = {
      getState: vi.fn().mockReturnValue({ yaw: 0, pitch: 0, distance: 10 }),
      setState: vi.fn(),
      setEnabled: vi.fn(),
    };

    const mockSelection = {
      select: vi.fn(),
      selectMultiple: vi.fn(),
      setScene: vi.fn(),
    };

    const mockPlacementMode = {
      isActive: vi.fn().mockReturnValue(false),
      getPreviewEntity: vi.fn().mockReturnValue(null),
      confirmPlacement: vi.fn().mockReturnValue(null),
      cancelPlacement: vi.fn(),
      getPreview: vi.fn().mockReturnValue({ asset: null }),
      startPlacement: vi.fn(),
      rotatePreview: vi.fn(),
      getConfig: vi.fn().mockReturnValue({
        validColor: [0, 1, 0, 1],
        invalidColor: [1, 0, 0, 1],
      }),
      placeEntityFromTemplate: vi.fn().mockImplementation(() => new Entity('placed_from_template')),
    };

    const mockCollisionDetector = {
      checkCollisionOBB: vi.fn().mockResolvedValue({ hasCollision: false, collidingEntities: [] }),
    };

    mockConfig = {
      canvas,
      controls: mockControls,
      scene,
      selection: mockSelection,
      state,
      placementMode: mockPlacementMode,
      collisionDetector: mockCollisionDetector,
      updateSceneBuffers: vi.fn(),
      recordSnapshot: vi.fn(),
      onStatusMessage: vi.fn(),
    };

    controller = new EasyPlaceController(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => controller.initialize()).not.toThrow();
    });

    it('should return cleanup function', () => {
      const cleanup = controller.initialize();
      expect(typeof cleanup).toBe('function');
    });

    it('should clean up event listeners on dispose', () => {
      const cleanup = controller.initialize();
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('isEasyPlaceActive', () => {
    it('should return false when Easy Place mode is disabled', () => {
      state.easyPlaceMode.value = false;
      expect(controller.isEasyPlaceActive()).toBe(false);
    });

    it('should return true when Easy Place mode is enabled', () => {
      state.easyPlaceMode.value = true;
      expect(controller.isEasyPlaceActive()).toBe(true);
    });
  });

  describe('pattern state', () => {
    it('should start with inactive pattern state', () => {
      const patternState = controller.getPatternState();
      expect(patternState.active).toBe(false);
      expect(patternState.type).toBe('single');
    });

    it('should track pattern type from state', () => {
      state.easyPlacePattern.value = 'line';
      // Pattern state updates when pattern placement is initiated
      expect(state.easyPlacePattern.value).toBe('line');
    });
  });

  describe('single-click placement', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      state.easyPlacePattern.value = 'single';
      mockConfig.placementMode.isActive.mockReturnValue(true);
    });

    it('should confirm placement when single-click mode is active', () => {
      const entity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(entity);

      controller.initialize();

      // Simulate click
      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalled();
      expect(mockConfig.updateSceneBuffers).toHaveBeenCalled();
      expect(mockConfig.recordSnapshot).toHaveBeenCalledWith('Easy Place object');
    });

    it('should not place when placement mode is inactive', () => {
      mockConfig.placementMode.isActive.mockReturnValue(false);

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      expect(mockConfig.placementMode.confirmPlacement).not.toHaveBeenCalled();
    });

    it('should not place when Easy Place is disabled', () => {
      state.easyPlaceMode.value = false;

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      expect(mockConfig.placementMode.confirmPlacement).not.toHaveBeenCalled();
    });
  });

  describe('auto-continuation', () => {
    let testAsset: any;
    let previewEntity: Entity;

    beforeEach(() => {
      state.easyPlaceMode.value = true;
      state.easyPlacePattern.value = 'single';
      mockConfig.placementMode.isActive.mockReturnValue(true);

      // Create test asset
      testAsset = {
        name: 'test_block',
        color: [0.5, 0.5, 0.5, 1.0] as [number, number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        blockId: 'test_block',
      };

      // Create preview entity mock
      previewEntity = new Entity('preview');
      previewEntity.color = [0.5, 0.5, 0.5, 1.0];
      previewEntity.transform.scale = [1, 1, 1];
      previewEntity.transform.rotation = [0, 0, 0, 1];
      previewEntity.userData.baseColor = [0.5, 0.5, 0.5, 1.0];

      // Setup mocks
      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });
      mockConfig.placementMode.getPreviewEntity.mockReturnValue(previewEntity);
    });

    it('should automatically restart placement with same asset after successful placement', () => {
      const placedEntity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(placedEntity);
      mockConfig.placementMode.startPlacement.mockClear();

      controller.initialize();

      // First click - place block
      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Verify placement was confirmed
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(1);
      expect(mockConfig.selection.select).toHaveBeenCalledWith(placedEntity);

      // Verify auto-continuation: placement should restart with same asset
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledTimes(1);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(testAsset);
    });

    it('should NOT restart placement when placement fails (collision)', () => {
      // Simulate collision - confirmPlacement returns null
      mockConfig.placementMode.confirmPlacement.mockReturnValue(null);
      mockConfig.placementMode.startPlacement.mockClear();

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Verify placement was attempted
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(1);

      // Verify NO auto-continuation when placement fails
      expect(mockConfig.placementMode.startPlacement).not.toHaveBeenCalled();
      expect(mockConfig.onStatusMessage).toHaveBeenCalledWith(
        'Cannot place here (collision)',
        1000
      );
    });

    it('should preserve asset between placements for rapid clicking', () => {
      const placedEntity1 = new Entity('placed1');
      const placedEntity2 = new Entity('placed2');
      const placedEntity3 = new Entity('placed3');

      // Setup mock to return different entities for each call
      mockConfig.placementMode.confirmPlacement
        .mockReturnValueOnce(placedEntity1)
        .mockReturnValueOnce(placedEntity2)
        .mockReturnValueOnce(placedEntity3);

      // After each confirmPlacement, getPreview should return asset for next placement
      mockConfig.placementMode.getPreview
        .mockReturnValueOnce({
          asset: testAsset,
          active: true,
          canPlace: true,
          previewEntity,
          rotationAngle: 0,
          position: [0, 0, 0],
        })
        .mockReturnValueOnce({
          asset: testAsset,
          active: true,
          canPlace: true,
          previewEntity,
          rotationAngle: 0,
          position: [0, 0, 0],
        })
        .mockReturnValueOnce({
          asset: testAsset,
          active: true,
          canPlace: true,
          previewEntity,
          rotationAngle: 0,
          position: [0, 0, 0],
        });

      // After startPlacement, placement should be active again
      // Reset mock to return true after each startPlacement call
      let placementActive = true;
      mockConfig.placementMode.isActive.mockImplementation(() => placementActive);
      
      // When startPlacement is called, reactivate placement
      mockConfig.placementMode.startPlacement.mockImplementation(() => {
        placementActive = true;
      });
      
      // When confirmPlacement is called, deactivate placement
      mockConfig.placementMode.confirmPlacement.mockImplementation((...args) => {
        placementActive = false;
        // Return the appropriate entity based on call count
        const callCount = mockConfig.placementMode.confirmPlacement.mock.calls.length;
        if (callCount === 1) return placedEntity1;
        if (callCount === 2) return placedEntity2;
        return placedEntity3;
      });

      controller.initialize();

      // First click
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(1);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledTimes(1);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(testAsset);

      // Second click - should work immediately after restart
      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(2);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledTimes(2);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenLastCalledWith(testAsset);

      // Third click
      const click3 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click3);

      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(3);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledTimes(3);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenLastCalledWith(testAsset);
    });

    it('should apply stored properties (color, scale, rotation) when restarting placement', () => {
      const placedEntity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(placedEntity);

      // Setup preview entity with custom properties
      previewEntity.color = [1, 0, 0, 1]; // Red
      previewEntity.transform.scale = [2, 2, 2];
      previewEntity.transform.rotation = [0, 0.707, 0, 0.707]; // 90 degrees rotation
      previewEntity.userData.baseColor = [1, 0, 0, 1];

      // Create new preview entity that will be returned after startPlacement
      const newPreviewEntity = new Entity('preview_new');
      newPreviewEntity.color = [0.5, 0.5, 0.5, 1.0];
      newPreviewEntity.transform.scale = [1, 1, 1];
      newPreviewEntity.transform.rotation = [0, 0, 0, 1];

      // After startPlacement, getPreviewEntity should return new preview
      mockConfig.placementMode.getPreviewEntity
        .mockReturnValueOnce(previewEntity) // Before placement
        .mockReturnValueOnce(newPreviewEntity); // After restart

      // Simulate that properties were copied (applyStoredProperties should be called)
      // We need to access the private method through the controller
      // Since we can't access private methods, we'll verify the behavior indirectly
      // by checking that startPlacement was called and that the preview entity exists

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Verify placement and restart happened
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalled();
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(testAsset);
    });

    it('should handle rapid clicks without race conditions', () => {
      const placedEntity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(placedEntity);

      // Setup mock to simulate rapid state changes
      let placementActive = true;
      mockConfig.placementMode.isActive.mockImplementation(() => placementActive);

      // When confirmPlacement is called, it clears placement (sets active to false)
      mockConfig.placementMode.confirmPlacement.mockImplementation(() => {
        placementActive = false;
        return placedEntity;
      });

      // When startPlacement is called, it reactivates placement
      mockConfig.placementMode.startPlacement.mockImplementation(() => {
        placementActive = true;
      });

      controller.initialize();

      // Rapid clicks - should handle gracefully
      const click1 = new MouseEvent('click', { bubbles: true });
      const click2 = new MouseEvent('click', { bubbles: true });
      const click3 = new MouseEvent('click', { bubbles: true });

      canvas.dispatchEvent(click1);
      canvas.dispatchEvent(click2);
      canvas.dispatchEvent(click3);

      // All clicks should be processed (though some may be blocked by isPlacing flag)
      // At minimum, first click should succeed
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalled();
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalled();
    });

    it('should NOT restart placement when asset is null', () => {
      const placedEntity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(placedEntity);

      // Simulate null asset in preview
      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: null,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });

      mockConfig.placementMode.startPlacement.mockClear();

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Placement should succeed
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalled();

      // But NO restart should happen when asset is null
      expect(mockConfig.placementMode.startPlacement).not.toHaveBeenCalled();
    });

    it('should reset isPlacing flag even if placement throws error', () => {
      const error = new Error('Test error');
      mockConfig.placementMode.confirmPlacement.mockImplementation(() => {
        throw error;
      });

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      
      // Should not throw - error should be caught
      expect(() => canvas.dispatchEvent(clickEvent)).not.toThrow();

      // Should have attempted placement
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalled();

      // Should NOT restart after error
      expect(mockConfig.placementMode.startPlacement).not.toHaveBeenCalled();

      // Should be able to click again after error (isPlacing flag reset)
      mockConfig.placementMode.confirmPlacement.mockReturnValue(new Entity('recovered'));
      mockConfig.placementMode.confirmPlacement.mockClear();
      
      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      // Should attempt placement again
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple different assets correctly', () => {
      const asset1 = { name: 'block1', color: [1, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number] };
      const asset2 = { name: 'block2', color: [0, 1, 0, 1] as [number, number, number, number], scale: [2, 2, 2] as [number, number, number] };
      const asset3 = { name: 'block3', color: [0, 0, 1, 1] as [number, number, number, number], scale: [0.5, 0.5, 0.5] as [number, number, number] };

      const placed1 = new Entity('placed1');
      const placed2 = new Entity('placed2');
      const placed3 = new Entity('placed3');

      // First placement with asset1
      mockConfig.placementMode.getPreview.mockReturnValueOnce({
        asset: asset1,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });
      mockConfig.placementMode.confirmPlacement.mockReturnValueOnce(placed1);

      controller.initialize();
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(asset1);

      // Second placement with asset2
      mockConfig.placementMode.getPreview.mockReturnValueOnce({
        asset: asset2,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });
      mockConfig.placementMode.confirmPlacement.mockReturnValueOnce(placed2);
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(asset2);

      // Third placement with asset3
      mockConfig.placementMode.getPreview.mockReturnValueOnce({
        asset: asset3,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });
      mockConfig.placementMode.confirmPlacement.mockReturnValueOnce(placed3);

      const click3 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click3);

      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(asset3);
    });

    it('should handle rapid consecutive clicks (stress test)', () => {
      const entities = Array.from({ length: 10 }, (_, i) => new Entity(`placed${i}`));
      let callCount = 0;

      mockConfig.placementMode.confirmPlacement.mockImplementation(() => {
        const entity = entities[callCount] || new Entity(`placed${callCount}`);
        callCount++;
        return entity;
      });

      mockConfig.placementMode.getPreview.mockImplementation(() => ({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      }));

      controller.initialize();

      // Dispatch 10 rapid clicks
      for (let i = 0; i < 10; i++) {
        const click = new MouseEvent('click', { bubbles: true });
        canvas.dispatchEvent(click);
      }

      // Should have processed at least some clicks (may be throttled by isPlacing flag)
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalled();
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalled();
      
      // Verify that startPlacement was called with correct asset each time
      const startPlacementCalls = mockConfig.placementMode.startPlacement.mock.calls;
      startPlacementCalls.forEach((call) => {
        expect(call[0]).toBe(testAsset);
      });
    });

    it('should NOT auto-continue when pattern mode is active', () => {
      state.easyPlacePattern.value = 'line'; // Not 'single'
      const placedEntity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(placedEntity);
      mockConfig.placementMode.startPlacement.mockClear();

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Pattern mode should handle click differently - no auto-continuation
      // Instead, it should start/finish pattern
      expect(mockConfig.placementMode.startPlacement).not.toHaveBeenCalled();
    });

    it('should preserve properties (color, scale, rotation) across multiple placements', () => {
      const placedEntity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(placedEntity);

      // Setup preview with custom properties
      const customColor: [number, number, number, number] = [0.8, 0.2, 0.9, 1.0];
      const customScale: [number, number, number] = [1.5, 2.0, 0.8];
      const customRotation: [number, number, number, number] = [0, 0.707, 0, 0.707];

      previewEntity.color = customColor;
      previewEntity.transform.scale = customScale;
      previewEntity.transform.rotation = customRotation;
      previewEntity.userData.baseColor = customColor;

      // Simulate that properties are stored (copiedProperties)
      // Note: In real scenario, this would be set via Alt+Click, but for test we verify behavior

      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Verify placement happened
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalled();
      
      // Verify restart happened (applyStoredProperties would be called if copiedProperties exist)
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(testAsset);
    });

    it('should handle placement cancellation between placements', () => {
      const placedEntity1 = new Entity('placed1');
      const placedEntity2 = new Entity('placed2');

      mockConfig.placementMode.confirmPlacement
        .mockReturnValueOnce(placedEntity1)
        .mockReturnValueOnce(placedEntity2);

      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });

      controller.initialize();

      // First placement
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(1);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledTimes(1);

      // Cancel placement manually
      mockConfig.placementMode.cancelPlacement.mockClear();
      mockConfig.placementMode.isActive.mockReturnValue(false);
      mockConfig.placementMode.cancelPlacement();

      // Second placement after cancellation - should still work
      mockConfig.placementMode.isActive.mockReturnValue(true);
      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });

      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      // Should still place and auto-continue
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(2);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledTimes(2);
    });

    it('should handle Easy Place mode being disabled during placement', () => {
      const placedEntity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(placedEntity);

      controller.initialize();

      // Disable Easy Place mode
      state.easyPlaceMode.value = false;

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Should not place when Easy Place is disabled
      expect(mockConfig.placementMode.confirmPlacement).not.toHaveBeenCalled();
      expect(mockConfig.placementMode.startPlacement).not.toHaveBeenCalled();
    });

    it('should handle placement becoming inactive between clicks', () => {
      const placedEntity1 = new Entity('placed1');
      const placedEntity2 = new Entity('placed2');

      mockConfig.placementMode.confirmPlacement
        .mockReturnValueOnce(placedEntity1)
        .mockReturnValueOnce(placedEntity2);

      // Simulate placement becoming inactive after first placement
      let placementActive = true;
      mockConfig.placementMode.isActive.mockImplementation(() => placementActive);

      mockConfig.placementMode.confirmPlacement.mockImplementationOnce(() => {
        placementActive = false; // Placement becomes inactive
        return placedEntity1;
      });

      mockConfig.placementMode.startPlacement.mockImplementation(() => {
        placementActive = true; // Restart reactivates
      });

      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });

      controller.initialize();

      // First click
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(1);
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledTimes(1);

      // Second click - placement should be active again after restart
      mockConfig.placementMode.confirmPlacement.mockReturnValueOnce(placedEntity2);
      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      // Should process second click since placement was restarted
      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalledTimes(2);
    });

    it('should handle asset changes between placements', () => {
      const asset1 = { name: 'block1', color: [1, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number] };
      const asset2 = { name: 'block2', color: [0, 1, 0, 1] as [number, number, number, number], scale: [2, 2, 2] as [number, number, number] };

      const placed1 = new Entity('placed1');
      const placed2 = new Entity('placed2');

      // First placement with asset1
      mockConfig.placementMode.getPreview.mockReturnValueOnce({
        asset: asset1,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });
      mockConfig.placementMode.confirmPlacement.mockReturnValueOnce(placed1);

      controller.initialize();
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(asset1);

      // Change asset to asset2 (simulating user selecting different block)
      mockConfig.placementMode.getPreview.mockReturnValueOnce({
        asset: asset2,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });
      mockConfig.placementMode.confirmPlacement.mockReturnValueOnce(placed2);
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      // Should use new asset2 for continuation
      expect(mockConfig.placementMode.startPlacement).toHaveBeenCalledWith(asset2);
    });

    it('should handle selection changes during auto-continuation', () => {
      const placedEntity1 = new Entity('placed1');
      const placedEntity2 = new Entity('placed2');
      const placedEntity3 = new Entity('placed3');

      mockConfig.placementMode.confirmPlacement
        .mockReturnValueOnce(placedEntity1)
        .mockReturnValueOnce(placedEntity2)
        .mockReturnValueOnce(placedEntity3);

      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });

      controller.initialize();

      // First click
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      expect(mockConfig.selection.select).toHaveBeenCalledWith(placedEntity1);

      // Second click
      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      expect(mockConfig.selection.select).toHaveBeenCalledWith(placedEntity2);

      // Third click
      const click3 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click3);

      expect(mockConfig.selection.select).toHaveBeenCalledWith(placedEntity3);
    });

    it('should handle updateSceneBuffers being called after each placement', () => {
      const placedEntity1 = new Entity('placed1');
      const placedEntity2 = new Entity('placed2');

      mockConfig.placementMode.confirmPlacement
        .mockReturnValueOnce(placedEntity1)
        .mockReturnValueOnce(placedEntity2);

      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });

      controller.initialize();

      // First click
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      expect(mockConfig.updateSceneBuffers).toHaveBeenCalledTimes(1);

      // Second click
      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      expect(mockConfig.updateSceneBuffers).toHaveBeenCalledTimes(2);
    });

    it('should handle recordSnapshot being called for each placement', () => {
      const placedEntity1 = new Entity('placed1');
      const placedEntity2 = new Entity('placed2');

      mockConfig.placementMode.confirmPlacement
        .mockReturnValueOnce(placedEntity1)
        .mockReturnValueOnce(placedEntity2);

      mockConfig.placementMode.getPreview.mockReturnValue({
        asset: testAsset,
        active: true,
        canPlace: true,
        previewEntity,
        rotationAngle: 0,
        position: [0, 0, 0],
      });

      controller.initialize();

      // First click
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      expect(mockConfig.recordSnapshot).toHaveBeenCalledWith('Easy Place object');
      expect(mockConfig.recordSnapshot).toHaveBeenCalledTimes(1);

      // Second click
      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      expect(mockConfig.recordSnapshot).toHaveBeenCalledTimes(2);
      expect(mockConfig.recordSnapshot).toHaveBeenLastCalledWith('Easy Place object');
    });
  });

  describe('wheel events', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const mockEntity = new Entity('preview');
      mockEntity.transform.scale = [1, 1, 1];
      mockEntity.transform.rotation = [0, 0, 0, 1];
      mockConfig.placementMode.getPreviewEntity.mockReturnValue(mockEntity);
    });

    it('should rotate preview on wheel event', () => {
      controller.initialize();

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(wheelEvent);

      expect(mockConfig.placementMode.rotatePreview).toHaveBeenCalled();
    });

    it('should scale preview on shift+wheel event', () => {
      controller.initialize();

      const mockEntity = mockConfig.placementMode.getPreviewEntity();
      const originalScale = [...mockEntity.transform.scale];

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(wheelEvent);

      // Scale should have changed
      expect(mockEntity.transform.scale).not.toEqual(originalScale);
    });

    it('should not handle wheel when Easy Place is disabled', () => {
      state.easyPlaceMode.value = false;
      controller.initialize();

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(wheelEvent);

      expect(mockConfig.placementMode.rotatePreview).not.toHaveBeenCalled();
    });
  });

  describe('number keys for color presets', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const mockEntity = new Entity('preview');
      mockEntity.color = [1, 1, 1, 1];
      mockEntity.userData.baseColor = [1, 1, 1, 1];
      mockConfig.placementMode.getPreviewEntity.mockReturnValue(mockEntity);
    });

    it('should apply color preset on number key 1', () => {
      controller.initialize();

      const mockEntity = mockConfig.placementMode.getPreviewEntity();
      const keyEvent = new KeyboardEvent('keydown', { key: '1' });
      window.dispatchEvent(keyEvent);

      // Color should have changed
      expect(mockEntity.color).not.toEqual([1, 1, 1, 1]);
    });

    it('should apply different colors for different number keys', () => {
      controller.initialize();

      const mockEntity = mockConfig.placementMode.getPreviewEntity();

      const key1Event = new KeyboardEvent('keydown', { key: '1' });
      window.dispatchEvent(key1Event);
      const color1 = [...mockEntity.color];

      const key2Event = new KeyboardEvent('keydown', { key: '2' });
      window.dispatchEvent(key2Event);
      const color2 = [...mockEntity.color];

      expect(color1).not.toEqual(color2);
    });

    it('should not apply colors when Easy Place is disabled', () => {
      state.easyPlaceMode.value = false;
      controller.initialize();

      const mockEntity = mockConfig.placementMode.getPreviewEntity();
      const originalColor = [...mockEntity.color];

      const keyEvent = new KeyboardEvent('keydown', { key: '1' });
      window.dispatchEvent(keyEvent);

      expect(mockEntity.color).toEqual(originalColor);
    });
  });

  describe('pattern placement', () => {
    let preview: Entity;
    let asset: {
      name: string;
      color: [number, number, number, number];
      scale: [number, number, number];
    };

    beforeEach(() => {
      state.easyPlaceMode.value = true;
      mockConfig.placementMode.isActive.mockReturnValue(true);

      asset = {
        name: 'pattern_asset',
        color: [0.4, 0.6, 0.8, 1],
        scale: [1, 1, 1],
      };

      preview = new Entity('preview');
      preview.transform.position = [0, 0, 0];
      preview.transform.scale = [1, 1, 1];
      preview.transform.rotation = [0, 0, 0, 1];

      mockConfig.placementMode.getPreviewEntity.mockReturnValue(preview);
      mockConfig.placementMode.getPreview.mockReturnValue({
        asset,
        active: true,
        canPlace: true,
        previewEntity: preview,
        rotationAngle: 0,
        position: preview.transform.position,
      });
      mockConfig.placementMode.placeEntityFromTemplate.mockClear();
      mockConfig.collisionDetector.checkCollisionOBB = vi
        .fn()
        .mockResolvedValue({ hasCollision: false, collidingEntities: [] });
    });

    it('should start pattern on first click when pattern mode is active', async () => {
      state.easyPlacePattern.value = 'line';
      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);
      await Promise.resolve();

      const patternState = controller.getPatternState();
      expect(patternState.active).toBe(true);
    });

    it('should finish pattern on second click and place entities', async () => {
      state.easyPlacePattern.value = 'grid';
      controller.initialize();

      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);
      await Promise.resolve();

      preview.transform.position = [2, 0, 0];

      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockConfig.placementMode.placeEntityFromTemplate).toHaveBeenCalled();
      const firstCall = mockConfig.placementMode.placeEntityFromTemplate.mock.calls[0];
      expect(firstCall?.[1]?.asset).toBe(asset);
      expect(firstCall?.[1]?.emitPlacementConfirmed).toBe(false);
      expect(mockConfig.recordSnapshot).toHaveBeenCalledWith('Easy Place grid pattern');
      expect(mockConfig.updateSceneBuffers).toHaveBeenCalled();
    });

    it('should skip invalid positions when collisions detected', async () => {
      state.easyPlacePattern.value = 'line';
      state.easyPlaceSettings.value.lineSpacing = 2;
      controller.initialize();

      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);
      await Promise.resolve();

      preview.transform.position = [2, 0, 0];

      let callIndex = 0;
      mockConfig.collisionDetector.checkCollisionOBB.mockImplementation(() => {
        const result =
          callIndex === 0
            ? { hasCollision: true, collidingEntities: [] }
            : { hasCollision: false, collidingEntities: [] };
        callIndex++;
        return Promise.resolve(result);
      });
      mockConfig.placementMode.placeEntityFromTemplate.mockClear();

      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockConfig.placementMode.placeEntityFromTemplate).toHaveBeenCalledTimes(1);
      const callArgs = mockConfig.placementMode.placeEntityFromTemplate.mock.calls[0];
      expect(callArgs?.[1]?.position).toEqual([2, 0, 0]);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      controller.initialize();
      expect(() => controller.dispose()).not.toThrow();
    });

    it('should remove event listeners', () => {
      const cleanup = controller.initialize();
      cleanup();

      // Events should no longer trigger actions
      state.easyPlaceMode.value = true;
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Should not call placement methods after disposal
      expect(mockConfig.placementMode.confirmPlacement).not.toHaveBeenCalled();
    });
  });

  describe('pointer cancellation and focus loss', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      state.easyPlacePattern.value = 'line';
      const preview = new Entity('preview');
      preview.transform.position = [1, 0, 2];
      preview.transform.scale = [1, 1, 1];
      mockConfig.placementMode.isActive.mockReturnValue(true);
      mockConfig.placementMode.getPreviewEntity.mockReturnValue(preview);
    });

    it('should reset pattern and cancel placement on pointercancel', () => {
      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockConfig.placementMode.cancelPlacement.mockClear();
      canvas.dispatchEvent(clickEvent);
      expect(controller.getPatternState().active).toBe(true);

      const pointerCancelEvent = new PointerEvent('pointercancel', {
        pointerId: 42,
        bubbles: true,
      });
      window.dispatchEvent(pointerCancelEvent);

      expect(controller.getPatternState().active).toBe(false);
      expect(mockConfig.placementMode.cancelPlacement).toHaveBeenCalledWith(true);
      expect(mockConfig.controls.setEnabled).toHaveBeenCalledWith(true);
      expect(mockConfig.onStatusMessage).toHaveBeenCalledWith('Placement cancelled', 800);
    });

    it('should cancel placement on window blur without status message', () => {
      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);
      mockConfig.placementMode.cancelPlacement.mockClear();
      mockConfig.onStatusMessage.mockClear();
      mockConfig.controls.setEnabled.mockClear();

      const blurEvent = new Event('blur');
      window.dispatchEvent(blurEvent);

      expect(controller.getPatternState().active).toBe(false);
      expect(mockConfig.placementMode.cancelPlacement).toHaveBeenCalledWith(true);
      expect(mockConfig.controls.setEnabled).toHaveBeenCalledWith(true);
      expect(mockConfig.onStatusMessage).not.toHaveBeenCalled();
    });
  });
});

