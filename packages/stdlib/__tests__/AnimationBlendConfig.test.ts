import { describe, it, expect } from 'vitest';
import { AnimationBlendConfig } from '../src/CharacterController/AnimationBlendConfig';
import { AnimationStateName } from '../src/CharacterController/AnimationStateName';

describe('AnimationBlendConfig', () => {
  describe('getBlendTime', () => {
    it('should return default blend time for unknown transitions', () => {
      const config = new AnimationBlendConfig();
      const time = config.getBlendTime('unknown', 'other');
      expect(time).toBe(0.12); // default
    });

    it('should return default blend time when from is null', () => {
      const config = new AnimationBlendConfig();
      const time = config.getBlendTime(null, AnimationStateName.Idle);
      expect(time).toBe(0.12);
    });

    it('should return configured blend time for idle->walk transition', () => {
      const config = new AnimationBlendConfig();
      const time = config.getBlendTime(AnimationStateName.Idle, AnimationStateName.Walk);
      expect(time).toBe(0.08);
    });

    it('should return configured blend time for walk->idle transition', () => {
      const config = new AnimationBlendConfig();
      const time = config.getBlendTime(AnimationStateName.Walk, AnimationStateName.Idle);
      expect(time).toBe(0.08);
    });

    it('should return configured blend time for walk->run transition', () => {
      const config = new AnimationBlendConfig();
      const time = config.getBlendTime(AnimationStateName.Walk, AnimationStateName.Run);
      expect(time).toBe(0.10);
    });

    it('should return configured blend time for fall->land transition', () => {
      const config = new AnimationBlendConfig();
      const time = config.getBlendTime(AnimationStateName.Fall, AnimationStateName.Land);
      expect(time).toBe(0.20);
    });

    it('should return custom blend time when set', () => {
      const config = new AnimationBlendConfig();
      config.setBlendTime(AnimationStateName.Idle, AnimationStateName.Jump, 0.25);
      const time = config.getBlendTime(AnimationStateName.Idle, AnimationStateName.Jump);
      expect(time).toBe(0.25);
    });

    it('should use custom default blend time', () => {
      const config = new AnimationBlendConfig({ defaultBlendTime: 0.15 });
      const time = config.getBlendTime('unknown', 'other');
      expect(time).toBe(0.15);
    });

    it('should use custom blend times from constructor options', () => {
      const config = new AnimationBlendConfig({
        customBlendTimes: {
          'idle->jump': 0.30,
        },
      });
      const time = config.getBlendTime(AnimationStateName.Idle, AnimationStateName.Jump);
      expect(time).toBe(0.30);
    });
  });

  describe('getBlendEasing', () => {
    it('should return default easing for unknown transitions', () => {
      const config = new AnimationBlendConfig();
      const easing = config.getBlendEasing('unknown', 'other');
      expect(easing).toBe('ease-in-out'); // default
    });

    it('should return default easing when from is null', () => {
      const config = new AnimationBlendConfig();
      const easing = config.getBlendEasing(null, AnimationStateName.Idle);
      expect(easing).toBe('ease-in-out');
    });

    it('should return configured easing for transitions', () => {
      const config = new AnimationBlendConfig();
      const easing = config.getBlendEasing(AnimationStateName.Idle, AnimationStateName.Walk);
      expect(easing).toBe('ease-in-out');
    });

    it('should return custom easing when set', () => {
      const config = new AnimationBlendConfig();
      config.setBlendEasing(AnimationStateName.Idle, AnimationStateName.Jump, 'ease-out');
      const easing = config.getBlendEasing(AnimationStateName.Idle, AnimationStateName.Jump);
      expect(easing).toBe('ease-out');
    });

    it('should use custom default easing', () => {
      const config = new AnimationBlendConfig({ defaultEasing: 'linear' });
      const easing = config.getBlendEasing('unknown', 'other');
      expect(easing).toBe('linear');
    });

    it('should use custom easings from constructor options', () => {
      const config = new AnimationBlendConfig({
        customEasings: {
          'idle->jump': 'ease-in',
        },
      });
      const easing = config.getBlendEasing(AnimationStateName.Idle, AnimationStateName.Jump);
      expect(easing).toBe('ease-in');
    });
  });

  describe('setBlendTime', () => {
    it('should set blend time for a transition', () => {
      const config = new AnimationBlendConfig();
      config.setBlendTime(AnimationStateName.Idle, AnimationStateName.Run, 0.15);
      expect(config.getBlendTime(AnimationStateName.Idle, AnimationStateName.Run)).toBe(0.15);
    });

    it('should clamp negative blend times to 0', () => {
      const config = new AnimationBlendConfig();
      config.setBlendTime(AnimationStateName.Idle, AnimationStateName.Run, -0.1);
      expect(config.getBlendTime(AnimationStateName.Idle, AnimationStateName.Run)).toBe(0);
    });
  });

  describe('setBlendEasing', () => {
    it('should set blend easing for a transition', () => {
      const config = new AnimationBlendConfig();
      config.setBlendEasing(AnimationStateName.Idle, AnimationStateName.Run, 'ease-out');
      expect(config.getBlendEasing(AnimationStateName.Idle, AnimationStateName.Run)).toBe('ease-out');
    });
  });

  describe('default blend times', () => {
    it('should have correct default blend times for all common transitions', () => {
      const config = new AnimationBlendConfig();
      
      expect(config.getBlendTime(AnimationStateName.Idle, AnimationStateName.Walk)).toBe(0.08);
      expect(config.getBlendTime(AnimationStateName.Walk, AnimationStateName.Idle)).toBe(0.08);
      expect(config.getBlendTime(AnimationStateName.Walk, AnimationStateName.Run)).toBe(0.10);
      expect(config.getBlendTime(AnimationStateName.Run, AnimationStateName.Walk)).toBe(0.10);
      expect(config.getBlendTime(AnimationStateName.Idle, AnimationStateName.Jump)).toBe(0.15);
      expect(config.getBlendTime(AnimationStateName.Run, AnimationStateName.Jump)).toBe(0.15);
      expect(config.getBlendTime(AnimationStateName.Jump, AnimationStateName.Fall)).toBe(0.12);
      expect(config.getBlendTime(AnimationStateName.Fall, AnimationStateName.Land)).toBe(0.20);
      expect(config.getBlendTime(AnimationStateName.Land, AnimationStateName.Idle)).toBe(0.15);
    });
  });
});

