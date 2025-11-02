import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, CharacterController } from '@engine/world';
import { PlayerSync } from '../src/multiplayer/PlayerSync';
import { ReplicationClient } from '../src/ReplicationClient';
import type { PlayerUpdateMessage } from '../src/types/replication';

/**
 * Test PlayerSync component.
 * Tests behavior: sending updates, receiving updates, interpolation.
 */
describe('PlayerSync', () => {
  let playerSync: PlayerSync;
  let mockReplicationClient: ReplicationClient;
  let localPlayerEntity: Entity;
  let localPlayerController: CharacterController;
  let onPlayerUpdateCallback: (message: PlayerUpdateMessage) => void;

  beforeEach(() => {
    // Create mock ReplicationClient
    mockReplicationClient = {
      getLocalUserId: vi.fn(() => 'local-user-123'),
      onPlayerUpdate: vi.fn((callback) => {
        onPlayerUpdateCallback = callback;
        return () => {}; // Return unsubscribe function
      }),
      sendPlayerUpdate: vi.fn(),
      getState: vi.fn(() => 'connected' as any),
    } as unknown as ReplicationClient;

    // Create local player entity with CharacterController
    localPlayerEntity = new Entity('local_player');
    localPlayerController = new CharacterController({
      moveSpeed: 5.0,
      sprintMultiplier: 1.5,
      jumpForce: 8.0,
    });
    localPlayerEntity.addComponent(localPlayerController);
    localPlayerEntity.transform.position = [0, 0, 0];

    // Create PlayerSync instance
    playerSync = new PlayerSync({
      localPlayerEntity,
      replicationClient: mockReplicationClient,
      localUserId: 'local-user-123',
      sendInterval: 100, // 100ms for faster tests
    });
  });

  describe('initialization', () => {
    it('should subscribe to player updates on construction', () => {
      expect(mockReplicationClient.onPlayerUpdate).toHaveBeenCalledTimes(1);
    });

    it('should use provided localUserId', () => {
      const sync = new PlayerSync({
        localPlayerEntity,
        replicationClient: mockReplicationClient,
        localUserId: 'custom-user-id',
      });
      expect(sync).toBeDefined();
    });
  });

  describe('sending player updates', () => {
    it('should not send update if position has not changed significantly', () => {
      // Initial update should be sent (no last position)
      playerSync.update(0.2); // 200ms, should trigger send

      expect(mockReplicationClient.sendPlayerUpdate).toHaveBeenCalledTimes(1);

      // Reset position to same spot
      localPlayerEntity.transform.position = [0, 0, 0];
      playerSync.update(0.2); // Another 200ms

      // Should not send if position didn't change (threshold check)
      // First call was initial, second should check threshold
      expect(mockReplicationClient.sendPlayerUpdate).toHaveBeenCalledTimes(1);
    });

    it('should send update when position changes significantly', () => {
      playerSync.update(0.2); // Initial update
      vi.clearAllMocks();

      // Move player significantly
      localPlayerEntity.transform.position = [1, 0, 0]; // 1 unit movement
      playerSync.update(0.2); // Should send update

      expect(mockReplicationClient.sendPlayerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'local-user-123',
          position: [1, 0, 0],
        })
      );
    });

    it('should include velocity in update if available', () => {
      // Set velocity on controller (if available via internal state)
      localPlayerEntity.transform.position = [1, 0, 0];
      playerSync.update(0.2);

      const call = (mockReplicationClient.sendPlayerUpdate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(call).toBeDefined();
      expect(call.playerId).toBe('local-user-123');
    });

    it('should not send update if localUserId is not available', () => {
      const syncNoUserId = new PlayerSync({
        localPlayerEntity,
        replicationClient: {
          ...mockReplicationClient,
          getLocalUserId: vi.fn(() => null),
        } as unknown as ReplicationClient,
      });

      localPlayerEntity.transform.position = [1, 0, 0];
      syncNoUserId.update(0.2);

      // Should not send if no userId
      expect(mockReplicationClient.sendPlayerUpdate).not.toHaveBeenCalled();
    });

    it('should respect sendInterval', () => {
      localPlayerEntity.transform.position = [1, 0, 0];
      playerSync.update(0.05); // 50ms - should not send yet (interval is 100ms)

      expect(mockReplicationClient.sendPlayerUpdate).not.toHaveBeenCalled();

      playerSync.update(0.06); // Another 60ms, total 110ms - should send
      expect(mockReplicationClient.sendPlayerUpdate).toHaveBeenCalled();
    });
  });

  describe('receiving player updates', () => {
    it('should ignore updates from local player', () => {
      const message: PlayerUpdateMessage = {
        type: 'player-update',
        timestamp: Date.now(),
        userId: 'local-user-123',
        playerId: 'local-user-123',
        position: [10, 0, 0],
      };

      onPlayerUpdateCallback(message);

      // Should not register as remote player
      const remotePlayers = playerSync.getRemotePlayers();
      expect(remotePlayers.size).toBe(0);
    });

    it('should register remote player on first update', () => {
      const message: PlayerUpdateMessage = {
        type: 'player-update',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        playerId: 'remote-user-456',
        position: [5, 0, 0],
        rotation: [0, 0, 0, 1],
      };

      // Create entity for remote player first (simulating MultiplayerGameplayManager)
      const remoteEntity = new Entity('remote_player_456');
      playerSync.registerRemotePlayer('remote-user-456', remoteEntity);

      onPlayerUpdateCallback(message);

      const remotePlayers = playerSync.getRemotePlayers();
      expect(remotePlayers.size).toBe(1);
      expect(remotePlayers.has('remote-user-456')).toBe(true);
    });

    it('should update existing remote player position', () => {
      const remoteEntity = new Entity('remote_player_456');
      playerSync.registerRemotePlayer('remote-user-456', remoteEntity);

      const message1: PlayerUpdateMessage = {
        type: 'player-update',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        playerId: 'remote-user-456',
        position: [5, 0, 0],
      };

      onPlayerUpdateCallback(message1);
      playerSync.update(0.01); // Apply update
      expect(remoteEntity.transform.position).toEqual([5, 0, 0]);

      const message2: PlayerUpdateMessage = {
        type: 'player-update',
        timestamp: Date.now() + 100,
        userId: 'remote-user-456',
        playerId: 'remote-user-456',
        position: [10, 0, 0],
      };

      onPlayerUpdateCallback(message2);
      playerSync.update(0.01); // Apply update
      expect(remoteEntity.transform.position).toEqual([10, 0, 0]);
    });
  });

  describe('interpolation', () => {
    it('should interpolate remote players', () => {
      const remoteEntity = new Entity('remote_player');
      remoteEntity.transform.position = [0, 0, 0];
      playerSync.registerRemotePlayer('remote-user-456', remoteEntity);

      const message: PlayerUpdateMessage = {
        type: 'player-update',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        playerId: 'remote-user-456',
        position: [10, 0, 0],
        velocity: [5, 0, 0], // 5 units/second forward
      };

      onPlayerUpdateCallback(message);

      // Update with interpolation (enablePrediction is true by default)
      playerSync.update(0.05); // 50ms

      // With prediction, should move forward based on velocity
      const position = remoteEntity.transform.position;
      expect(position[0]).toBeGreaterThan(10); // Should be ahead of base position
      expect(position[0]).toBeLessThan(10.6); // But not too far (max 100ms prediction = 0.5 units)
    });

    it('should apply rotation if provided', () => {
      const remoteEntity = new Entity('remote_player');
      playerSync.registerRemotePlayer('remote-user-456', remoteEntity);

      const rotation: [number, number, number, number] = [0, 0.707, 0, 0.707]; // 90deg Y rotation

      const message: PlayerUpdateMessage = {
        type: 'player-update',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        playerId: 'remote-user-456',
        position: [0, 0, 0],
        rotation,
      };

      onPlayerUpdateCallback(message);
      playerSync.update(0.01);

      // Transform normalizes quaternions, so we need to compare with tolerance
      const actualRotation = remoteEntity.transform.rotation;
      expect(actualRotation[0]).toBeCloseTo(rotation[0], 3);
      expect(actualRotation[1]).toBeCloseTo(rotation[1], 3);
      expect(actualRotation[2]).toBeCloseTo(rotation[2], 3);
      expect(actualRotation[3]).toBeCloseTo(rotation[3], 3);
    });
  });

  describe('remote player management', () => {
    it('should allow registering remote players', () => {
      const remoteEntity = new Entity('remote_player');
      playerSync.registerRemotePlayer('remote-user-456', remoteEntity);

      const remotePlayers = playerSync.getRemotePlayers();
      expect(remotePlayers.size).toBe(1);
      expect(remotePlayers.has('remote-user-456')).toBe(true);
    });

    it('should allow unregistering remote players', () => {
      const remoteEntity = new Entity('remote_player');
      playerSync.registerRemotePlayer('remote-user-456', remoteEntity);
      playerSync.unregisterRemotePlayer('remote-user-456');

      const remotePlayers = playerSync.getRemotePlayers();
      expect(remotePlayers.size).toBe(0);
    });

    it('should update existing remote player entity', () => {
      const entity1 = new Entity('remote_1');
      const entity2 = new Entity('remote_2');

      playerSync.registerRemotePlayer('remote-user-456', entity1);
      playerSync.registerRemotePlayer('remote-user-456', entity2); // Replace

      const remotePlayers = playerSync.getRemotePlayers();
      const remotePlayer = remotePlayers.get('remote-user-456');
      expect(remotePlayer?.entity).toBe(entity2);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on dispose', () => {
      const remoteEntity = new Entity('remote_player');
      playerSync.registerRemotePlayer('remote-user-456', remoteEntity);

      playerSync.dispose();

      const remotePlayers = playerSync.getRemotePlayers();
      expect(remotePlayers.size).toBe(0);
    });
  });
});

