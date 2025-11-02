import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene, Entity, CharacterController } from '@engine/world';
import { PlayerSync } from './PlayerSync';
import { ReplicationClient } from '../ReplicationClient';

describe('PlayerSync', () => {
  let scene: Scene;
  let localPlayerEntity: Entity;
  let replicationClient: ReplicationClient;
  let playerSync: PlayerSync;

  beforeEach(() => {
    scene = new Scene('TestScene');

    localPlayerEntity = scene.createEntity('LocalPlayer');
    localPlayerEntity.transform.position = [0, 1, 0];
    
    const controller = new CharacterController({
      moveSpeed: 5.0,
      sprintMultiplier: 1.5,
      jumpForce: 8.0,
    });
    localPlayerEntity.addComponent(controller);

    replicationClient = {
      getLocalUserId: vi.fn(() => 'test-user-id'),
      sendPlayerUpdate: vi.fn(),
      onPlayerUpdate: vi.fn(() => () => {}), // Return unsubscribe function
    } as unknown as ReplicationClient;

    playerSync = new PlayerSync({
      localPlayerEntity,
      replicationClient,
      localUserId: 'test-user-id',
      sendInterval: 100,
    });
  });

  it('should initialize with local player entity', () => {
    expect(playerSync).toBeDefined();
    expect(replicationClient.onPlayerUpdate).toHaveBeenCalled();
  });

  it('should send player update when position changes', () => {
    localPlayerEntity.transform.position = [1, 1, 1];
    
    playerSync.update(0.2); // 200ms, exceeds sendInterval

    expect(replicationClient.sendPlayerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'test-user-id',
        position: [1, 1, 1],
      })
    );
  });

  it('should not send update if position has not changed significantly', () => {
    playerSync.update(0.2);
    replicationClient.sendPlayerUpdate = vi.fn(); // Reset counter

    // Small movement (less than 0.01 threshold)
    localPlayerEntity.transform.position = [0.005, 1, 0];
    playerSync.update(0.2);

    expect(replicationClient.sendPlayerUpdate).not.toHaveBeenCalled();
  });

  it('should handle remote player updates', () => {
    const remoteEntity = scene.createEntity('RemotePlayer');
    remoteEntity.transform.position = [5, 1, 5];

    // Simulate receiving update from network
    const onPlayerUpdate = (replicationClient.onPlayerUpdate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    
    onPlayerUpdate({
      type: 'player-update',
      timestamp: Date.now(),
      userId: 'remote-user-id',
      playerId: 'remote-user-id',
      position: [10, 2, 10] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
    });

    // Register remote player first
    playerSync.registerRemotePlayer('remote-user-id', remoteEntity);
    
    // Simulate another update
    onPlayerUpdate({
      type: 'player-update',
      timestamp: Date.now(),
      userId: 'remote-user-id',
      playerId: 'remote-user-id',
      position: [12, 2, 12] as [number, number, number],
    });

    // Update should interpolate
    playerSync.update(0.016); // ~60fps

    // Entity position should be updated (at least in the direction of new position)
    expect(remoteEntity.transform.position[0]).toBeGreaterThan(5);
  });

  it('should ignore updates from local player', () => {
    const onPlayerUpdate = (replicationClient.onPlayerUpdate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const initialPosition = [...localPlayerEntity.transform.position] as [number, number, number];

    onPlayerUpdate({
      type: 'player-update',
      timestamp: Date.now(),
      userId: 'test-user-id',
      playerId: 'test-user-id',
      position: [999, 999, 999] as [number, number, number],
    });

    playerSync.update(0.016);

    // Position should not have changed (we ignore our own updates)
    expect(localPlayerEntity.transform.position[0]).toBe(initialPosition[0]);
  });

  it('should cleanup on dispose', () => {
    playerSync.dispose();
    
    // Should not throw errors after disposal
    expect(() => playerSync.update(0.016)).not.toThrow();
  });

  it('should use localUserId from ReplicationClient when not provided', () => {
    void new PlayerSync({
      localPlayerEntity,
      replicationClient,
    });

    expect(replicationClient.getLocalUserId).toHaveBeenCalled();
  });
});

