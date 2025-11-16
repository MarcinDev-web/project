/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorModeManager } from '../../editor/managers/EditorModeManager';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { EditorState } from '../../editor/core/state';
import { SelectionManager } from '@engine/world';
import { PhysicsWorld } from '@engine/world/physics';
import { CharacterControllerSystem, GroundDetectionSystem } from '@engine/stdlib/CharacterController';
import { CharacterInputHandler } from '@engine/input';
import { FPSCamera } from '@engine/camera';
import { CharacterController } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import { createDefaultManifest } from '../../editor/core/PlayManifest';
import { PlayModeStateType } from '../../editor/core/PlayModeStateMachine';

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

function createMockControls(): OrbitControls {
  let state = { yaw: 0, pitch: 0, distance: 5 };

  return {
    getState: () => ({ ...state }),
    setState: (s) => {
      state = { ...state, ...s };
    },
    setPreset: (s) => {
      state = { ...state, ...s };
    },
    setEnabled: () => {
      /* mock implementation */
    },
    cleanup: () => {},
  } as OrbitControls;
}

// Helper to simulate key press
function simulateKeyPress(keyCode: string, pressed: boolean): void {
  const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
    code: keyCode,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

describe('Play Mode WSAD Integration (E2E)', () => {
  let scene: Scene;
  let state: EditorState;
  let selection: SelectionManager;
  let canvas: HTMLCanvasElement;
  let controls: OrbitControls;
  let physicsWorld: PhysicsWorld;
  let groundDetectionSystem: GroundDetectionSystem;
  let characterSystem: CharacterControllerSystem;
  let characterInput: CharacterInputHandler;
  let fpsCamera: FPSCamera;
  let modeManager: EditorModeManager;
  let updateSceneBuffers: ReturnType<typeof vi.fn>;
  let onModeChanged: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset document
    document.body.innerHTML = '';

    // Create scene with ground entity
    scene = new Scene('Test Scene');
    const ground = new Entity('Ground');
    ground.transform.position = [0, -1, 0];
    ground.transform.scale = [10, 0.5, 10];
    scene.addEntity(ground);

    // Initialize systems
    state = new EditorState(scene);
    selection = new SelectionManager();
    selection.setScene(scene);
    canvas = createMockCanvas();
    controls = createMockControls();
    physicsWorld = new PhysicsWorld(scene);
    groundDetectionSystem = new GroundDetectionSystem(scene, physicsWorld);
    characterSystem = new CharacterControllerSystem(scene, physicsWorld);
    characterInput = new CharacterInputHandler();
    fpsCamera = new FPSCamera(canvas);

    // Create mocks
    updateSceneBuffers = vi.fn();
    onModeChanged = vi.fn();

    // Initialize mode manager
    modeManager = new EditorModeManager({
      scene,
      selection,
      state,
      updateSceneBuffers,
      onModeChanged,
      canvas,
      controls,
      physicsWorld,
      characterSystem,
      groundDetectionSystem,
      characterInput,
      fpsCamera,
    });
    modeManager.initialize();
  });

  /**
   * Helper to wait for play mode to fully load and reach PLAYING state
   */
  async function waitForPlayMode(maxWaitMs = 5000): Promise<void> {
    const startTime = Date.now();
    while (modeManager.getCurrentState() !== PlayModeStateType.PLAYING) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(
          `Timeout waiting for PLAYING state. Current state: ${modeManager.getCurrentState()}`
        );
      }
      // Update state machine to process async LoadingState transitions
      (modeManager as any).settleStateMachine(0.016);
      // Small delay to allow async operations in LoadingState to complete
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  describe('WSAD Input Integration', () => {
    it('should enable character input when entering play mode', async () => {
      const enableSpy = vi.spyOn(characterInput, 'enable');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      expect(enableSpy).toHaveBeenCalled();
      expect(characterInput.isEnabled()).toBe(true);
    });

    it('should detect W key press and return forward movement', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Simulate W key press
      simulateKeyPress('KeyW', true);
      
      // Wait a bit for event to propagate
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const input = characterInput.getInput();
      expect(input.moveDirection[2]).toBeGreaterThan(0); // Forward movement
    });

    it('should detect S key press and return backward movement', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      simulateKeyPress('KeyS', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const input = characterInput.getInput();
      expect(input.moveDirection[2]).toBeLessThan(0); // Backward movement
    });

    it('should detect A key press and return left movement', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      simulateKeyPress('KeyA', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const input = characterInput.getInput();
      expect(input.moveDirection[0]).toBeLessThan(0); // Left movement
    });

    it('should detect D key press and return right movement', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      simulateKeyPress('KeyD', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const input = characterInput.getInput();
      expect(input.moveDirection[0]).toBeGreaterThan(0); // Right movement
    });

    it('should detect diagonal movement (W+D)', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      simulateKeyPress('KeyW', true);
      simulateKeyPress('KeyD', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const input = characterInput.getInput();
      expect(input.moveDirection[2]).toBeGreaterThan(0); // Forward
      expect(input.moveDirection[0]).toBeGreaterThan(0); // Right
      
      // Should be normalized
      const length = Math.sqrt(
        input.moveDirection[0] ** 2 + input.moveDirection[2] ** 2
      );
      expect(length).toBeCloseTo(1, 5);
    });

    it('should update camera directions during play mode update', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Create spy after play mode is ready
      const setCameraDirSpy = vi.spyOn(characterInput, 'setCameraDirections');
      setCameraDirSpy.mockClear(); // Clear any calls from entering play mode
      
      // Update play mode with deltaTime that will trigger fixed update
      // Use deltaTime >= fixedDeltaTime (1/60) to ensure stateMachine.update() is called
      await modeManager.updatePlayMode(0.02); // Slightly larger than 1/60
      
      expect(setCameraDirSpy).toHaveBeenCalled();
      const [forward, right] = setCameraDirSpy.mock.calls[0] as any[];
      expect(Array.isArray(forward)).toBe(true);
      expect(Array.isArray(right)).toBe(true);
      expect(forward.length).toBe(3);
      expect(right.length).toBe(3);
    });

    it('should use camera-relative movement directions', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Get camera directions
      const forward = fpsCamera.getForwardDirection();
      const right = fpsCamera.getRightDirection();
      
      // Update play mode to set camera directions
      modeManager.updatePlayMode(0.016);
      
      // Press W (forward)
      simulateKeyPress('KeyW', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const input = characterInput.getInput();
      expect(input.cameraForward).toEqual(forward);
      expect(input.cameraRight).toEqual(right);
    });

    it('should stop movement when key is released', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      simulateKeyPress('KeyW', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      let input = characterInput.getInput();
      expect(input.moveDirection[2]).toBeGreaterThan(0);
      
      simulateKeyPress('KeyW', false);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      input = characterInput.getInput();
      expect(input.moveDirection[2]).toBe(0);
    });

    it('should disable character input when exiting play mode', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      const disableSpy = vi.spyOn(characterInput, 'disable');
      
      modeManager.exitPlayMode();
      
      expect(disableSpy).toHaveBeenCalled();
      expect(characterInput.isEnabled()).toBe(false);
    });

    it('should not process input when disabled', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Disable input
      characterInput.disable();
      
      // Press keys
      simulateKeyPress('KeyW', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const input = characterInput.getInput();
      expect(input.moveDirection).toEqual([0, 0, 0]);
    });

    it('should process input after re-enabling', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Disable and press key (key state won't be registered when disabled)
      characterInput.disable();
      simulateKeyPress('KeyW', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      let input = characterInput.getInput();
      expect(input.moveDirection).toEqual([0, 0, 0]);
      
      // Re-enable and press key again (key state was cleared when disabled)
      characterInput.enable();
      simulateKeyPress('KeyW', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      input = characterInput.getInput();
      expect(input.moveDirection[2]).toBeGreaterThan(0);
    });
  });

  describe('WSAD Input Flow in Play Mode', () => {
    it('should complete full input flow: enter play → enable input → detect WSAD → exit play → disable input', async () => {
      // Enter play mode
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      expect(characterInput.isEnabled()).toBe(true);
      
      // Test all WSAD keys
      simulateKeyPress('KeyW', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      let input = characterInput.getInput();
      expect(input.moveDirection[2]).toBeGreaterThan(0);
      
      simulateKeyPress('KeyW', false);
      simulateKeyPress('KeyS', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      input = characterInput.getInput();
      expect(input.moveDirection[2]).toBeLessThan(0);
      
      simulateKeyPress('KeyS', false);
      simulateKeyPress('KeyA', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      input = characterInput.getInput();
      expect(input.moveDirection[0]).toBeLessThan(0);
      
      simulateKeyPress('KeyA', false);
      simulateKeyPress('KeyD', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      input = characterInput.getInput();
      expect(input.moveDirection[0]).toBeGreaterThan(0);
      
      // Exit play mode
      modeManager.exitPlayMode();
      
      expect(characterInput.isEnabled()).toBe(false);
    });

    it('should update camera directions each frame during play mode', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Create spy after play mode is ready and clear any previous calls
      const setCameraDirSpy = vi.spyOn(characterInput, 'setCameraDirections');
      setCameraDirSpy.mockClear(); // Clear any calls from entering play mode
      
      // Update multiple frames with deltaTime that will trigger fixed update
      // Use deltaTime >= fixedDeltaTime (1/60) to ensure stateMachine.update() is called each time
      await modeManager.updatePlayMode(0.02); // Slightly larger than 1/60
      await modeManager.updatePlayMode(0.02);
      await modeManager.updatePlayMode(0.02);
      
      // Should be called each frame
      expect(setCameraDirSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});

