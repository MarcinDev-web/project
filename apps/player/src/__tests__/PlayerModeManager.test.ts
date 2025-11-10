/**
 * Basic tests for PlayerModeManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerModeManager } from '../managers/PlayerModeManager.js';
import { Scene } from '@engine/world';
import { PhysicsWorld } from '@engine/world';
import { CharacterControllerSystem } from '@engine/stdlib/CharacterController';
import { serializeScene } from '@engine/editor-utils';

// Mock fetch for loadBuildData
global.fetch = vi.fn();

// Mock CameraDirector
vi.mock('@engine/camera', async () => {
  const actual = await vi.importActual<typeof import('@engine/camera')>('@engine/camera');
  return {
    ...actual,
    CameraDirector: vi.fn().mockImplementation(() => ({
      setMode: vi.fn(),
      setFov: vi.fn(),
      setCameraOffset: vi.fn(),
      setCollisionRadius: vi.fn(),
      setPlayerPose: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
      getViewMatrix: vi.fn(() => new Float32Array(16)),
      getProjectionMatrix: vi.fn(() => new Float32Array(16)),
    })),
  };
});

// Mock InputContextManager
vi.mock('@engine/input', async () => {
  const actual = await vi.importActual<typeof import('@engine/input')>('@engine/input');
  return {
    ...actual,
    InputContextManager: vi.fn().mockImplementation(() => ({
      push: vi.fn(),
      pop: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

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
  return canvas;
}

function createMockRenderer(): any {
  return {
    render: vi.fn(),
    updateBuffers: vi.fn(),
    dispose: vi.fn(),
    getCapabilities: vi.fn(() => ({ features: {} })),
  };
}


function createMockFpsCamera(): any {
  return {
    enable: vi.fn(),
    disable: vi.fn(),
    update: vi.fn(),
    setYawPitch: vi.fn(),
    getYawPitch: vi.fn(() => [0, 0] as [number, number]),
    getForwardDirection: vi.fn(() => [0, 0, -1] as [number, number, number]),
    getRightDirection: vi.fn(() => [1, 0, 0] as [number, number, number]),
    setEyeHeight: vi.fn(),
    setSensitivity: vi.fn(),
    setInvertY: vi.fn(),
  };
}

function createMockCharacterInput(): any {
  return {
    enable: vi.fn(),
    disable: vi.fn(),
    setBindings: vi.fn(),
  };
}

describe.skip('PlayerModeManager', () => {
  let canvas: HTMLCanvasElement;
  let scene: Scene;
  let renderer: any;
  let physicsWorld: PhysicsWorld;
  let characterSystem: CharacterControllerSystem;
  let characterInput: any;
  let fpsCamera: any;
  let manager: PlayerModeManager;

  beforeEach(() => {
    canvas = createMockCanvas();
    scene = new Scene('Test Scene');
    renderer = createMockRenderer();
    physicsWorld = new PhysicsWorld(scene);
    characterSystem = new CharacterControllerSystem(scene, physicsWorld);
    characterInput = createMockCharacterInput();
    fpsCamera = createMockFpsCamera();

    manager = new PlayerModeManager({
      canvas,
      scene,
      renderer,
      physicsWorld,
      characterSystem,
      characterInput,
      fpsCamera,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('should be initialized', () => {
    expect(manager).toBeDefined();
    expect(manager.getPlayerEntity()).toBeNull();
  });

  it('should handle initialization with valid buildId', async () => {
    // Mock valid build data response
    const mockScene = new Scene('Test Build');
    const sceneJSON = serializeScene(mockScene);

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sceneJSON,
        playerStart: { position: [0, 2, 0], rotation: 0 },
      }),
    });

    await expect(manager.initialize('test-build-id')).resolves.not.toThrow();
  });

  it('should handle initialization with invalid buildId', async () => {
    // Mock 404 response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(manager.initialize('invalid-build-id')).rejects.toThrow();
  });

  it('should handle initialization with missing sceneJSON', async () => {
    // Mock response without sceneJSON
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // Missing sceneJSON
      }),
    });

    await expect(manager.initialize('test-build-id')).rejects.toThrow('missing sceneJSON');
  });

  it('should cleanup on dispose', () => {
    manager.dispose();

    expect(characterInput.disable).toHaveBeenCalled();
    expect(fpsCamera.disable).toHaveBeenCalled();
    expect(manager.getPlayerEntity()).toBeNull();
  });

  it('should not exit if not initialized', async () => {
    // Exit should not throw if not initialized
    await expect(manager.exit()).resolves.not.toThrow();
  });

  it('should update game loop', () => {
    const deltaTime = 0.016; // ~60fps

    // Update should not throw even if not initialized
    expect(() => manager.update(deltaTime)).not.toThrow();
  });
});


