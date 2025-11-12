import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorModeManager } from '../../managers/EditorModeManager';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { EditorState } from '../state';
import { SelectionManager } from '@engine/world';
import { PhysicsWorld } from '@engine/world/physics';
import { CharacterControllerSystem, GroundDetectionSystem } from '@engine/stdlib/CharacterController';
import { CharacterInputHandler } from '@engine/input';
import { FPSCamera } from '@engine/camera';
import { CharacterController } from '@engine/world';
import { PhysicsComponent } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import { createDefaultManifest } from '../PlayManifest';
import { quatToEuler } from '@engine/core/math';
import { PlayModeStateType } from '../PlayModeStateMachine';

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
    setState: (s) => { state = { ...state, ...s }; },
    setPreset: (s) => { state = { ...state, ...s }; },
    setEnabled: () => {},
    cleanup: () => {},
  } as OrbitControls;
}

describe.skip('PlayModeFPS Integration Tests', () => {
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

  describe('Player Entity Spawning', () => {
    it('should spawn player at default manifest position and yaw', async () => {
      const manifest = createDefaultManifest();
      (modeManager as any).stateMachine.getMutableContext().manifest = manifest;

      modeManager.enterPlayMode();
      await waitForPlayMode();

      const activeScene = modeManager.getActiveScene();
      const playerEntity = activeScene.getAllEntities().find(e => e.userData.isPlayModePlayer);
      expect(playerEntity).toBeDefined();
      expect(playerEntity?.transform.position).toEqual(manifest.playerStart.position);
      const yaw = quatToEuler(playerEntity!.transform.rotation)[1];
      expect(yaw).toBeCloseTo(manifest.playerStart.rotation, 1e-3);
    });

    it('should mark player entity as hidden', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      const activeScene = modeManager.getActiveScene();
      const playerEntity = activeScene.getAllEntities().find(e => e.userData.isPlayModePlayer);
      expect(playerEntity?.userData.isHidden).toBe(true);
    });

    it('should spawn player using PlayerStart yaw', async () => {
      // Create a PlayerStart with a specific yaw
      const playerStart = new Entity('PlayerStart');
      const yaw = Math.PI / 4; // 45 degrees
      playerStart.transform.setEulerAngles(0, yaw, 0);
      scene.addEntity(playerStart);

      modeManager.enterPlayMode();
      await waitForPlayMode();

      const activeScene = modeManager.getActiveScene();
      const playerEntity = activeScene.getAllEntities().find(e => e.userData.isPlayModePlayer);
      expect(playerEntity).toBeDefined();

      const spawnedYaw = quatToEuler(playerEntity!.transform.rotation)[1];
      expect(spawnedYaw).toBeCloseTo(yaw, 1e-3);
    });

    it('should add CharacterController component to player', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      const activeScene = modeManager.getActiveScene();
      const playerEntity = activeScene.getAllEntities().find(e => e.userData.isPlayModePlayer);
      const controller = playerEntity?.getComponent(CharacterController);
      
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(CharacterController);
    });

    it('should add PhysicsComponent with capsule collider to player', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      const activeScene = modeManager.getActiveScene();
      const playerEntity = activeScene.getAllEntities().find(e => e.userData.isPlayModePlayer);
      const physics = playerEntity?.getComponent(PhysicsComponent);
      
      expect(physics).toBeDefined();
      expect(physics?.colliders.length).toBeGreaterThan(0);
      expect(physics?.colliders[0]?.shape).toBe('capsule');
    });

    it('should create a player session and controller when entering play mode', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      const playerSession = (modeManager as any).playerSession;
      expect(playerSession).toBeDefined();
      const controller = playerSession.getController?.();
      expect(controller).toBeDefined();
      expect(controller?.getContext().pawn).toBeDefined();
    });

    it('should remove player entity when exiting play mode', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      const activeScene = modeManager.getActiveScene();
      expect(activeScene.getAllEntities().some(e => e.userData.isPlayModePlayer)).toBe(true);

      modeManager.exitPlayMode();

      const playerEntityAuthoring = scene.getAllEntities().find(e => e.userData.isPlayModePlayer);
      expect(playerEntityAuthoring).toBeUndefined();
    });
  });

  describe('Physics Simulation', () => {
    it('should start physics when entering play mode', () => {
      const startSpy = vi.spyOn(physicsWorld, 'start');
      
      modeManager.enterPlayMode();
      
      expect(startSpy).toHaveBeenCalledOnce();
    });

    it('should stop physics when exiting play mode', async () => {
      const stopSpy = vi.spyOn(physicsWorld, 'stop');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      stopSpy.mockClear(); // Clear any calls from enterPlayMode
      modeManager.exitPlayMode();
      
      expect(stopSpy).toHaveBeenCalledOnce();
    });

    it('should update physics during play mode with fixed timestep', async () => {
      const updateSpy = vi.spyOn(physicsWorld, 'update');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      modeManager.updatePlayMode(0.05); // larger delta to trigger multiple substeps
      
      expect(updateSpy).toHaveBeenCalledWith(1 / 60);
    });

    it('should not update physics when not in play mode', () => {
      const updateSpy = vi.spyOn(physicsWorld, 'update');
      
      modeManager.updatePlayMode(0.016);
      
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Orbit Controls Management', () => {
    it('should disable orbit controls when entering play mode', () => {
      const setEnabledSpy = vi.spyOn(controls, 'setEnabled');
      
      modeManager.enterPlayMode();
      
      expect(setEnabledSpy).toHaveBeenCalledWith(false);
    });

    it('should save orbit state before disabling', async () => {
      const initialState = controls.getState();
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      controls.setState({ yaw: 1.5, pitch: 0.5, distance: 10 }); // Change state in play
      modeManager.exitPlayMode();
      
      const finalState = controls.getState();
      expect(finalState.yaw).toBeCloseTo(initialState.yaw);
      expect(finalState.pitch).toBeCloseTo(initialState.pitch);
      expect(finalState.distance).toBeCloseTo(initialState.distance);
    });

    it('should restore orbit controls when exiting play mode', async () => {
      const setEnabledSpy = vi.spyOn(controls, 'setEnabled');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      setEnabledSpy.mockClear(); // Clear enter call
      
      modeManager.exitPlayMode();
      
      expect(setEnabledSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('FPS Camera Integration', () => {
    it('should enable FPS camera when entering play mode', () => {
      const enableSpy = vi.spyOn(fpsCamera, 'enable');
      
      modeManager.enterPlayMode();
      
      expect(enableSpy).toHaveBeenCalledOnce();
    });

    it('should disable FPS camera when exiting play mode', async () => {
      const disableSpy = vi.spyOn(fpsCamera, 'disable');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      modeManager.exitPlayMode();
      
      expect(disableSpy).toHaveBeenCalledOnce();
    });

    it('should update FPS camera each frame in play mode', async () => {
      const updateSpy = vi.spyOn(fpsCamera, 'update');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      modeManager.updatePlayMode(0.016);
      
      expect(updateSpy).toHaveBeenCalled();
    });

    it('should provide player position for FPS camera', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      const playerPos = modeManager.getPlayerPosition();
      
      expect(playerPos).toBeDefined();
      expect(Array.isArray(playerPos)).toBe(true);
      expect(playerPos?.length).toBe(3);
    });

    it('should expose FPS camera instance', () => {
      const camera = modeManager.getFPSCamera();
      
      expect(camera).toBe(fpsCamera);
    });
  });

  describe('Character Input System', () => {
    it('should enable character input when entering play mode', () => {
      const enableSpy = vi.spyOn(characterInput, 'enable');
      
      modeManager.enterPlayMode();
      
      expect(enableSpy).toHaveBeenCalledOnce();
    });

    it('should disable character input when exiting play mode', async () => {
      const disableSpy = vi.spyOn(characterInput, 'disable');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      disableSpy.mockClear(); // Clear any calls that might have happened
      modeManager.exitPlayMode();
      
      expect(disableSpy).toHaveBeenCalledOnce();
    });

    it('should update character input with camera directions', async () => {
      const setCameraDirSpy = vi.spyOn(characterInput, 'setCameraDirections');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      modeManager.updatePlayMode(0.016);
      
      expect(setCameraDirSpy).toHaveBeenCalled();
      const [forward, right] = setCameraDirSpy.mock.calls[0] as any[];
      expect(Array.isArray(forward)).toBe(true);
      expect(Array.isArray(right)).toBe(true);
    });
  });

  describe('Character Controller System', () => {
    it('should update character system during play mode with fixed timestep', async () => {
      const updateSpy = vi.spyOn(characterSystem, 'update');
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      modeManager.updatePlayMode(0.05);
      
      expect(updateSpy).toHaveBeenCalledWith(1 / 60);
    });

    it('should not update character system when not in play mode', () => {
      const updateSpy = vi.spyOn(characterSystem, 'update');
      
      modeManager.updatePlayMode(0.016);
      
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Scene Snapshot Preservation', () => {
    it('should preserve scene state when entering play mode', async () => {
      const testEntity = new Entity('TestEntity');
      testEntity.transform.position = [5, 2, 3];
      scene.addEntity(testEntity);
      selection.select(testEntity);
      
      expect(scene.entityCount).toBe(2); // Ground + test entity
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Runtime world should have cloned entities + player
      const activeScene = modeManager.getActiveScene();
      expect(activeScene.getAllEntities().some(e => e.userData.isPlayModePlayer)).toBe(true);
      
      // Authoring world should be unchanged
      expect(scene.entityCount).toBe(2); // Ground + test entity
    });

    it('should restore scene state when exiting play mode', async () => {
      const testEntity = new Entity('TestEntity');
      testEntity.transform.position = [5, 2, 3];
      scene.addEntity(testEntity);
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Modify in play mode
      testEntity.transform.position = [100, 100, 100];
      const playEntity = new Entity('PlayCreated');
      scene.addEntity(playEntity);
      
      modeManager.exitPlayMode();
      
      // Verify restoration
      const restored = scene.findEntityById(testEntity.id);
      expect(restored?.transform.position).toEqual([5, 2, 3]);
      
      const playCreated = scene.findEntitiesByName('PlayCreated');
      expect(playCreated.length).toBe(0); // Play mode entity removed
    });

    it('should restore selection after exiting play mode', async () => {
      const testEntity = new Entity('TestEntity');
      scene.addEntity(testEntity);
      selection.select(testEntity);
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      selection.clearSelection(); // Change selection in play
      
      modeManager.exitPlayMode();
      
      expect(selection.primarySelection?.id).toBe(testEntity.id);
    });

    it('should handle missing entity gracefully after restore', async () => {
      const testEntity = new Entity('TestEntity');
      scene.addEntity(testEntity);
      selection.select(testEntity);
      const originalId = testEntity.id;
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      // Simulate entity that was removed during play
      scene.removeEntity(testEntity);
      
      // Should not throw when exiting
      expect(() => modeManager.exitPlayMode()).not.toThrow();
      
      // The entity should be restored from snapshot (not null)
      expect(selection.primarySelection).not.toBeNull();
      expect(selection.primarySelection?.id).toBe(originalId);
    });
  });

  describe('Mode State Management', () => {
    it('should report correct play mode state', async () => {
      expect(modeManager.isPlayMode()).toBe(false);
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      expect(modeManager.isPlayMode()).toBe(true);
      
      modeManager.exitPlayMode();
      expect(modeManager.isPlayMode()).toBe(false);
    });

    it('should notify mode changes', () => {
      modeManager.enterPlayMode();
      expect(onModeChanged).toHaveBeenCalledWith('play');
      
      modeManager.exitPlayMode();
      expect(onModeChanged).toHaveBeenCalledWith('edit');
    });

    it('should update editor mode signal', () => {
      modeManager.enterPlayMode();
      expect(state.editorMode.value).toBe('play');
      
      modeManager.exitPlayMode();
      expect(state.editorMode.value).toBe('edit');
    });

    it('should toggle between modes correctly', () => {
      modeManager.toggleMode();
      expect(modeManager.isPlayMode()).toBe(true);
      
      modeManager.toggleMode();
      expect(modeManager.isPlayMode()).toBe(false);
    });

    it('should prevent re-entering play mode when already in play', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      const activeScene = modeManager.getActiveScene();
      const playerCount1 = activeScene.getAllEntities().filter(e => e.userData.isPlayModePlayer).length;
      
      modeManager.enterPlayMode(); // Try to enter again
      const playerCount2 = activeScene.getAllEntities().filter(e => e.userData.isPlayModePlayer).length;
      
      expect(playerCount1).toBe(playerCount2); // No duplicate player
      expect(playerCount1).toBe(1);
    });

    it('should handle force exit from play mode', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      modeManager.forceExitPlayMode();
      
      expect(modeManager.isPlayMode()).toBe(false);
      expect(state.editorMode.value).toBe('edit');
      // Player should be removed from authoring scene after exit
      expect(scene.getAllEntities().find(e => e.userData.isPlayModePlayer)).toBeUndefined();
    });
  });

  describe('History Management', () => {
    it('should disable history when entering play mode', async () => {
      expect(state.history.isFrozen()).toBe(false);
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      expect(state.history.isFrozen()).toBe(true);
    });

    it('should re-enable history when exiting play mode', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      expect(state.history.isFrozen()).toBe(true);
      
      modeManager.exitPlayMode();
      
      expect(state.history.isFrozen()).toBe(false);
    });

    it('should have snapshot when in play mode', async () => {
      expect(modeManager.hasSnapshot()).toBe(false);
      
      modeManager.enterPlayMode();
      await waitForPlayMode();
      expect(modeManager.hasSnapshot()).toBe(true);
      
      modeManager.exitPlayMode();
      expect(modeManager.hasSnapshot()).toBe(false);
    });
  });

  describe('Cleanup and Disposal', () => {
    it('should cleanup all resources on dispose', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      
      modeManager.dispose();
      
      expect(modeManager.isPlayMode()).toBe(false);
      expect(modeManager.hasSnapshot()).toBe(false);
      // After disposal, runtime world should be cleared
      expect(scene.getAllEntities().find(e => e.userData.isPlayModePlayer)).toBeUndefined();
    });

    it('should handle dispose when not in play mode', () => {
      expect(() => modeManager.dispose()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing physics world gracefully', () => {
      const managerNoPhysics = new EditorModeManager({
        scene,
        selection,
        state,
        updateSceneBuffers,
        onModeChanged,
        canvas,
        controls,
        physicsWorld: null,
        characterSystem: null,
        groundDetectionSystem: null,
        characterInput,
        fpsCamera,
      });
      managerNoPhysics.initialize();
      
      expect(() => managerNoPhysics.enterPlayMode()).not.toThrow();
      expect(() => managerNoPhysics.updatePlayMode(0.016)).not.toThrow();
      expect(() => managerNoPhysics.exitPlayMode()).not.toThrow();
    });

    it('should handle missing character system gracefully', () => {
      const managerNoCharSystem = new EditorModeManager({
        scene,
        selection,
        state,
        updateSceneBuffers,
        onModeChanged,
        canvas,
        controls,
        physicsWorld,
        characterSystem: null,
        groundDetectionSystem: null,
        characterInput,
        fpsCamera,
      });
      managerNoCharSystem.initialize();
      
      managerNoCharSystem.enterPlayMode();
      expect(() => managerNoCharSystem.updatePlayMode(0.016)).not.toThrow();
    });
  });

  describe('Player Session Management', () => {
    it('should create a player session and controller when entering play mode', async () => {
      modeManager.enterPlayMode();
      await waitForPlayMode();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const playerSession = (modeManager as any).playerSession;
      expect(playerSession).toBeDefined();
      const controller = playerSession.getController?.();
      expect(controller).toBeDefined();
      expect(controller?.getContext().pawn).toBeDefined();
    });
  });
});



