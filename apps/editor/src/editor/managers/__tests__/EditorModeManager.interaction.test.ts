import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorModeManager } from '../EditorModeManager';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { EditorState } from '../../core/state';
import { SelectionManager } from '@engine/world';
import type { OrbitControls, EditorCameraController } from '@engine/camera';
import { CharacterInputHandler } from '@engine/input';
// FPSCamera not used in editor - only in play mode
import { CharacterControllerSystem } from '@engine/stdlib/CharacterController';
import { PhysicsWorld } from '@engine/world/physics';
import { PlayModeStateType } from '../../core/PlayModeStateMachine';
import { ReturnState } from '../../states/ReturnState';
import type { ReturnStateDeps } from '../../states';
import type { PlayModeContext } from '../../core/PlayModeStateMachine';

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
  let enabled = true;

  return {
    getState: () => ({ ...state }),
    setState: (s) => {
      state = { ...state, ...s };
    },
    setPreset: (s) => {
      state = { ...state, ...s };
    },
    setEnabled: (e) => {
      enabled = e;
    },
    cleanup: () => {
      state = { yaw: 0, pitch: 0, distance: 5 };
      enabled = true;
    },
  } as OrbitControls;
}

function createMockEditorCamera(): EditorCameraController {
  let enabled = false;
  let position: [number, number, number] = [0, 2, 5];
  let yaw = 0;
  let pitch = 0;
  const view = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);

  return {
    enable: vi.fn(() => {
      enabled = true;
    }),
    disable: vi.fn(() => {
      enabled = false;
    }),
    dispose: vi.fn(),
    update: vi.fn(),
    isEnabled: () => enabled,
    getViewMatrix: () => view,
    getPosition: () => [...position],
    setPosition: (pos: [number, number, number]) => {
      position = [...pos];
    },
    getOrientation: () => ({ yaw, pitch }),
    setOrientation: (newYaw: number, newPitch: number) => {
      yaw = newYaw;
      pitch = newPitch;
    },
    getMoveSpeed: () => 5,
    setMoveSpeed: vi.fn(),
  } as unknown as EditorCameraController;
}

