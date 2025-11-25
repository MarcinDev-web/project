import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerSession, type PlayerProfile } from '@engine/stdlib/CharacterController';
import type {
  PlayerController,
  ControllerPreferences,
  ControllerContext,
} from '@engine/stdlib/CharacterController';
import type { Entity } from '@engine/world';
import { EMPTY_INTENT, cloneIntent as cloneIntentUtil } from '@engine/stdlib/CharacterController';

/**
 * Mock PlayerController for testing
 */
function createMockController(id: string): PlayerController {
  const mockPreferences: ControllerPreferences = {
    fov: 75,
    invertY: false,
    sensitivity: 1.0,
    hudLayout: 'default',
  };

  const mockContext: ControllerContext = {
    pawn: null,
    intent: cloneIntent(EMPTY_INTENT),
  };

  const unpossessSpy = vi.fn();
  const updateSpy = vi.fn();
  const possessSpy = vi.fn();

  return {
    id,
    preferences: mockPreferences,
    possess: possessSpy,
    unpossess: unpossessSpy,
    update: updateSpy,
    getContext: () => mockContext,
  } as PlayerController;
}

const cloneIntent = cloneIntentUtil;

describe('PlayerSession', () => {
  let profile: PlayerProfile;
  let session: PlayerSession;

  beforeEach(() => {
    profile = {
      id: 'player1',
      displayName: 'Test Player',
    };
    session = new PlayerSession(profile);
  });

  describe('Constructor', () => {
    it('should create session with profile', () => {
      expect(session.profile).toBe(profile);
      expect(session.profile.id).toBe('player1');
      expect(session.profile.displayName).toBe('Test Player');
    });

    it('should initialize with null controller', () => {
      expect(session.getController()).toBeNull();
    });

    it('should accept extended profile with optional fields', () => {
      const extendedProfile: PlayerProfile = {
        id: 'player2',
        displayName: 'Extended Player',
        avatar: 'avatar-id-123',
        preferences: { theme: 'dark', difficulty: 'normal' },
        metadata: { createdAt: '2025-01-01', level: 10 },
      };

      const extendedSession = new PlayerSession(extendedProfile);
      expect(extendedSession.profile.avatar).toBe('avatar-id-123');
      expect(extendedSession.profile.preferences).toEqual({ theme: 'dark', difficulty: 'normal' });
      expect(extendedSession.profile.metadata).toEqual({ createdAt: '2025-01-01', level: 10 });
    });
  });

  describe('Getters', () => {
    it('should return id via getter', () => {
      expect(session.id).toBe('player1');
    });

    it('should return displayName via getter', () => {
      expect(session.displayName).toBe('Test Player');
    });

    it('should return same values as profile', () => {
      expect(session.id).toBe(session.profile.id);
      expect(session.displayName).toBe(session.profile.displayName);
    });
  });

  describe('bindController', () => {
    it('should bind controller to session', () => {
      const controller = createMockController('controller1');

      session.bindController(controller);

      expect(session.getController()).toBe(controller);
    });

    it('should log warning when overwriting existing controller', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const controller1 = createMockController('controller1');
      const controller2 = createMockController('controller2');

      session.bindController(controller1);
      session.bindController(controller2);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PlayerSession] Overwriting existing controller')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('player1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('controller1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('controller2'));

      expect(session.getController()).toBe(controller2);

      consoleSpy.mockRestore();
    });

    it('should allow overwriting controller multiple times', () => {
      const controller1 = createMockController('controller1');
      const controller2 = createMockController('controller2');
      const controller3 = createMockController('controller3');

      session.bindController(controller1);
      session.bindController(controller2);
      session.bindController(controller3);

      expect(session.getController()).toBe(controller3);
    });
  });

  describe('unbindController', () => {
    it('should unbind controller and call unpossess', () => {
      const controller = createMockController('controller1');
      const unpossessSpy = vi.spyOn(controller, 'unpossess');

      session.bindController(controller);
      session.unbindController();

      expect(unpossessSpy).toHaveBeenCalledTimes(1);
      expect(session.getController()).toBeNull();
    });

    it('should handle unbind when no controller is bound', () => {
      expect(() => session.unbindController()).not.toThrow();
      expect(session.getController()).toBeNull();
    });
  });

  describe('update', () => {
    it('should delegate update to controller', () => {
      const controller = createMockController('controller1');
      const updateSpy = vi.spyOn(controller, 'update');

      session.bindController(controller);
      session.update(0.016);

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith(0.016);
    });

    it('should handle update when no controller is bound', () => {
      expect(() => session.update(0.016)).not.toThrow();
    });

    it('should handle multiple updates', () => {
      const controller = createMockController('controller1');
      const updateSpy = vi.spyOn(controller, 'update');

      session.bindController(controller);
      session.update(0.016);
      session.update(0.016);
      session.update(0.016);

      expect(updateSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('dispose', () => {
    it('should unbind controller when disposed', () => {
      const controller = createMockController('controller1');
      const unpossessSpy = vi.spyOn(controller, 'unpossess');

      session.bindController(controller);
      session.dispose();

      expect(unpossessSpy).toHaveBeenCalledTimes(1);
      expect(session.getController()).toBeNull();
    });

    it('should be idempotent - safe to call multiple times', () => {
      const controller = createMockController('controller1');
      const unpossessSpy = vi.spyOn(controller, 'unpossess');

      session.bindController(controller);
      session.dispose();
      session.dispose();
      session.dispose();

      expect(unpossessSpy).toHaveBeenCalledTimes(1);
      expect(session.getController()).toBeNull();
    });

    it('should handle dispose when no controller is bound', () => {
      expect(() => session.dispose()).not.toThrow();
      expect(session.getController()).toBeNull();
    });
  });

  describe('Integration', () => {
    it('should handle full lifecycle: bind -> update -> unbind -> dispose', () => {
      const controller = createMockController('controller1');
      const possessSpy = vi.spyOn(controller, 'possess');
      const updateSpy = vi.spyOn(controller, 'update');
      const unpossessSpy = vi.spyOn(controller, 'unpossess');

      // Bind controller
      session.bindController(controller);
      expect(session.getController()).toBe(controller);

      // Update multiple times
      session.update(0.016);
      session.update(0.016);
      expect(updateSpy).toHaveBeenCalledTimes(2);

      // Unbind
      session.unbindController();
      expect(unpossessSpy).toHaveBeenCalledTimes(1);
      expect(session.getController()).toBeNull();

      // Dispose (should be safe but no-op)
      session.dispose();
      expect(session.getController()).toBeNull();
    });

    it('should handle bind -> dispose lifecycle', () => {
      const controller = createMockController('controller1');
      const unpossessSpy = vi.spyOn(controller, 'unpossess');

      session.bindController(controller);
      session.dispose();

      expect(unpossessSpy).toHaveBeenCalledTimes(1);
      expect(session.getController()).toBeNull();
    });
  });
});
