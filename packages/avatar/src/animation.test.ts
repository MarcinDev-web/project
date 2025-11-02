import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AvatarAnimationPlayer } from './animation';
import type { AvatarAnimation } from './animation';
import { AvatarSkeleton, DEFAULT_AVATAR_JOINTS } from './skeleton';

describe('AvatarAnimationPlayer', () => {
  let skeleton: AvatarSkeleton;
  let player: AvatarAnimationPlayer;

  beforeEach(() => {
    skeleton = new AvatarSkeleton(DEFAULT_AVATAR_JOINTS);
    player = new AvatarAnimationPlayer(skeleton);
  });

  describe('play', () => {
    it('should play animation', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      expect(() => {
        player.play(animation);
      }).not.toThrow();
    });

    it('should throw error for animation with zero length', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 0,
        loop: false,
        frames: [],
      };

      expect(() => {
        player.play(animation);
      }).toThrow('positive length');
    });

    it('should play animation with custom start time', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 2.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
          {
            time: 1.0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      expect(() => {
        player.play(animation, 0.5);
      }).not.toThrow();
    });

    it('should apply initial frame on play', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);

      const transform = skeleton.getLocalTransform('Head');
      expect(transform.rotation).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop animation', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.stop();

      expect(player.isFinished()).toBe(false);
    });

    it('should reset pose when resetPose option is true', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.stop({ resetPose: true });

      // Skeleton should be reset to default pose
      const transform = skeleton.getLocalTransform('Head');
      expect(transform.rotation).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update animation time', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
          {
            time: 0.5,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.1);

      // Should not throw
      expect(player.isFinished()).toBe(false);
    });

    it('should not update when no animation is playing', () => {
      expect(() => {
        player.update(0.1);
      }).not.toThrow();
    });

    it('should stop updating after non-looping animation finishes', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 0.1,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.2); // Past end

      expect(player.isFinished()).toBe(true);
    });

    it('should loop animation when loop is true', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 0.1,
        loop: true,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.15); // Past end, should loop

      expect(player.isFinished()).toBe(false);
    });
  });

  describe('onFinished', () => {
    it('should call handler when animation finishes', () => {
      const handler = vi.fn();
      const unsubscribe = player.onFinished(handler);

      const animation: AvatarAnimation = {
        name: 'test',
        length: 0.1,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.2);

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0]?.[0]?.animation).toBe(animation);

      unsubscribe();
    });

    it('should not call handler multiple times', () => {
      const handler = vi.fn();
      const unsubscribe = player.onFinished(handler);

      const animation: AvatarAnimation = {
        name: 'test',
        length: 0.1,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.2);
      player.update(0.1); // Update again after finish

      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('should allow unsubscribing', () => {
      const handler = vi.fn();
      const unsubscribe = player.onFinished(handler);

      const animation: AvatarAnimation = {
        name: 'test',
        length: 0.1,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      unsubscribe();

      player.play(animation);
      player.update(0.2);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onceFinished', () => {
    it('should call handler only once when animation finishes', () => {
      const handler = vi.fn();
      const unsubscribe = player.onceFinished(handler);

      const animation: AvatarAnimation = {
        name: 'test',
        length: 0.1,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.2);

      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });

  describe('isFinished', () => {
    it('should return false initially', () => {
      expect(player.isFinished()).toBe(false);
    });

    it('should return false while animation is playing', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      expect(player.isFinished()).toBe(false);
    });

    it('should return true after animation finishes', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 0.1,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.2);

      expect(player.isFinished()).toBe(true);
    });

    it('should return false for looping animation', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 0.1,
        loop: true,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.2);

      expect(player.isFinished()).toBe(false);
    });
  });

  describe('interpolation', () => {
    it('should interpolate between keyframes', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: {
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1],
              },
            },
          },
          {
            time: 1.0,
            joints: {
              Head: {
                position: [1, 0, 0],
                rotation: [0, 0, 0, 1],
              },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.5); // Middle of animation

      const transform = skeleton.getLocalTransform('Head');
      expect(transform.position[0]).toBeGreaterThan(0);
      expect(transform.position[0]).toBeLessThan(1);
    });

    it('should handle single keyframe', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.5);

      const transform = skeleton.getLocalTransform('Head');
      expect(transform.rotation).toBeDefined();
    });

    it('should handle keyframes with only position or only rotation', () => {
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { position: [0, 0, 0] },
            },
          },
          {
            time: 0.5,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      player.play(animation);
      player.update(0.25);

      // Should not throw
      const transform = skeleton.getLocalTransform('Head');
      expect(transform).toBeDefined();
    });
  });
});

