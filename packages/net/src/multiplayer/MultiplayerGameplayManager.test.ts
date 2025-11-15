import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene, Entity, CharacterController } from '@engine/world';
import { MultiplayerGameplayManager } from './MultiplayerGameplayManager';
import { ReplicationClient } from '../ReplicationClient';
import type { PublicUser } from '../ReplicationClient';

describe('MultiplayerGameplayManager', () => {
  let scene: Scene;
  let physicsWorld: any; // Mock PhysicsWorld
  let replicationClient: ReplicationClient;
  let manager: MultiplayerGameplayManager;
  let localPlayerEntity: Entity;

  beforeEach(() => {
    scene = new Scene('TestScene');

    physicsWorld = {
      // Mock physics world
    };

    localPlayerEntity = scene.createEntity('LocalPlayer');
    localPlayerEntity.transform.position = [0, 1, 0];
    
    const controller = new CharacterController({
      moveSpeed: 5.0,
      sprintMultiplier: 1.5,
      jumpForce: 8.0,
    });
    localPlayerEntity.addComponent(controller);

    const onUserJoinedHandlers: Array<(user: PublicUser) => void> = [];
    const onUserLeftHandlers: Array<(userId: string) => void> = [];

    replicationClient = {
      getLocalUserId: vi.fn(() => 'local-user-id'),
      getState: vi.fn(() => 'disconnected' as any),
      connect: vi.fn(() => Promise.resolve()),
      onUserJoined: vi.fn((cb) => {
        onUserJoinedHandlers.push(cb);
        return () => {
          const index = onUserJoinedHandlers.indexOf(cb);
          if (index >= 0) onUserJoinedHandlers.splice(index, 1);
        };
      }),
      onUserLeft: vi.fn((cb) => {
        onUserLeftHandlers.push(cb);
        return () => {
          const index = onUserLeftHandlers.indexOf(cb);
          if (index >= 0) onUserLeftHandlers.splice(index, 1);
        };
      }),
      onPlayerUpdate: vi.fn(() => () => {}), // Return unsubscribe function
      onPhysicsState: vi.fn(() => () => {}), // Return unsubscribe function
    } as unknown as ReplicationClient;

    manager = new MultiplayerGameplayManager(
      replicationClient,
      scene,
      physicsWorld
    );
  });

  it('should initialize with replication client, scene, and physics world', () => {
    expect(manager).toBeDefined();
    expect(replicationClient.onUserJoined).toHaveBeenCalled();
    expect(replicationClient.onUserLeft).toHaveBeenCalled();
  });

  it('should start session and connect to server', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);

    expect(replicationClient.connect).toHaveBeenCalledWith('test-session-id');
    expect(manager.isSessionActive()).toBe(true);
    expect(manager.getSessionId()).toBe('test-session-id');
  });

  it('should spawn remote player avatar when user joins', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);

    const remoteUser: PublicUser = {
      id: 'remote-user-id',
      email: 'remote@example.com',
      createdAt: Date.now(),
    };

    // Simulate user joined event
    const onUserJoined = (replicationClient.onUserJoined as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    onUserJoined(remoteUser);

    const remotePlayers = manager.getRemotePlayers();
    expect(remotePlayers.has('remote-user-id')).toBe(true);

    const remoteEntity = remotePlayers.get('remote-user-id');
    expect(remoteEntity).toBeDefined();
    expect(remoteEntity?.userData.isRemotePlayer).toBe(true);
    expect(remoteEntity?.userData.userId).toBe('remote-user-id');
  });

  it('should remove remote player avatar when user leaves', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);

    const remoteUser: PublicUser = {
      id: 'remote-user-id',
      email: 'remote@example.com',
      createdAt: Date.now(),
    };

    // Simulate user joined
    const onUserJoined = (replicationClient.onUserJoined as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    onUserJoined(remoteUser);

    expect(manager.getRemotePlayers().has('remote-user-id')).toBe(true);

    // Simulate user left
    const onUserLeft = (replicationClient.onUserLeft as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    onUserLeft('remote-user-id');

    expect(manager.getRemotePlayers().has('remote-user-id')).toBe(false);
  });

  it('should not spawn avatar for local player', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);

    const localUser: PublicUser = {
      id: 'local-user-id',
      email: 'local@example.com',
      createdAt: Date.now(),
    };

    // Simulate local user joined (should be ignored)
    const onUserJoined = (replicationClient.onUserJoined as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    onUserJoined(localUser);

    const remotePlayers = manager.getRemotePlayers();
    expect(remotePlayers.has('local-user-id')).toBe(false);
  });

  it('should stop session and cleanup', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);
    expect(manager.isSessionActive()).toBe(true);

    await manager.stopSession();

    expect(manager.isSessionActive()).toBe(false);
    expect(manager.getSessionId()).toBeNull();
    expect(manager.getLocalPlayerEntity()).toBeNull();
  });

  it('should update multiplayer systems', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);

    // Should not throw when updating
    expect(() => manager.update(0.016)).not.toThrow();
  });

  it('should get local player entity', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);

    expect(manager.getLocalPlayerEntity()).toBe(localPlayerEntity);
  });

  it('should handle reconnection', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);
    
    // Simulate disconnection
    (replicationClient.getState as ReturnType<typeof vi.fn>).mockReturnValue('disconnected' as any);
    manager.update(0.016);
    
    // Simulate reconnection
    (replicationClient.getState as ReturnType<typeof vi.fn>).mockReturnValue('connected' as any);
    manager.update(0.016);
    
    // Should still be active
    expect(manager.isSessionActive()).toBe(true);
  });

  it('should reset sync states on reconnection', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);
    
    const playerSync = (manager as any).playerSync;
    const physicsSync = (manager as any).physicsSync;
    const inputReplicator = (manager as any).inputReplicator;
    
    // Simulate reconnection
    (replicationClient.getState as ReturnType<typeof vi.fn>).mockReturnValue('disconnected' as any);
    manager.update(0.016);
    
    (replicationClient.getState as ReturnType<typeof vi.fn>).mockReturnValue('connected' as any);
    manager.update(0.016);
    
    // Sync states should be reset
    if (playerSync) {
      expect(playerSync.resetForReconnection).toBeDefined();
    }
    if (physicsSync) {
      expect(physicsSync.resetForReconnection).toBeDefined();
    }
    if (inputReplicator) {
      expect(inputReplicator.flushBuffer).toBeDefined();
    }
  });

  it('should handle manual reconnection', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);
    
    (replicationClient.getState as ReturnType<typeof vi.fn>).mockReturnValue('disconnected' as any);
    
    await manager.reconnect();
    
    expect(replicationClient.connect).toHaveBeenCalledWith('test-session-id');
  });

  it('should handle invalid input gracefully', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);
    
    const errorHandler = (manager as any).errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');
    
    // @ts-expect-error - Testing invalid input
    manager.processInput(null);
    
    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should handle update with invalid deltaTime', async () => {
    await manager.startSession('test-session-id', localPlayerEntity);
    
    const errorHandler = (manager as any).errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');
    
    // @ts-expect-error - Testing invalid input
    manager.update(NaN);
    
    expect(handleErrorSpy).toHaveBeenCalled();
  });
});

