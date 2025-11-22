
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Vec3, Quat, Ray } from '@engine/core/math';
import { GizmoMeshRenderer } from '../GizmoMeshRenderer';
import { Scene, SelectionManager, Entity } from '@engine/world';
import { EditorState } from '../../core/state';
import { GizmoController } from '../GizmoController';

// 1. Mock @engine/core/math strictly without loading actual module
vi.mock('@engine/core/math', () => {
  return {
    subVec3: vi.fn((a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]]),
    addVec3: vi.fn((a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]]),
    scaleVec3: vi.fn((v, s) => [v[0]*s, v[1]*s, v[2]*s]),
    normalizeVec3: vi.fn((v) => {
      const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0, 0, 0];
    }),
    dotVec3: vi.fn((a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2]),
    crossVec3: vi.fn((a, b) => [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ]),
    distanceVec3: vi.fn((a, b) => Math.sqrt(
      (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2
    )),
    lengthVec3: vi.fn((v) => Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2])),
    quatFromAxisAngle: vi.fn(() => [0, 0, 0, 1]),
    quatMultiply: vi.fn(() => [0, 0, 0, 1]),
    mat4LookAt: vi.fn(),
    mat4Multiply: vi.fn(),
    mat4Perspective: vi.fn(),
    mat4Invert: vi.fn(),
    mat4GetTranslationOut: vi.fn(),
    mat4GetRotationOut: vi.fn(),
  };
});

// 2. Mock @engine/world completely to avoid loading it
vi.mock('@engine/world', () => {
  class MockTransform {
    position = [0, 0, 0];
    rotation = [0, 0, 0, 1];
    scale = [1, 1, 1];
    parent = null;
    getWorldPosition() { return [...this.position]; }
  }

  class MockEntity {
    id: string;
    name: string;
    transform = new MockTransform();
    constructor(name = 'Entity') {
      this.id = name + Math.random();
      this.name = name;
    }
    getComponent() { return null; }
    addComponent() {}
  }

  class MockScene {
    createEntity(name: string) { return new MockEntity(name); }
    addEntity() {}
  }

  class MockSelectionManager {
    selectedEntities = new Set();
    primarySelection = null;
    select(e: any) { 
      this.selectedEntities.add(e);
      this.primarySelection = e;
    }
    clear() { 
      this.selectedEntities.clear(); 
      this.primarySelection = null;
    }
  }

  class MockRaycaster {
    raycastClosest = vi.fn();
  }

  return {
    Scene: MockScene,
    Entity: MockEntity,
    SelectionManager: MockSelectionManager,
    Raycaster: MockRaycaster,
    TransformComponent: MockTransform,
    MeshComponent: class {},
    MaterialComponent: class { clone() { return this; } },
  };
});