describe('EditorModeManager – regresyjne scenariusze', () => {
  let scene: Scene;
  let state: EditorState;
  let selection: SelectionManager;
  let canvas: HTMLCanvasElement;
  let controls: OrbitControls;
  let editorCamera: EditorCameraController;
  let physicsWorld: PhysicsWorld;
  let characterSystem: CharacterControllerSystem;
  let characterInput: CharacterInputHandler;
  let modeManager: EditorModeManager;
  let dispose: (() => void) | null;

  beforeEach(() => {
    document.body.innerHTML = '';

    scene = new Scene('Regression Scene');
    const ground = new Entity('Ground');
    ground.transform.position = [0, -1, 0];
    scene.addEntity(ground);

    state = new EditorState(scene);
    selection = new SelectionManager();
    selection.setScene(scene);

    canvas = createMockCanvas();
    controls = createMockControls();
    editorCamera = createMockEditorCamera();

    physicsWorld = new PhysicsWorld(scene);
    characterSystem = new CharacterControllerSystem(scene, physicsWorld);
    characterInput = new CharacterInputHandler();
    // FPS camera not used in editor - only in play mode

    dispose = null;

    const updateSceneBuffers = vi.fn();
    const onModeChanged = vi.fn();

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
      characterInput,
      fpsCamera: null, // Not used in editor - only in play mode
      editorCamera,
      getRendererReady: () => true,
    });

    dispose = modeManager.initialize();
  });

  afterEach(() => {
    dispose?.();
    vi.restoreAllMocks();
  });

  /**
   * Helper to wait for play mode to fully load and reach PLAYING state
   * This handles async LoadingState operations
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

  it('does not create preview avatar in editor (avatar only used in play mode)', () => {
    // Avatar is not created in editor - only collaborator avatars are visible in collaboration mode
    const preview = scene.findEntityById('__editor_preview_player');
    expect(preview).toBeFalsy(); // Avatar should not exist in editor
  });

  it('disables character input in editor (only free-fly camera available)', () => {
    // In editor, only free-fly camera is available
    modeManager.setEditCameraInputMode('free-fly');
    expect(characterInput.isEnabled()).toBe(false);
    
    // FPS and third-person modes are not available in editor
    modeManager.setEditCameraInputMode('fps');
    expect(characterInput.isEnabled()).toBe(false); // Should still be disabled
    
    modeManager.setEditCameraInputMode('third-person');
    expect(characterInput.isEnabled()).toBe(false); // Should still be disabled
  });

  it('po pauzie wznowienie przywraca stan PLAYING bez rekurencji', async () => {
    modeManager.enterPlayMode();
    await waitForPlayMode();

    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PLAYING);

    modeManager.pausePlayMode();
    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PAUSED);

    expect(() => modeManager.resumePlayMode()).not.toThrow();
    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PLAYING);
    expect(modeManager.getCurrentMode()).toBe('play');
  });

  it('wyjście z pauzy wraca do trybu edycji bez błędów', async () => {
    const testEntity = new Entity('SelectionTarget');
    scene.addEntity(testEntity);
    selection.select(testEntity);

    modeManager.enterPlayMode();
    await waitForPlayMode();
    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PLAYING);

    modeManager.pausePlayMode();
    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PAUSED);

    expect(() => modeManager.exitPlayMode()).not.toThrow();
    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.EDIT);
    expect(modeManager.getCurrentMode()).toBe('edit');
    expect(selection.primarySelection?.id).toBe(testEntity.id);
  });

  it('aktualizacja w trybie gry wykonuje stałą liczbę kroków symulacji', async () => {
    modeManager.enterPlayMode();
    await waitForPlayMode();
    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PLAYING);

    const physicsSpy = vi.spyOn(physicsWorld, 'update');
    const characterSpy = vi.spyOn(characterSystem, 'update');

    const session = modeManager.getPlayerSession();
    expect(session).toBeTruthy();
    const sessionSpy = session ? vi.spyOn(session, 'update') : null;

    const deltaTime = 0.05; // ~3 kroków 1/60 przy domyślnych ustawieniach
    await modeManager.updatePlayMode(deltaTime);

    const expectedSteps = Math.min(Math.floor(deltaTime / (1 / 60)), 4);

    expect(physicsSpy).toHaveBeenCalledTimes(expectedSteps);
    expect(characterSpy).toHaveBeenCalledTimes(expectedSteps);
    if (sessionSpy) {
      expect(sessionSpy).toHaveBeenCalledTimes(expectedSteps);
    }
  });
});

describe('ReturnState – zarządzanie kontekstem wejścia', () => {
  const createContext = (): PlayModeContext => ({
    authoringSnapshot: null,
    selectionPath: null,
    manifest: null,
    errors: [],
    warnings: [],
    data: new Map(),
  });

  const createDeps = (overrides: Partial<ReturnStateDeps> = {}): ReturnStateDeps => {
    const inputContext = {
      pop: vi.fn(),
      releasePointerLock: vi.fn(),
    } as unknown as ReturnStateDeps['inputContext'];

    return {
      worldManager: {
        clearRuntimeWorld: vi.fn(),
        restoreAuthoring: vi.fn(),
        clearSnapshot: vi.fn(),
      } as unknown as ReturnStateDeps['worldManager'],
      inputContext,
      cameraDirector: {
        setMode: vi.fn(),
      } as unknown as ReturnStateDeps['cameraDirector'],
      shouldPopGameplayContext: () => false,
      markGameplayContextInactive: vi.fn(),
      stopPhysics: vi.fn(),
      disableScripts: vi.fn(),
      disableCharacterInput: vi.fn(),
      disableFPSCamera: vi.fn(),
      unbindPlayerController: vi.fn(),
      cleanupPlayer: vi.fn(),
      updateSceneBuffers: vi.fn(),
      showEditorUI: vi.fn(),
      restoreEditorCamera: vi.fn(),
      ...overrides,
    } satisfies ReturnStateDeps;
  };

  it('nie wykonuje pop gdy gameplay context nie był aktywny', () => {
    const deps = createDeps({ shouldPopGameplayContext: () => false });
    const state = new ReturnState(deps);

    expect(() => state.onEnter(createContext())).not.toThrow();

    expect(deps.inputContext.pop).not.toHaveBeenCalled();
    expect(deps.markGameplayContextInactive).not.toHaveBeenCalled();
    expect(deps.cameraDirector.setMode).toHaveBeenCalledWith('free-fly');
    expect(deps.restoreEditorCamera).toHaveBeenCalled();
  });

  it('usuwa gameplay context tylko raz gdy jest aktywny', () => {
    const deps = createDeps({ shouldPopGameplayContext: () => true });
    const state = new ReturnState(deps);

    state.onEnter(createContext());

    expect(deps.inputContext.pop).toHaveBeenCalledTimes(1);
    expect(deps.markGameplayContextInactive).toHaveBeenCalledTimes(1);
    expect(deps.cameraDirector.setMode).toHaveBeenCalledWith('free-fly');
    expect(deps.restoreEditorCamera).toHaveBeenCalled();
  });
});




