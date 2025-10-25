import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlockDragController } from '../editor/controllers/BlockDragController';
import { Scene } from '../scene/Scene';
import { Entity } from '../scene/Entity';
import { SelectionManager } from '../scene/Selection';
import { PlacementMode } from '../editor/placement/PlacementMode';
import { CollisionDetector } from '../editor/placement/CollisionDetector';
import { SnapSystem } from '../editor/snap/SnapSystem';
import { EditorState } from '../editor/core/state';
import type { OrbitControls } from '../input';
import { mat4Invert, mat4GetRotation, mat4GetScale } from '@engine/core/math';

function createMockControls(): OrbitControls {
  let enabled = true;
  return {
    getState: () => ({ yaw: 0, pitch: 0, distance: 5, enabled }),
    cleanup: () => {},
    setEnabled: (e: boolean) => {
      enabled = e;
    },
    setState: vi.fn(),
    setPreset: vi.fn(),
  } as OrbitControls;
}

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'width', { value: 800, writable: true });
  Object.defineProperty(canvas, 'height', { value: 600, writable: true });
  (canvas as any).getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  // Mock pointer capture methods
  (canvas as any).setPointerCapture = vi.fn();
  (canvas as any).releasePointerCapture = vi.fn();
  return canvas;
}

function transformPointByMatrix(
  matrix: Float32Array,
  point: [number, number, number]
): [number, number, number] {
  const [x, y, z] = point;
  return [
    (matrix[0] ?? 0) * x + (matrix[4] ?? 0) * y + (matrix[8] ?? 0) * z + (matrix[12] ?? 0),
    (matrix[1] ?? 0) * x + (matrix[5] ?? 0) * y + (matrix[9] ?? 0) * z + (matrix[13] ?? 0),
    (matrix[2] ?? 0) * x + (matrix[6] ?? 0) * y + (matrix[10] ?? 0) * z + (matrix[14] ?? 0),
  ];
}

