import { describe, it, expect, beforeEach } from 'vitest';
import { Entity, Scene, CharacterController, CharacterState } from '@engine/world';
import { PhysicsWorld } from '@engine/world/physics';
import {
  CharacterControllerSystem,
  GroundDetectionSystem,
} from '@engine/stdlib/CharacterController';
import { AnimationComponent, AnimationClip } from '@engine/stdlib/Animation';

describe('CharacterControllerSystem - Animation Synchronization', () => {
  let scene: Scene;
  let physics: PhysicsWorld;
  let groundDetectionSystem: GroundDetectionSystem;
  let system: CharacterControllerSystem;
  let entity: Entity;
  let controller: CharacterController;
  let animation: AnimationComponent;

  beforeEach(() => {
    scene = new Scene();
    physics = new PhysicsWorld(scene);
    groundDetectionSystem = new GroundDetectionSystem(scene, physics);
    system = new CharacterControllerSystem(scene, physics);

    entity = new Entity('Player');
    entity.transform.position = [0, 10, 0];

    controller = new CharacterController();
    entity.addComponent(controller);

    animation = new AnimationComponent();
    entity.addComponent(animation);

    scene.addEntity(entity);
  });

  describe('Running animation', () => {
    it('should switch to "run" animation when character state is Running', () => {
      // Create and add run animation clip
      const runClip = new AnimationClip({ name: 'run', duration: 1.0 });
      animation.addClip(runClip);

      // Set character to running state
      controller.isGrounded = true;
      controller.state = CharacterState.Running;

      // Update ground detection first, then system (triggers animation sync)
      groundDetectionSystem.update(1 / 60);
      system.update(1 / 60);

      // Verify animation state switched to "run"
      expect(animation.getActiveState()).toBe('run');
    });

    it('should transition from walk to run when sprinting starts', () => {
      // Create animation clips
      const walkClip = new AnimationClip({ name: 'walk', duration: 1.0 });
      const runClip = new AnimationClip({ name: 'run', duration: 1.0 });
      animation.addClip(walkClip);
      animation.addClip(runClip);

      // Start walking - set state directly and sync animation
      controller.isGrounded = true;
      (controller as any).state = CharacterState.Walking;
      system.syncAnimation(controller);

      // First clip added becomes default state, so walk should be active
      const initialState = animation.getActiveState();
      expect(initialState).toBe('walk');

      // Start sprinting - change state and sync animation
      (controller as any).state = CharacterState.Running;
      system.syncAnimation(controller);

      // Animation should start transitioning (blending) to run
      // After blend completes, update to finalize transition
      animation.stateMachine.update(0.5); // Advance blend

      // Should be blending or have switched to run animation
      const samples = animation.stateMachine.getSamples();
      // Either blending (secondary is run) or finished (current is run)
      const isBlendingToRun = samples.secondary !== null;
      const currentIsRun = animation.getActiveState() === 'run';
      expect(isBlendingToRun || currentIsRun).toBe(true);
    });

    it('should not change animation if run clip does not exist', () => {
      // Only add walk clip, no run clip
      const walkClip = new AnimationClip({ name: 'walk', duration: 1.0 });
      animation.addClip(walkClip);
      animation.setActiveState('walk');

      // Set character to running state
      controller.isGrounded = true;
      controller.state = CharacterState.Running;

      // Update ground detection first, then system
      groundDetectionSystem.update(1 / 60);
      system.update(1 / 60);

      // Animation should remain as walk (silent failure when clip missing)
      expect(animation.getActiveState()).toBe('walk');
    });
  });

  describe('All animation states', () => {
    it('should map all CharacterState values to correct animations', () => {
      // Create all animation clips
      const clips = [
        new AnimationClip({ name: 'idle', duration: 1.0 }),
        new AnimationClip({ name: 'walk', duration: 1.0 }),
        new AnimationClip({ name: 'run', duration: 1.0 }),
        new AnimationClip({ name: 'jump', duration: 1.0 }),
        new AnimationClip({ name: 'fall', duration: 1.0 }),
        new AnimationClip({ name: 'land', duration: 1.0 }),
      ];

      for (const clip of clips) {
        animation.addClip(clip);
      }

      // First clip added ('idle') becomes the default state
      expect(animation.getActiveState()).toBe('idle');

      // Test state to animation mapping by checking that syncAnimation triggers state change
      // Note: Due to blending, we verify the target state by completing the blend
      const testCases = [
        { state: CharacterState.Walking, expectedAnimation: 'walk' },
        { state: CharacterState.Running, expectedAnimation: 'run' },
        { state: CharacterState.Jumping, expectedAnimation: 'jump' },
        { state: CharacterState.Falling, expectedAnimation: 'fall' },
        { state: CharacterState.Landing, expectedAnimation: 'land' },
        { state: CharacterState.Idle, expectedAnimation: 'idle' },
      ];

      for (const testCase of testCases) {
        controller.isGrounded =
          testCase.state !== CharacterState.Jumping && testCase.state !== CharacterState.Falling;
        (controller as any).state = testCase.state;
        system.syncAnimation(controller);

        // Complete any pending blend transition
        animation.stateMachine.update(1.0);

        expect(animation.getActiveState()).toBe(testCase.expectedAnimation);
      }
    });

    it('should not update animation if state has not changed', () => {
      const runClip = new AnimationClip({ name: 'run', duration: 1.0 });
      animation.addClip(runClip);

      controller.isGrounded = true;
      controller.state = CharacterState.Running;

      // First update - should set animation
      groundDetectionSystem.update(1 / 60);
      system.update(1 / 60);
      expect(animation.getActiveState()).toBe('run');

      // Second update with same state - should not change
      const previousState = animation.getActiveState();
      groundDetectionSystem.update(1 / 60);
      system.update(1 / 60);
      expect(animation.getActiveState()).toBe(previousState);
    });

    it('should handle entity without AnimationComponent gracefully', () => {
      // Remove animation component
      entity.removeComponent(AnimationComponent);

      // Set character to running state
      controller.isGrounded = true;
      controller.state = CharacterState.Running;

      // Should not throw error
      expect(() => {
        groundDetectionSystem.update(1 / 60);
        system.update(1 / 60);
      }).not.toThrow();
    });
  });
});