// 3. Mock GizmoMeshRenderer
vi.mock('../GizmoMeshRenderer', () => {
  return {
    GizmoMeshRenderer: vi.fn().mockImplementation(() => ({
      update: vi.fn(),
      setMode: vi.fn(),
      setTransformSpace: vi.fn(),
      setVisible: vi.fn(),
      setHighlight: vi.fn(),
      getPickableEntities: vi.fn().mockReturnValue([]),
      getEntityHandle: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

// 4. Mock EditorState
vi.mock('../../core/state', () => {
  return {
    EditorState: vi.fn().mockImplementation(() => ({
      gizmoMode: { value: 'translate' },
      snapConfig: { value: { enabled: false } }
    })),
  };
});

describe('GizmoController', () => {
  let controller: GizmoController;
  let scene: any;
  let selection: any;
  let state: any;
  let canvas: HTMLCanvasElement;
  let updateSceneBuffers: ReturnType<typeof vi.fn>;
  let setControlsEnabled: ReturnType<typeof vi.fn>;
  let projectWorldToScreen: ReturnType<typeof vi.fn>;
  let getRay: ReturnType<typeof vi.fn>;
  let getCameraPosition: ReturnType<typeof vi.fn>;
  let getCameraRotation: ReturnType<typeof vi.fn>;
  let onTransformChanged: ReturnType<typeof vi.fn>;
  
  let mockRenderer: any;
  let mockRaycaster: any;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div></div>';
    
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'width', { value: 800, writable: true });
    Object.defineProperty(canvas, 'height', { value: 600, writable: true });
    (canvas as any).getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0
    });
    (canvas as any).setPointerCapture = vi.fn();
    (canvas as any).releasePointerCapture = vi.fn();
    document.body.appendChild(canvas);

    scene = new Scene('TestScene');
    selection = new SelectionManager();
    state = new EditorState(scene);
    
    updateSceneBuffers = vi.fn();
    setControlsEnabled = vi.fn();
    projectWorldToScreen = vi.fn((world: Vec3) => ({ x: 0, y: 0 }));
    getRay = vi.fn(() => ({ origin: [0, 0, 0], direction: [0, 0, -1] } as Ray));
    getCameraPosition = vi.fn(() => [0, 0, 5] as Vec3);
    getCameraRotation = vi.fn(() => [0, 0, 0, 1] as Quat);
    onTransformChanged = vi.fn();

    controller = new GizmoController({
      state,
      selection,
      canvas,
      scene,
      projectWorldToScreen,
      getCameraPosition,
      getCameraRotation,
      snapSystem: null,
      updateSceneBuffers,
      setControlsEnabled,
      onTransformChanged
    });

    // Get access to mocked instances
    mockRenderer = (controller as any).renderer;
    mockRaycaster = (controller as any).raycaster;
  });

  afterEach(() => {
    controller.dispose();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('creates GizmoMeshRenderer', () => {
      expect(GizmoMeshRenderer).toHaveBeenCalledWith(scene);
      expect(mockRenderer).toBeDefined();
    });

    // Initialization test removed as mount() is no longer part of the API
  });

  describe('Update Overlay', () => {
    it('hides renderer when no selection', () => {
      controller.updateOverlay();
      expect(mockRenderer.setVisible).toHaveBeenCalledWith(false);
      expect(setControlsEnabled).toHaveBeenCalledWith(true);
    });

    it('updates renderer when entity is selected', () => {
      const entity = new Entity('TestEntity');
      entity.transform.position = [1, 2, 3];
      scene.addEntity(entity);
      selection.select(entity);
      
      controller.updateOverlay();
      
      expect(mockRenderer.setVisible).toHaveBeenCalledWith(true);
      expect(mockRenderer.update).toHaveBeenCalledWith(
        expect.arrayContaining([1, 2, 3]), // position
        expect.any(Array), // rotation
        expect.any(Number) // scale
      );
    });
  });

  describe('Interaction', () => {
    beforeEach(() => {
      const entity = new Entity('TestEntity');
      scene.addEntity(entity);
      selection.select(entity);
      
      // Mock pickable entities
      const mockHandleEntity = new Entity('HandleX');
      mockRenderer.getPickableEntities.mockReturnValue([mockHandleEntity]);
      mockRenderer.getEntityHandle.mockReturnValue('x');
    });

    it('highlights handle on hover', () => {
      // Mock raycast hit
      mockRaycaster.raycastClosest.mockReturnValue({
        entity: { id: 'HandleX' },
        point: [0, 0, 0],
        distance: 1
      });

      // Simulate move
      const event = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      });
      const ray = { origin: [0, 0, 0], direction: [0, 0, -1] } as Ray;
      
      controller.onPointerMove(event, ray);

      expect(mockRenderer.setHighlight).toHaveBeenCalledWith('x');
      expect(canvas.style.cursor).toBe('pointer');
    });

    it('starts drag on pointer down', () => {
      mockRaycaster.raycastClosest.mockReturnValue({
        entity: { id: 'HandleX' },
        point: [0, 0, 0],
        distance: 1
      });
      
      const event = new PointerEvent('pointerdown', {
        button: 0,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        pointerId: 1
      });
      const ray = { origin: [0, 0, 0], direction: [0, 0, -1] } as Ray;
      
      const captureSpy = vi.spyOn(canvas, 'setPointerCapture');
      
      controller.onPointerDown(event, ray);

      expect(setControlsEnabled).toHaveBeenCalledWith(false);
      expect(captureSpy).toHaveBeenCalledWith(1);
      expect(controller.isDragging()).toBe(true);
    });
  });
});