describe('BlockDragController', () => {
  let controller: BlockDragController;
  let scene: Scene;
  let selection: SelectionManager;
  let state: EditorState;
  let placementMode: PlacementMode;
  let collisionDetector: CollisionDetector;
  let snapSystem: SnapSystem;
  let controls: OrbitControls;
  let canvas: HTMLCanvasElement;
  let updateSceneBuffers: ReturnType<typeof vi.fn>;
  let recordSnapshot: ReturnType<typeof vi.fn>;
  let onStatusMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create scene and entities
    scene = new Scene('Test Scene');
    selection = new SelectionManager();
    selection.setScene(scene);
    state = new EditorState(scene);
    
    // Create systems
    snapSystem = new SnapSystem({ enabled: false, increment: 1, rotationIncrement: Math.PI / 4 });
    collisionDetector = new CollisionDetector(scene);
    placementMode = new PlacementMode(scene, snapSystem, collisionDetector);
    
    // Create mock controls and canvas
    controls = createMockControls();
    canvas = createMockCanvas();
    
    // Create mock callbacks
    updateSceneBuffers = vi.fn();
    recordSnapshot = vi.fn();
    onStatusMessage = vi.fn();

    // Create controller
    controller = new BlockDragController({
      canvas,
      controls,
      scene,
      selection,
      state,
      placementMode,
      collisionDetector,
      updateSceneBuffers,
      recordSnapshot,
      onStatusMessage,
    });
  });

  it('should initialize without errors', () => {
    const cleanup = controller.initialize();
    expect(cleanup).toBeInstanceOf(Function);
    cleanup();
  });

  it('should not be dragging initially', () => {
    expect(controller.isDraggingBlock()).toBe(false);
  });

  it('should start drag on pointer down on entity', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0, 0];
    entity.transform.scale = [1, 1, 1];
    scene.addEntity(entity);

    controller.initialize();

    // Simulate pointer down event
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400, // Center of canvas
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    
    canvas.dispatchEvent(pointerDownEvent);

    // Note: Drag doesn't start until pointer moves threshold distance
    expect(controller.isDraggingBlock()).toBe(false);
  });

  it('should start dragging after moving pointer threshold distance', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    scene.addEntity(entity);

    controller.initialize();

    // Simulate pointer down
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    // Move pointer beyond threshold (5 pixels)
    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 410, // 10 pixels away
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    window.dispatchEvent(pointerMoveEvent);

    // Should now be dragging
    expect(controller.isDraggingBlock()).toBe(true);
    expect(controls.getState().enabled).toBe(false); // Controls should be disabled during drag
  });

  it('should cancel drag on Escape key', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    const originalPosition = [...entity.transform.position];
    scene.addEntity(entity);

    controller.initialize();

    // Start dragging
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 410,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    window.dispatchEvent(pointerMoveEvent);

    expect(controller.isDraggingBlock()).toBe(true);

    // Cancel drag
    controller.cancelDrag();

    expect(controller.isDraggingBlock()).toBe(false);
    expect(entity.transform.position).toEqual(originalPosition);
    expect(controls.getState().enabled).toBe(true); // Controls should be re-enabled
  });

  it('should complete drag on pointer up with valid placement', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    scene.addEntity(entity);

    controller.initialize();

    // Start dragging
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 410,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    window.dispatchEvent(pointerMoveEvent);

    expect(controller.isDraggingBlock()).toBe(true);

    // Complete drag
    const pointerUpEvent = new PointerEvent('pointerup', {
      clientX: 410,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    window.dispatchEvent(pointerUpEvent);

    expect(controller.isDraggingBlock()).toBe(false);
    expect(recordSnapshot).toHaveBeenCalledWith('Move block');
    expect(controls.getState().enabled).toBe(true);
  });

  it('should not start drag in play mode', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    scene.addEntity(entity);

    state.editorMode.value = 'play';

    controller.initialize();

    // Try to start dragging
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 410,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    window.dispatchEvent(pointerMoveEvent);

    // Should not be dragging in play mode
    expect(controller.isDraggingBlock()).toBe(false);
  });

  it('should not start drag during placement mode', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    scene.addEntity(entity);

    // Start placement mode
    placementMode.startPlacement({
      name: 'TestAsset',
      blockId: 'test',
      scale: [1, 1, 1],
      color: [0.5, 0.5, 0.5, 1.0],
    });

    controller.initialize();

    // Try to start dragging
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 410,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    window.dispatchEvent(pointerMoveEvent);

    // Should not be dragging during placement mode
    expect(controller.isDraggingBlock()).toBe(false);
  });

  it('should update visual feedback based on collision state', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    entity.color = [0.7, 0.7, 0.7, 1.0];
    scene.addEntity(entity);

    // Add another entity to create potential collision
    const obstacle = new Entity('Obstacle');
    obstacle.transform.position = [2, 0.5, 0];
    obstacle.transform.scale = [1, 1, 1];
    scene.addEntity(obstacle);

    controller.initialize();

    // Start dragging
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 410,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    window.dispatchEvent(pointerMoveEvent);

    expect(controller.isDraggingBlock()).toBe(true);

    // Color should have changed to indicate valid/invalid placement
    // (green [0.2, 1.0, 0.2, 0.6] for valid, red [1.0, 0.2, 0.2, 0.6] for invalid)
    expect(entity.color[0]).toBeGreaterThanOrEqual(0);
    expect(entity.color[1]).toBeGreaterThanOrEqual(0);
    expect(entity.color[2]).toBeGreaterThanOrEqual(0);
  });

  it('should dispose cleanly', () => {
    controller.initialize();
    expect(() => controller.dispose()).not.toThrow();
    expect(controller.isDraggingBlock()).toBe(false);
  });

  it('should handle right-click gracefully (ignore)', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    scene.addEntity(entity);

    controller.initialize();

    // Right-click (button 2)
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 2,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    // Should not start dragging on right-click
    expect(controller.isDraggingBlock()).toBe(false);
  });

  it('should select entity when dragging starts', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    scene.addEntity(entity);

    controller.initialize();

    // Start dragging
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 410,
      clientY: 300,
      pointerId: 1,
      bubbles: true,
    });
    window.dispatchEvent(pointerMoveEvent);

    expect(controller.isDraggingBlock()).toBe(true);
    expect(selection.isSelected(entity)).toBe(true);
  });

  it('should convert world targets to local space when dragging nested entities', () => {
    const parent = new Entity('Parent');
    const angle = Math.PI / 3;
    parent.transform.position = [0.5, 1, -0.25];
    parent.transform.rotation = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
    parent.transform.scale = [2, 1.5, 0.75];
    scene.addEntity(parent);

    const child = new Entity('NestedBlock');
    child.transform.position = [0.25, 0.5, 0];
    child.transform.scale = [1, 1, 1];
    child.color = [0.6, 0.6, 0.6, 1];
    parent.addChild(child);

    const cleanup = controller.initialize();

    const collisionSpy = vi
      .spyOn(collisionDetector, 'checkCollisionOBB')
      .mockImplementation(() => ({ hasCollision: false, collidingEntities: [] }));

    (controller as any).dragState = {
      entity: child,
      originalPosition: [...child.transform.position],
      originalRotation: [...child.transform.rotation],
      originalScale: [...child.transform.scale],
      originalColor: [...child.color],
      pointerId: 1,
      startMousePos: [0, 0],
      isPreview: true,
      canPlace: true,
    };
    (controller as any).isDragging = true;
    child.userData.isPreview = true;

    const targetWorld: [number, number, number] = [1.25, 2.1, 1.5];
    (controller as any).updateDragPosition(targetWorld);

    const parentWorld = parent.transform.getWorldMatrix();
    const inverseParent = new Float32Array(16);
    mat4Invert(inverseParent, parentWorld);
    const expectedLocal = transformPointByMatrix(inverseParent, targetWorld);
    const localPosition = child.transform.position;

    expect(localPosition[0]).toBeCloseTo(expectedLocal[0], 5);
    expect(localPosition[1]).toBeCloseTo(expectedLocal[1], 5);
    expect(localPosition[2]).toBeCloseTo(expectedLocal[2], 5);

    const worldPosition = child.transform.getWorldPosition();
    expect(worldPosition[0]).toBeCloseTo(targetWorld[0], 5);
    expect(worldPosition[1]).toBeCloseTo(targetWorld[1], 5);
    expect(worldPosition[2]).toBeCloseTo(targetWorld[2], 5);

    expect(collisionSpy).toHaveBeenCalled();
    const [, collisionPosition, collisionRotation, collisionScale] = collisionSpy.mock.calls.at(-1)!;
    const childWorldMatrix = child.transform.getWorldMatrix();
    const expectedRotation = mat4GetRotation(childWorldMatrix);
    const expectedScale = mat4GetScale(childWorldMatrix);

    expect(collisionPosition).toEqual(targetWorld);
    expect((collisionRotation as number[])[0]).toBeCloseTo(expectedRotation[0], 5);
    expect((collisionRotation as number[])[1]).toBeCloseTo(expectedRotation[1], 5);
    expect((collisionRotation as number[])[2]).toBeCloseTo(expectedRotation[2], 5);
    expect((collisionRotation as number[])[3]).toBeCloseTo(expectedRotation[3], 5);
    expect((collisionScale as number[])[0]).toBeCloseTo(Math.max(0.001, expectedScale[0] - 0.001), 5);
    expect((collisionScale as number[])[1]).toBeCloseTo(Math.max(0.001, expectedScale[1] - 0.001), 5);
    expect((collisionScale as number[])[2]).toBeCloseTo(Math.max(0.001, expectedScale[2] - 0.001), 5);

    collisionSpy.mockRestore();
    cleanup();
  });

  it('should cancel drag on pointercancel and restore state', () => {
    const entity = new Entity('TestBlock');
    entity.transform.position = [0, 0.5, 0];
    entity.transform.scale = [1, 1, 1];
    entity.color = [0.4, 0.3, 0.2, 1];
    scene.addEntity(entity);

    const cleanup = controller.initialize();

    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 7,
      bubbles: true,
    });
    Object.defineProperty(pointerDownEvent, 'target', { value: canvas, writable: false });
    canvas.dispatchEvent(pointerDownEvent);

    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 412,
      clientY: 300,
      pointerId: 7,
      bubbles: true,
    });
    window.dispatchEvent(pointerMoveEvent);

    expect(controller.isDraggingBlock()).toBe(true);
    expect(controls.getState().enabled).toBe(false);

    (canvas as any).releasePointerCapture.mockClear();

    const pointerCancelEvent = new PointerEvent('pointercancel', {
      pointerId: 7,
      bubbles: true,
    });
    window.dispatchEvent(pointerCancelEvent);

    expect((canvas as any).releasePointerCapture).toHaveBeenCalledWith(7);
    expect(controller.isDraggingBlock()).toBe(false);
    expect((controller as any).dragState).toBeNull();
    expect(entity.userData.isPreview).toBe(false);
    expect(entity.transform.position).toEqual([0, 0.5, 0]);
    expect(entity.color).toEqual([0.4, 0.3, 0.2, 1]);
    expect(controls.getState().enabled).toBe(true);
    expect(onStatusMessage).toHaveBeenCalledWith('Drag cancelled', 1000);

    cleanup();
  });
});

