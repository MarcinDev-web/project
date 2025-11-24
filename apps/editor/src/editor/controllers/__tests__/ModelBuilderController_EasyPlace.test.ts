
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelBuilderController } from '../ModelBuilderController';
import type { Scene, Ray } from '@engine/world';
import type { ModelBuilderMode } from '../../model-builder/ModelBuilderMode';
import type { MicroBlockPreview } from '../../model-builder/MicroBlockPreview';
import { MICRO_BLOCK_SIZE } from '@engine/microblocks';

describe('ModelBuilderController - Easy Place', () => {
  let scene: Scene;
  let mode: ModelBuilderMode;
  let preview: MicroBlockPreview;
  let controller: ModelBuilderController;

  beforeEach(() => {
    scene = {
      entityCount: 0,
      queryEntities: vi.fn().mockReturnValue([]),
    } as unknown as Scene;

    mode = {
      isModeActive: vi.fn().mockReturnValue(true),
      getToolState: vi.fn().mockReturnValue({
        mode: 'place',
        shape: 'cube',
        materialId: 'plastic_red',
        rotation: 0,
        easyPlace: true, // Enable Easy Place
      }),
      placeBlock: vi.fn().mockReturnValue(true), // Assume placement success
      toggleEasyPlace: vi.fn(),
    } as unknown as ModelBuilderMode;

    preview = {
      showPreview: vi.fn(),
      hidePreview: vi.fn(),
    } as unknown as MicroBlockPreview;

    controller = new ModelBuilderController(scene, mode, preview);
  });

  it('should toggle easy place with key E', () => {
      controller.handleKey('e');
      expect(mode.toggleEasyPlace).toHaveBeenCalled();
  });

  it('should use easy place logic when dragging', () => {
      // Mock initial click to set lastPlacedPos
      vi.spyOn(controller, 'raycast').mockReturnValue([0, 0, 0]);
      // Ray pointing at [0,0,0] (which is size MICRO_BLOCK_SIZE)
      // Center is [0.5 * size, 0.5 * size, 0.5 * size]
      const ray = { 
          origin: [0.5 * MICRO_BLOCK_SIZE, 0.5 * MICRO_BLOCK_SIZE, 10], 
          direction: [0, 0, -1] 
      } as Ray;
      const event = { button: 0 } as PointerEvent;
      
      // 1. Click to start
      controller.onPointerDown(event, ray);
      expect(mode.placeBlock).toHaveBeenCalledWith([0, 0, 0]);

      // 2. Mock dragging to neighbor (1,0,0)
      // Neighbor (1,0,0) has bounds [size, 0, 0] to [2*size, size, size]
      // Center x = 1.5 * size
      const neighborX = 1.5 * MICRO_BLOCK_SIZE;
      const dragRay = { 
          origin: [neighborX, 0.5 * MICRO_BLOCK_SIZE, 10], 
          direction: [0, 0, -1] 
      } as Ray;

      // Mock raycast to return null (simulating empty space)
      vi.spyOn(controller, 'raycast').mockReturnValue(null);

      controller.onPointerMove({} as PointerEvent, dragRay);

      expect(mode.placeBlock).toHaveBeenCalledWith([1, 0, 0]);
  });
});

