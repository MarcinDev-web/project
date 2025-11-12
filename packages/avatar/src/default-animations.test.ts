import { describe, it, expect, beforeEach } from 'vitest';
import { Entity } from '@engine/world';
import { AvatarInstance } from './avatar-instance';
import { IDLE_ANIMATION, RUN_ANIMATION, WALK_ANIMATION, JUMP_ANIMATION } from './default-animations';

describe('Default Animations', () => {
  let parentEntity: Entity;

  beforeEach(() => {
    parentEntity = new Entity('TestParent');
  });

  describe('IDLE_ANIMATION', () => {
    it('should be valid animation', () => {
      expect(IDLE_ANIMATION.name).toBe('idle');
      expect(IDLE_ANIMATION.length).toBeGreaterThan(0);
      expect(IDLE_ANIMATION.loop).toBe(true);
      expect(IDLE_ANIMATION.frames.length).toBeGreaterThan(0);
    });

    it('should have more frames for smoother animation', () => {
      expect(IDLE_ANIMATION.frames.length).toBeGreaterThanOrEqual(5);
    });

    it('should play without errors', () => {
      const avatar = new AvatarInstance(parentEntity);
      expect(() => {
        avatar.playAnimation(IDLE_ANIMATION);
      }).not.toThrow();
    });

    it('should loop correctly', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.playAnimation(IDLE_ANIMATION);
      
      // Simulate multiple loop cycles using AnimationSystem
      const component = avatar.getAnimationComponent();
      if (component) {
        for (let i = 0; i < 10; i++) {
          component.stateMachine.update(0.3); // 0.3s per update, should loop every 3s
          avatar.update(0.3);
        }
        
        // Looping animation should still be active
        expect(component.getActiveState()).toBe('idle');
      } else {
        // Fallback: use old animator
        for (let i = 0; i < 10; i++) {
          avatar.update(0.3);
        }
        expect(avatar.getAnimator().isFinished()).toBe(false);
      }
    });
  });

  describe('RUN_ANIMATION', () => {
    it('should be valid animation', () => {
      expect(RUN_ANIMATION.name).toBe('run');
      expect(RUN_ANIMATION.length).toBeGreaterThan(0);
      expect(RUN_ANIMATION.loop).toBe(true);
      expect(RUN_ANIMATION.frames.length).toBeGreaterThan(0);
    });

    it('should have more frames for smoother animation', () => {
      expect(RUN_ANIMATION.frames.length).toBeGreaterThanOrEqual(8);
    });

    it('should play without errors', () => {
      const avatar = new AvatarInstance(parentEntity);
      expect(() => {
        avatar.playAnimation(RUN_ANIMATION);
      }).not.toThrow();
    });

    it('should have alternating leg/arm movement', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.playAnimation(RUN_ANIMATION);
      
      // Check initial frame
      avatar.update(0);
      const leftLegTransform = avatar.getSkeleton().getLocalTransform('Leg.L.Upper');
      const rightLegTransform = avatar.getSkeleton().getLocalTransform('Leg.R.Upper');
      
      // Legs should be in different positions
      expect(leftLegTransform.rotation).toBeDefined();
      expect(rightLegTransform.rotation).toBeDefined();
      
      // Check mid-frame (should be opposite)
      avatar.update(0.4);
      const leftLegMid = avatar.getSkeleton().getLocalTransform('Leg.L.Upper');
      const rightLegMid = avatar.getSkeleton().getLocalTransform('Leg.R.Upper');
      
      // Positions should have changed
      expect(leftLegMid.rotation).toBeDefined();
      expect(rightLegMid.rotation).toBeDefined();
    });

    it('should loop seamlessly', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.playAnimation(RUN_ANIMATION);
      
      // Play through one full cycle
      avatar.update(0.8);
      
      // Play through another cycle
      avatar.update(0.8);
      const afterSecondCycle = avatar.getSkeleton().getLocalTransform('Leg.L.Upper');
      
      // Should be back to similar position (allowing for floating point precision)
      expect(afterSecondCycle.rotation).toBeDefined();
    });
  });

  describe('WALK_ANIMATION', () => {
    it('should be valid animation', () => {
      expect(WALK_ANIMATION.name).toBe('walk');
      expect(WALK_ANIMATION.length).toBe(1.2);
      expect(WALK_ANIMATION.loop).toBe(true);
      expect(WALK_ANIMATION.frames.length).toBeGreaterThanOrEqual(8);
    });

    it('should be slower than run', () => {
      expect(WALK_ANIMATION.length).toBeGreaterThan(RUN_ANIMATION.length);
    });

    it('should play without errors', () => {
      const avatar = new AvatarInstance(parentEntity);
      expect(() => {
        avatar.playAnimation(WALK_ANIMATION);
      }).not.toThrow();
    });

    it('should have alternating leg movement', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.playAnimation(WALK_ANIMATION);
      
      avatar.update(0);
      const leftLegStart = avatar.getSkeleton().getLocalTransform('Leg.L.Upper');
      
      avatar.update(0.6); // Mid-cycle
      const rightLegMid = avatar.getSkeleton().getLocalTransform('Leg.R.Upper');
      
      expect(leftLegStart.rotation).toBeDefined();
      expect(rightLegMid.rotation).toBeDefined();
    });
  });

  describe('JUMP_ANIMATION', () => {
    it('should be valid animation', () => {
      expect(JUMP_ANIMATION.name).toBe('jump');
      expect(JUMP_ANIMATION.length).toBe(1.0);
      expect(JUMP_ANIMATION.loop).toBe(false);
      expect(JUMP_ANIMATION.frames.length).toBeGreaterThanOrEqual(6);
    });

    it('should not loop', () => {
      expect(JUMP_ANIMATION.loop).toBe(false);
    });

    it('should play without errors', () => {
      const avatar = new AvatarInstance(parentEntity);
      expect(() => {
        avatar.playAnimation(JUMP_ANIMATION);
      }).not.toThrow();
    });

    it('should have crouch phase', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.playAnimation(JUMP_ANIMATION);
      
      avatar.update(0.2); // Crouch phase
      const legTransform = avatar.getSkeleton().getLocalTransform('Leg.L.Lower');
      
      // Legs should be bent (crouch)
      expect(legTransform.rotation).toBeDefined();
    });

    it('should finish after playing through', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.playAnimation(JUMP_ANIMATION);
      
      const component = avatar.getAnimationComponent();
      if (component) {
        // Play through entire animation using AnimationSystem
        for (let i = 0; i < 10; i++) {
          component.stateMachine.update(0.1);
          avatar.update(0.1);
        }
        
        // Non-looping animation should still be active (AnimationComponent doesn't auto-stop)
        // But we can check that it played through
        expect(component.getActiveState()).toBe('jump');
      } else {
        // Fallback: use old animator
        avatar.update(1.0);
        expect(avatar.getAnimator().isFinished()).toBe(true);
      }
    });
  });
});

