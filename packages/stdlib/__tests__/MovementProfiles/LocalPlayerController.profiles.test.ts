import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LocalPlayerController,
  type KeyInputProvider,
} from '../../src/CharacterController/LocalPlayerController';
import { CharacterController } from '@engine/world';
import { Entity } from '@engine/world';
import { Scene } from '@engine/world';
import { ProfileSwitcher } from '../../src/MovementProfiles/ProfileSwitcher';
import { PRESET_PROFILES } from '../../src/MovementProfiles/presets';

describe('LocalPlayerController - Profile Switching Integration', () => {
  let entity: Entity;
  let controller: CharacterController;
  let scene: Scene;
  let keyProvider: KeyInputProvider;
  let inputHandler: { getInput: () => any };
  let playerController: LocalPlayerController;

  beforeEach(() => {
    scene = new Scene();
    entity = new Entity('TestPlayer');
    entity.transform.position = [0, 10, 0];
    controller = new CharacterController();
    entity.addComponent(controller);
    scene.addEntity(entity);

    // Mock input handler
    inputHandler = {
      getInput: () => ({
        moveDirection: [0, 0, 0],
        sprint: false,
        jump: false,
        cameraForward: [0, 0, -1],
        cameraRight: [1, 0, 0],
      }),
    };

    // Mock key input provider
    const pressedKeys = new Set<string>();
    keyProvider = {
      isKeyPressed: (key: string) => pressedKeys.has(key),
      wasKeyJustPressed: (key: string) => {
        // Simple mock - always returns false for "just pressed"
        return false;
      },
    };

    playerController = new LocalPlayerController({
      id: 'test-player',
      preferences: {} as any,
      inputHandler: inputHandler as any,
      cameraDirector: {} as any,
      fpsCamera: null,
      characterSystem: null,
      keyInputProvider: keyProvider,
      enableProfileSwitching: true,
    });
  });

  describe('Profile Switching Setup', () => {
    it('should create profile switcher when keyInputProvider is provided', () => {
      const switcher = playerController.getProfileSwitcher();
      expect(switcher).not.toBeNull();
      expect(switcher?.getProfileCount()).toBe(4);
    });

    it('should not create profile switcher when keyInputProvider is not provided', () => {
      const controllerWithoutKeys = new LocalPlayerController({
        id: 'test',
        preferences: {} as any,
        inputHandler: inputHandler as any,
        cameraDirector: {} as any,
        fpsCamera: null,
        characterSystem: null,
      });

      expect(controllerWithoutKeys.getProfileSwitcher()).toBeNull();
    });

    it('should allow setting custom profile switcher', () => {
      const customSwitcher = new ProfileSwitcher([
        PRESET_PROFILES.HUMAN,
        PRESET_PROFILES.VEHICLE_MODE,
      ]);

      playerController.setProfileSwitcher(customSwitcher);

      expect(playerController.getProfileSwitcher()).toBe(customSwitcher);
      expect(playerController.getProfileSwitcher()?.getProfileCount()).toBe(2);
    });
  });

  describe('Profile Switching via Keys', () => {
    beforeEach(() => {
      playerController.possess(entity);
    });

    it('should switch to HUMAN profile when F1 is pressed', () => {
      // Mock key press
      const pressedKeys = new Set<string>(['F1']);
      const mockKeyProvider: KeyInputProvider = {
        isKeyPressed: (key: string) => pressedKeys.has(key),
      };

      const controllerWithMock = new LocalPlayerController({
        id: 'test',
        preferences: {} as any,
        inputHandler: inputHandler as any,
        cameraDirector: {} as any,
        fpsCamera: null,
        characterSystem: null,
        keyInputProvider: mockKeyProvider,
      });

      controllerWithMock.possess(entity);

      // First update - F1 pressed
      controllerWithMock.update(0.016);

      expect(controller.getCurrentProfile()?.id).toBe('human');

      // Release F1
      pressedKeys.clear();
      controllerWithMock.update(0.016);

      // Press F1 again - should switch again
      pressedKeys.add('F1');
      controllerWithMock.update(0.016);

      // Should still be human (applied again)
      expect(controller.getCurrentProfile()?.id).toBe('human');
    });

    it('should switch to FLYING_HUMAN profile when F3 is pressed', () => {
      const pressedKeys = new Set<string>(['F3']);
      const mockKeyProvider: KeyInputProvider = {
        isKeyPressed: (key: string) => pressedKeys.has(key),
      };

      const controllerWithMock = new LocalPlayerController({
        id: 'test',
        preferences: {} as any,
        inputHandler: inputHandler as any,
        cameraDirector: {} as any,
        fpsCamera: null,
        characterSystem: null,
        keyInputProvider: mockKeyProvider,
      });

      controllerWithMock.possess(entity);
      controllerWithMock.update(0.016);

      expect(controller.getCurrentProfile()?.id).toBe('flying-human');
    });

    it('should cycle profiles when Tab is pressed', () => {
      const pressedKeys = new Set<string>();
      let tabPressed = false;

      const mockKeyProvider: KeyInputProvider = {
        isKeyPressed: (key: string) => {
          if (key === 'Tab') return tabPressed;
          return pressedKeys.has(key);
        },
      };

      const controllerWithMock = new LocalPlayerController({
        id: 'test',
        preferences: {} as any,
        inputHandler: inputHandler as any,
        cameraDirector: {} as any,
        fpsCamera: null,
        characterSystem: null,
        keyInputProvider: mockKeyProvider,
      });

      controllerWithMock.possess(entity);

      // Press Tab - should switch to next (FAST_HUMAN)
      tabPressed = true;
      controllerWithMock.update(0.016);
      expect(controller.getCurrentProfile()?.id).toBe('fast-human');

      // Release and press Tab again - should switch to FLYING_HUMAN
      tabPressed = false;
      controllerWithMock.update(0.016);
      tabPressed = true;
      controllerWithMock.update(0.016);
      expect(controller.getCurrentProfile()?.id).toBe('flying-human');
    });
  });

  describe('Profile Application', () => {
    beforeEach(() => {
      playerController.possess(entity);
    });

    it('should apply profile config when switched', () => {
      const pressedKeys = new Set<string>(['F2']);
      const mockKeyProvider: KeyInputProvider = {
        isKeyPressed: (key: string) => pressedKeys.has(key),
      };

      const controllerWithMock = new LocalPlayerController({
        id: 'test',
        preferences: {} as any,
        inputHandler: inputHandler as any,
        cameraDirector: {} as any,
        fpsCamera: null,
        characterSystem: null,
        keyInputProvider: mockKeyProvider,
      });

      controllerWithMock.possess(entity);

      const originalSpeed = controller.config.moveSpeed;
      controllerWithMock.update(0.016);

      // FAST_HUMAN has moveSpeed = 7.0
      expect(controller.config.moveSpeed).toBe(7.0);
      expect(controller.config.moveSpeed).not.toBe(originalSpeed);
    });

    it('should apply profile extensions when switched', () => {
      const pressedKeys = new Set<string>(['F3']);
      const mockKeyProvider: KeyInputProvider = {
        isKeyPressed: (key: string) => pressedKeys.has(key),
      };

      const controllerWithMock = new LocalPlayerController({
        id: 'test',
        preferences: {} as any,
        inputHandler: inputHandler as any,
        cameraDirector: {} as any,
        fpsCamera: null,
        characterSystem: null,
        keyInputProvider: mockKeyProvider,
      });

      controllerWithMock.possess(entity);
      controllerWithMock.update(0.016);

      // FLYING_HUMAN has FlyingExtension which modifies gravity
      expect(controller.getCurrentProfile()?.id).toBe('flying-human');
      // Extension should modify config (gravity reduced)
      expect(controller.config.gravityMultiplier).toBeCloseTo(0.05);
    });
  });
});
