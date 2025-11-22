
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelBuilderController } from '../ModelBuilderController';
import type { Scene, Ray } from '@engine/world';
import type { ModelBuilderMode } from '../../model-builder/ModelBuilderMode';
import type { MicroBlockPreview } from '../../model-builder/MicroBlockPreview';
import { MicroBlockComponent } from '@engine/world';

describe('ModelBuilderController', () => {
  let scene: Scene;
  let mode: ModelBuilderMode;
  let preview: MicroBlockPreview;
  let controller: ModelBuilderController;

  beforeEach(() => {
    // Mock Scene
    scene = {
      entityCount: 0,
      queryEntities: vi.fn().mockReturnValue([]),
    } as unknown as Scene;

    // Mock Mode
    mode = {
      isModeActive: vi.fn().mockReturnValue(true),
      getToolState: vi.fn().mockReturnValue({
        mode: 'place',
        shape: 'cube',
        materialId: 'plastic_red',
        rotation: 0,
      }),
      placeBlock: vi.fn(),
      removeBlock: vi.fn(),
      paintBlock: vi.fn(),
      pickBlock: vi.fn(),
      placeBox: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      rotateBlock: vi.fn(),
      setToolMode: vi.fn(),
    } as unknown as ModelBuilderMode;

    // Mock Preview
    preview = {
      showPreview: vi.fn(),
      showBoxPreview: vi.fn(),
      hidePreview: vi.fn(),
    } as unknown as MicroBlockPreview;

    controller = new ModelBuilderController(scene, mode, preview);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should identify as ModelBuilder', () => {
    expect(controller.name).toBe('ModelBuilder');
  });

  it('should check hit returns false if mode inactive', () => {
    (mode.isModeActive as any).mockReturnValue(false);
    const ray = {} as Ray;
    
    expect(controller.checkHit(ray)).toBe(false);
    expect(preview.hidePreview).toHaveBeenCalled();
  });

  it('should handle pointer down (place)', () => {
    // Mock raycast hitting something
    vi.spyOn(controller, 'raycast').mockReturnValue([0, 0, 0]);
    
    const ray = {} as Ray;
    const event = { button: 0, altKey: false } as PointerEvent;
    
    controller.onPointerDown(event, ray);
    
    expect(mode.placeBlock).toHaveBeenCalledWith([0, 0, 0]);
  });

  it('should handle pointer down (pipette)', () => {
    vi.spyOn(controller, 'raycast').mockReturnValue([0, 0, 0]);
    
    const ray = {} as Ray;
    const event = { button: 0, altKey: true } as PointerEvent;
    
    controller.onPointerDown(event, ray);
    
    expect(mode.pickBlock).toHaveBeenCalledWith([0, 0, 0]);
  });

  it('should update preview on pointer move', () => {
    vi.spyOn(controller, 'raycast').mockReturnValue([1, 1, 1]);
    
    const ray = {} as Ray;
    const event = {} as PointerEvent;
    
    controller.onPointerMove(event, ray);
    
    expect(preview.showPreview).toHaveBeenCalledWith([1, 1, 1], expect.any(Object), true);
  });

  it('should handle box tool interaction', () => {
    // Set box mode
    (mode.getToolState as any).mockReturnValue({
      mode: 'box',
      shape: 'cube',
      materialId: 'test',
      rotation: 0,
    });

    vi.spyOn(controller, 'raycast').mockReturnValue([0, 0, 0]);

    const ray = {} as Ray;
    const downEvent = { button: 0, altKey: false } as PointerEvent;

    // 1. Start Box
    controller.onPointerDown(downEvent, ray);
    
    // 2. Drag to new position
    vi.spyOn(controller, 'raycast').mockReturnValue([2, 2, 2]);
    const moveEvent = {} as PointerEvent;
    controller.onPointerMove(moveEvent, ray);

    expect(preview.showBoxPreview).toHaveBeenCalledWith([0, 0, 0], [2, 2, 2], true);

    // 3. Release
    const upEvent = {} as PointerEvent;
    controller.onPointerUp(upEvent, ray);

    expect(mode.placeBox).toHaveBeenCalledWith([0, 0, 0], [2, 2, 2]);
  });
});

