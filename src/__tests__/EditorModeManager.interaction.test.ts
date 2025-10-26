import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorModeManager } from '../editor/managers/EditorModeManager';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { EditorState } from '../editor/core/state';
import { SelectionManager } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import { CharacterInputHandler } from '@engine/input';
import { FPSCamera } from '../editor/camera/FPSCamera';
import { CharacterControllerSystem } from '@engine/stdlib/CharacterController';
import { PhysicsWorld } from '@engine/world/physics';
import { PlayModeStateType } from '../editor/core/PlayModeStateMachine';
import { ReturnState } from '../editor/states/ReturnState';
import type { ReturnStateDeps } from '../editor/states';
import type { PlayModeContext } from '../editor/core/PlayModeStateMachine';

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

describe('EditorModeManager – regresyjne scenariusze', () => {
  let scene: Scene;
  let state: EditorState;
  let selection: SelectionManager;
  let canvas: HTMLCanvasElement;
  let controls: OrbitControls;
  let physicsWorld: PhysicsWorld;
  let characterSystem: CharacterControllerSystem;
  let characterInput: CharacterInputHandler;
  let fpsCamera: FPSCamera;
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

    physicsWorld = new PhysicsWorld(scene);
    characterSystem = new CharacterControllerSystem(scene, physicsWorld);
    characterInput = new CharacterInputHandler();
    fpsCamera = new FPSCamera(canvas);

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
      fpsCamera,
      getRendererReady: () => true,
    });

    dispose = modeManager.initialize();
  });

  afterEach(() => {
    dispose?.();
    vi.restoreAllMocks();
  });

  it('po pauzie wznowienie przywraca stan PLAYING bez rekurencji', () => {
    modeManager.enterPlayMode();

    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PLAYING);

    modeManager.pausePlayMode();
    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PAUSED);

    expect(() => modeManager.resumePlayMode()).not.toThrow();
    expect(modeManager.getCurrentState()).toBe(PlayModeStateType.PLAYING);
    expect(modeManager.getCurrentMode()).toBe('play');
  });

  it('wyjście z pauzy wraca do trybu edycji bez błędów', () => {
    const testEntity = new Entity('SelectionTarget');
    scene.addEntity(testEntity);
    selection.select(testEntity);

    modeManager.enterPlayMode();
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
      ...overrides,
    } satisfies ReturnStateDeps;
  };

  it('nie wykonuje pop gdy gameplay context nie był aktywny', () => {
    const deps = createDeps({ shouldPopGameplayContext: () => false });
    const state = new ReturnState(deps);

    expect(() => state.onEnter(createContext())).not.toThrow();

    expect(deps.inputContext.pop).not.toHaveBeenCalled();
    expect(deps.markGameplayContextInactive).not.toHaveBeenCalled();
  });

  it('usuwa gameplay context tylko raz gdy jest aktywny', () => {
    const deps = createDeps({ shouldPopGameplayContext: () => true });
    const state = new ReturnState(deps);

    state.onEnter(createContext());

    expect(deps.inputContext.pop).toHaveBeenCalledTimes(1);
    expect(deps.markGameplayContextInactive).toHaveBeenCalledTimes(1);
  });
});


