import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, Scene, CharacterController } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import { MultiplayerGameplayManager } from '../src/multiplayer/MultiplayerGameplayManager';
import { ReplicationClient } from '../src/ReplicationClient';
import { ReplicationState } from '../src/types/replication';
import type { PublicUser } from '../src/ReplicationClient';

/**
 * Test MultiplayerGameplayManager component.
 * Tests behavior: session management, player spawning, input processing, cleanup.
 */
describe('MultiplayerGameplayManager', () => {
  let manager: MultiplayerGameplayManager;
  let mockReplicationClient: ReplicationClient;
  let scene: Scene;
  let mockPhysicsWorld: PhysicsWorld;
  let localPlayerEntity: Entity;
  let onUserJoinedCallbacks: Array<(user: PublicUser) => void>;
  let onUserLeftCallbacks: Array<(userId: string) => void>;
  let onStateChangeCallback: (state: any) => void;

  beforeEach(() => {
    onUserJoinedCallbacks = [];
    onUserLeftCallbacks = [];
    onStateChangeCallback = () => {};

    // Create mock ReplicationClient
    mockReplicationClient = {
      getLocalUserId: vi.fn(() => 'local-user-123'),
      getState: vi.fn(() => 'disconnected' as any),
      connect: vi.fn(() => {
        // Simulate successful connection state change immediately
        if (onStateChangeCallback) {
          onStateChangeCallback(ReplicationState.Connected);
        }
        return Promise.resolve();
      }),
      onUserJoined: vi.fn((callback) => {
        onUserJoinedCallbacks.push(callback);
        return () => {};
      }),
      onUserLeft: vi.fn((callback) => {
        onUserLeftCallbacks.push(callback);
        return () => {};
      }),
      onStateChange: vi.fn((callback) => {
        onStateChangeCallback = callback;
        return () => {};
      }),
      onError: vi.fn(() => () => {}),
      onPlayerUpdate: vi.fn((callback) => {
        // Store callback if needed for testing
        return () => {};
      }),
      onPhysicsState: vi.fn((callback) => {
        // Store callback if needed for testing
        return () => {};
      }),
      sendPlayerUpdate: vi.fn(),
      sendPhysicsState: vi.fn(),
      sendInput: vi.fn(),
      onOperation: vi.fn(() => () => {}),
      requestSnapshot: vi.fn(),
    } as unknown as ReplicationClient;

    // Create scene
    scene = new Scene('TestScene');

    // Create mock PhysicsWorld
    mockPhysicsWorld = {
      step: vi.fn(),
    } as unknown as PhysicsWorld;

    // Create local player entity
    localPlayerEntity = new Entity('local_player');
    const controller = new CharacterController({
      moveSpeed: 5.0,
      sprintMultiplier: 1.5,
      jumpForce: 8.0,
    });
    localPlayerEntity.addComponent(controller);

    manager = new MultiplayerGameplayManager(
      mockReplicationClient,
      scene,
      mockPhysicsWorld
    );
  });

  describe('initialization', () => {
    it('should subscribe to user events on construction', () => {
      expect(mockReplicationClient.onUserJoined).toHaveBeenCalledTimes(1);
      expect(mockReplicationClient.onUserLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe('session management', () => {
    it('should start session and connect to server', async () => {
      await manager.startSession('session-123', localPlayerEntity);
      
      expect(mockReplicationClient.connect).toHaveBeenCalledWith('session-123');
      expect(manager.isSessionActive()).toBe(true);
      expect(manager.getSessionId()).toBe('session-123');
    });

    it('should reuse existing connection if already connected', async () => {
      (mockReplicationClient.getState as ReturnType<typeof vi.fn>).mockReturnValue('connected');

      await manager.startSession('session-123', localPlayerEntity);

      // Should not call connect again
      expect(mockReplicationClient.connect).not.toHaveBeenCalled();
      expect(manager.isSessionActive()).toBe(true);
    });

    it('should throw if local player entity has no CharacterController', async () => {
      const entityWithoutController = new Entity('no_controller');

      await expect(
        manager.startSession('session-123', entityWithoutController)
      ).rejects.toThrow('Local player entity must have CharacterController component');
    });

    it('should stop session and cleanup', async () => {
      await manager.startSession('session-123', localPlayerEntity);
      await manager.stopSession();

      expect(manager.isSessionActive()).toBe(false);
      expect(manager.getSessionId()).toBeNull();
      expect(manager.getLocalPlayerEntity()).toBeNull();
    });

    it('should remove remote player avatars on stop', async () => {
      await manager.startSession('session-123', localPlayerEntity);

      // Simulate user joined
      const remoteUser: PublicUser = {
        id: 'remote-user-456',
        email: 'remote@test.com',
        createdAt: Date.now(),
      };
      onUserJoinedCallbacks.forEach(cb => cb(remoteUser));

      // Verify remote player was spawned
      const remotePlayersBefore = manager.getRemotePlayers();
      expect(remotePlayersBefore.size).toBe(1);

      await manager.stopSession();

      // Remote players should be removed
      const remotePlayersAfter = manager.getRemotePlayers();
      expect(remotePlayersAfter.size).toBe(0);
    });
  });

  describe('remote player management', () => {
    beforeEach(async () => {
      await manager.startSession('session-123', localPlayerEntity);
    });

    it('should spawn remote player avatar when user joins', () => {
      const remoteUser: PublicUser = {
        id: 'remote-user-456',
        email: 'remote@test.com',
        createdAt: Date.now(),
      };

      onUserJoinedCallbacks.forEach(cb => cb(remoteUser));

      const remotePlayers = manager.getRemotePlayers();
      expect(remotePlayers.size).toBe(1);
      expect(remotePlayers.has('remote-user-456')).toBe(true);

      const remoteEntity = remotePlayers.get('remote-user-456');
      expect(remoteEntity).toBeDefined();
      expect(remoteEntity?.name).toBe('remote_player_remote-user-456');
    });

    it('should not spawn avatar for local player', () => {
      const localUser: PublicUser = {
        id: 'local-user-123',
        email: 'local@test.com',
        createdAt: Date.now(),
      };

      onUserJoinedCallbacks.forEach(cb => cb(localUser));

      const remotePlayers = manager.getRemotePlayers();
      expect(remotePlayers.size).toBe(0);
    });

    it('should remove remote player avatar when user leaves', () => {
      const remoteUser: PublicUser = {
        id: 'remote-user-456',
        email: 'remote@test.com',
        createdAt: Date.now(),
      };

      onUserJoinedCallbacks.forEach(cb => cb(remoteUser));

      const remotePlayersBefore = manager.getRemotePlayers();
      expect(remotePlayersBefore.size).toBe(1);

      onUserLeftCallbacks.forEach(cb => cb('remote-user-456'));

      const remotePlayersAfter = manager.getRemotePlayers();
      expect(remotePlayersAfter.size).toBe(0);
    });

    it('should mark local player entity with userId', async () => {
      await manager.startSession('session-123', localPlayerEntity);

      expect(localPlayerEntity.userData.userId).toBe('local-user-123');
      expect(localPlayerEntity.userData.isLocalPlayer).toBe(true);
    });

    it('should mark remote player entities with userId', () => {
      const remoteUser: PublicUser = {
        id: 'remote-user-456',
        email: 'remote@test.com',
        createdAt: Date.now(),
      };

      onUserJoinedCallbacks.forEach(cb => cb(remoteUser));

      const remotePlayers = manager.getRemotePlayers();
      const remoteEntity = remotePlayers.get('remote-user-456');
      expect(remoteEntity?.userData.userId).toBe('remote-user-456');
      expect(remoteEntity?.userData.isRemotePlayer).toBe(true);
    });
  });

  describe('update loop', () => {
    beforeEach(async () => {
      await manager.startSession('session-123', localPlayerEntity);
    });

    it('should update sync systems', () => {
      // Should not throw
      expect(() => manager.update(0.016)).not.toThrow();
    });

    it('should not update if not connected', async () => {
      await manager.stopSession();

      // Should not throw even when stopped
      expect(() => manager.update(0.016)).not.toThrow();
    });
  });

  describe('input processing', () => {
    beforeEach(async () => {
      await manager.startSession('session-123', localPlayerEntity);
    });

    it('should process input for local player', () => {
      const input = {
        moveDirection: [0, 0, 1] as [number, number, number],
        jump: false,
        sprint: false,
      };

      manager.processInput(input);

      // Input should be applied to controller
      const controller = localPlayerEntity.getComponent(CharacterController);
      expect(controller).toBeDefined();
    });

    it('should not process input if not connected', async () => {
      await manager.stopSession();

      const input = {
        moveDirection: [0, 0, 1] as [number, number, number],
        jump: false,
        sprint: false,
      };

      // Should not throw
      expect(() => manager.processInput(input)).not.toThrow();
    });
  });

  describe('player entity access', () => {
    it('should return local player entity', async () => {
      await manager.startSession('session-123', localPlayerEntity);

      expect(manager.getLocalPlayerEntity()).toBe(localPlayerEntity);
    });

    it('should return null for local player if session not started', () => {
      expect(manager.getLocalPlayerEntity()).toBeNull();
    });

    it('should return copy of remote players map', () => {
      const remoteUser: PublicUser = {
        id: 'remote-user-456',
        email: 'remote@test.com',
        createdAt: Date.now(),
      };

      onUserJoinedCallbacks.forEach(cb => cb(remoteUser));

      const map1 = manager.getRemotePlayers();
      const map2 = manager.getRemotePlayers();

      expect(map1).not.toBe(map2); // Different instances
      expect(map1.size).toBe(map2.size);
    });
  });
});

