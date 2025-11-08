import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scene } from '../core/Scene.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { InteractableComponent } from '../components/InteractableComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { MaterialComponent } from '../components/MaterialComponent.js';
import { Entity } from '../core/Entity.js';

describe('InteractionSystem', () => {
  let scene: Scene;
  let interactionSystem: InteractionSystem;
  let cameraEntity: Entity;
  let interactableEntity: Entity;

  beforeEach(() => {
    scene = new Scene('test-scene');
    interactionSystem = new InteractionSystem(scene);

    // Create camera
    cameraEntity = scene.createEntity('camera');
    const cameraComp = new CameraComponent();
    cameraComp.primary = true;
    cameraEntity.addComponent(cameraComp);
    cameraEntity.transform.position = [0, 0, 0];
    cameraEntity.transform.rotation = [0, 0, 0, 1];
    scene.addEntity(cameraEntity);
    scene.setPrimaryCamera(cameraEntity);

    // Create interactable entity
    interactableEntity = scene.createEntity('interactable');
    const interactable = new InteractableComponent();
    interactable.interactionRange = 5.0;
    interactable.promptText = 'Press E to open';
    interactableEntity.addComponent(interactable);
    // Add material component for highlight testing
    const material = new MaterialComponent();
    interactableEntity.addComponent(material);
    interactableEntity.transform.position = [0, 0, -3]; // In front of camera
    interactableEntity.meshBounds = {
      type: 'aabb',
      aabb: {
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
    };
    scene.addEntity(interactableEntity);
  });

  afterEach(() => {
    interactionSystem.dispose();
  });

  describe('update', () => {
    it('should detect interactable entity in range', () => {
      interactionSystem.update(0.016);
      const detected = interactionSystem.getCurrentInteractable();
      expect(detected).toBe(interactableEntity);
    });

    it('should not detect entity out of range', () => {
      interactableEntity.transform.position = [0, 0, -11]; // Too far
      interactionSystem.update(0.016);
      const detected = interactionSystem.getCurrentInteractable();
      expect(detected).toBeNull();
    });

    it('should not detect disabled entity', () => {
      const interactable = interactableEntity.getComponent(InteractableComponent)!;
      interactable.enabled = false;
      interactionSystem.update(0.016);
      const detected = interactionSystem.getCurrentInteractable();
      expect(detected).toBeNull();
    });

    it('should update cooldowns', () => {
      const interactable = interactableEntity.getComponent(InteractableComponent)!;
      interactable.cooldownRemaining = 1.0;
      interactionSystem.update(0.5);
      expect(interactable.cooldownRemaining).toBe(0.5);
    });

    it('should handle camera fallback when primary set to null', () => {
      scene.setPrimaryCamera(null);
      expect(() => interactionSystem.update(0.016)).not.toThrow();
      // Scene ensures a fallback primary camera exists
      expect(interactionSystem.getCurrentInteractable()).toBe(interactableEntity);
    });
  });

  describe('interaction handling', () => {
    it('should trigger interaction on E key press', () => {
      const eventSpy = vi.fn();
      scene.events.on('logic:signal', eventSpy);
      scene.events.on('interaction:triggered', eventSpy);

      // First update to detect entity
      interactionSystem.update(0.016);
      expect(interactionSystem.getCurrentInteractable()).toBe(interactableEntity);

      // Simulate E key press
      const keyEvent = new KeyboardEvent('keydown', { code: 'KeyE' });
      window.dispatchEvent(keyEvent);

      // Check that events were emitted
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should not trigger interaction if entity not detected', () => {
      const eventSpy = vi.fn();
      scene.events.on('logic:signal', eventSpy);

      interactableEntity.transform.position = [0, 0, -11]; // Out of range
      interactionSystem.update(0.016);

      const keyEvent = new KeyboardEvent('keydown', { code: 'KeyE' });
      window.dispatchEvent(keyEvent);

      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should not trigger interaction if on cooldown', () => {
      const interactable = interactableEntity.getComponent(InteractableComponent)!;
      interactable.cooldownRemaining = 1.0;

      interactionSystem.update(0.016);
      const eventSpy = vi.fn();
      scene.events.on('logic:signal', eventSpy);

      const keyEvent = new KeyboardEvent('keydown', { code: 'KeyE' });
      window.dispatchEvent(keyEvent);

      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should start cooldown after interaction', () => {
      const interactable = interactableEntity.getComponent(InteractableComponent)!;
      interactable.cooldown = 2.0;

      interactionSystem.update(0.016);
      const keyEvent = new KeyboardEvent('keydown', { code: 'KeyE' });
      window.dispatchEvent(keyEvent);

      expect(interactable.cooldownRemaining).toBe(2.0);
    });
  });

  describe('triggerInteraction', () => {
    it('should manually trigger interaction', () => {
      const eventSpy = vi.fn();
      scene.events.on('logic:signal', eventSpy);
      scene.events.on('interaction:triggered', eventSpy);

      const result = interactionSystem.triggerInteraction(interactableEntity);
      expect(result).toBe(true);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should return false if entity not available', () => {
      const interactable = interactableEntity.getComponent(InteractableComponent)!;
      interactable.enabled = false;

      const result = interactionSystem.triggerInteraction(interactableEntity);
      expect(result).toBe(false);
    });

    it('should return false if entity on cooldown', () => {
      const interactable = interactableEntity.getComponent(InteractableComponent)!;
      interactable.cooldownRemaining = 1.0;

      const result = interactionSystem.triggerInteraction(interactableEntity);
      expect(result).toBe(false);
    });
  });

  describe('getCurrentInteractable', () => {
    it('should return currently detected interactable', () => {
      interactionSystem.update(0.016);
      expect(interactionSystem.getCurrentInteractable()).toBe(interactableEntity);
    });

    it('should return null when no interactable detected', () => {
      interactableEntity.transform.position = [0, 0, -11];
      interactionSystem.update(0.016);
      expect(interactionSystem.getCurrentInteractable()).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should cleanup event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      interactionSystem.dispose();
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('should cleanup prompt UI', () => {
      const promptUI = (interactionSystem as any).promptUI;
      const disposeSpy = vi.spyOn(promptUI, 'dispose');
      interactionSystem.dispose();
      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('highlight management', () => {
    it('should highlight entity when detected', () => {
      const material = interactableEntity.getComponent(MaterialComponent)!;
      const originalEmissive = [...material.emissiveColor];
      const originalIntensity = material.emissiveIntensity;
      // Store for potential future assertions
      void originalIntensity;

      interactionSystem.update(0.016);

      // Check that highlight was applied
      expect(material.emissiveIntensity).toBeGreaterThan(0);
      expect(material.emissiveColor).not.toEqual(originalEmissive);
    });

    it('should remove highlight when entity no longer detected', () => {
      const material = interactableEntity.getComponent(MaterialComponent)!;
      const originalEmissive = [...material.emissiveColor];
      const originalIntensity = material.emissiveIntensity;

      // Detect entity
      interactionSystem.update(0.016);
      expect(material.emissiveIntensity).toBeGreaterThan(0);

      // Move entity out of range
      interactableEntity.transform.position = [0, 0, -11];
      interactionSystem.update(0.016);

      // Check that highlight was removed
      expect(material.emissiveColor).toEqual(originalEmissive);
      expect(material.emissiveIntensity).toBe(originalIntensity);
    });

    it('should restore original emissive values on dispose', () => {
      const material = interactableEntity.getComponent(MaterialComponent)!;
      const originalEmissive = [...material.emissiveColor];
      const originalIntensity = material.emissiveIntensity;

      interactionSystem.update(0.016);
      interactionSystem.dispose();

      expect(material.emissiveColor).toEqual(originalEmissive);
      expect(material.emissiveIntensity).toBe(originalIntensity);
    });
  });

  describe('cooldown display', () => {
    it('should hide prompt when entity is on cooldown', () => {
      const interactable = interactableEntity.getComponent(InteractableComponent)!;
      interactable.cooldownRemaining = 2.5;

      interactionSystem.update(0.016);

      const promptUI = (interactionSystem as any).promptUI;
      expect(promptUI.getVisible()).toBe(false);
    });

    it('should not display cooldown styling when hidden on cooldown', () => {
      const interactable = interactableEntity.getComponent(InteractableComponent)!;
      interactable.cooldownRemaining = 1.0;

      interactionSystem.update(0.016);

      const promptUI = (interactionSystem as any).promptUI;
      const promptElement = (promptUI as any).promptElement;
      // Prompt should not be shown
      expect(promptUI.getVisible()).toBe(false);
      expect(promptElement?.style.display).not.toBe('block');
    });
  });

  describe('sphere cast detection', () => {
    it('should detect entity using sphere cast mode', () => {
      const sphereSystem = new InteractionSystem(scene, {
        detectionMode: 'sphere',
        detectionRadius: 5.0,
      });

      interactionSystem.dispose();
      interactionSystem = sphereSystem;

      interactionSystem.update(0.016);
      const detected = interactionSystem.getCurrentInteractable();
      expect(detected).toBe(interactableEntity);

      sphereSystem.dispose();
    });

    it('should prioritize closest entity in sphere cast', () => {
      const entity2 = scene.createEntity('interactable2');
      const interactable2 = new InteractableComponent();
      entity2.addComponent(interactable2);
      entity2.transform.position = [0, 0, -2]; // Closer than entity1
      scene.addEntity(entity2);

      const sphereSystem = new InteractionSystem(scene, {
        detectionMode: 'sphere',
        detectionRadius: 5.0,
      });

      interactionSystem.dispose();
      interactionSystem = sphereSystem;

      interactionSystem.update(0.016);
      const detected = interactionSystem.getCurrentInteractable();
      expect(detected).toBe(entity2); // Closer entity should be detected

      sphereSystem.dispose();
    });
  });

  describe('style configuration', () => {
    it('should apply custom prompt style', () => {
      const customStyle = {
        backgroundColor: 'rgba(255, 0, 0, 0.9)',
        textColor: '#00ff00',
        fontSize: 20,
      };

      interactionSystem.setPromptStyle(customStyle);
      const retrievedStyle = interactionSystem.getPromptStyle();
      expect(retrievedStyle.backgroundColor).toBe(customStyle.backgroundColor);
      expect(retrievedStyle.textColor).toBe(customStyle.textColor);
      expect(retrievedStyle.fontSize).toBe(customStyle.fontSize);
    });
  });

  describe('gamepad support', () => {
    it('should disable gamepad when configured', () => {
      const noGamepadSystem = new InteractionSystem(scene, {
        enableGamepad: false,
      });

      const gamepadInterval = (noGamepadSystem as any).gamepadPollInterval;
      expect(gamepadInterval).toBeNull();

      noGamepadSystem.dispose();
    });

    it('should use custom gamepad button index', () => {
      const customButtonSystem = new InteractionSystem(scene, {
        gamepadButton: 1,
      });

      const config = (customButtonSystem as any).config;
      expect(config.gamepadButton).toBe(1);

      customButtonSystem.dispose();
    });
  });
});

