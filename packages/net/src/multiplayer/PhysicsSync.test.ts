import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene, PhysicsComponent, RigidbodyType } from '@engine/world';
import { PhysicsSync } from './PhysicsSync';
import { ReplicationClient } from '../ReplicationClient';

describe('PhysicsSync', () => {
  let scene: Scene;
  let physicsWorld: any; // Mock PhysicsWorld
  let replicationClient: ReplicationClient;
  let physicsSync: PhysicsSync;

  beforeEach(() => {
    scene = new Scene('TestScene');

    physicsWorld = {
      // Mock physics world
    };

    replicationClient = {
      sendPhysicsState: vi.fn(),
      onPhysicsState: vi.fn(() => () => {}), // Return unsubscribe function
      getLocalUserId: vi.fn(() => 'test-user-id'),
    } as unknown as ReplicationClient;

    physicsSync = new PhysicsSync({
      physicsWorld,
      scene,
      replicationClient,
      sendInterval: 100,
    });
  });

  it('should initialize with scene and replication client', () => {
    expect(physicsSync).toBeDefined();
    expect(replicationClient.onPhysicsState).toHaveBeenCalled();
  });

  it('should send physics state for dynamic rigid bodies', () => {
    const entity = scene.createEntity('DynamicBody');
    entity.transform.position = [0, 1, 0];
    
    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Dynamic;
    entity.addComponent(physics);

    physicsSync.update(0.2); // Exceeds sendInterval

    expect(replicationClient.sendPhysicsState).toHaveBeenCalledWith(
      expect.objectContaining({
        bodies: expect.arrayContaining([
          expect.objectContaining({
            entityId: entity.id,
            position: [0, 1, 0],
          }),
        ]),
      })
    );
  });

  it('should not send physics state for static bodies', () => {
    const entity = scene.createEntity('StaticBody');
    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Static;
    entity.addComponent(physics);

    physicsSync.update(0.2);

    // Static bodies should not be synced
    const call = (replicationClient.sendPhysicsState as ReturnType<typeof vi.fn>).mock.calls[0];
    if (call) {
      const bodies = call[0]?.bodies || [];
      const staticBody = bodies.find((b: any) => b.entityId === entity.id);
      expect(staticBody).toBeUndefined();
    }
  });

  it('should handle remote physics state updates', () => {
    const entity = scene.createEntity('RemoteBody');
    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Dynamic;
    entity.addComponent(physics);

    // Simulate receiving update from network
    const onPhysicsState = (replicationClient.onPhysicsState as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    
    onPhysicsState({
      type: 'physics-state',
      timestamp: Date.now(),
      userId: 'remote-user-id',
      frameNumber: 1,
      bodies: [{
        entityId: entity.id,
        position: [10, 5, 10] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
      }],
    });

    physicsSync.update(0.016);

    // Entity position should be updated
    expect(entity.transform.position[0]).toBe(10);
    expect(entity.transform.position[1]).toBe(5);
    expect(entity.transform.position[2]).toBe(10);
  });

  it('should increment frame number', () => {
    const initialFrame = physicsSync.getFrameNumber();
    physicsSync.update(0.016);
    const newFrame = physicsSync.getFrameNumber();

    expect(newFrame).toBeGreaterThan(initialFrame);
  });

  it('should reset frame number', () => {
    physicsSync.update(0.016);
    void physicsSync.getFrameNumber(); // Store initial frame but don't use it

    physicsSync.resetFrameNumber(100);
    expect(physicsSync.getFrameNumber()).toBe(100);
  });

  it('should cleanup on dispose', () => {
    physicsSync.dispose();
    
    // Should not throw errors after disposal
    expect(() => physicsSync.update(0.016)).not.toThrow();
  });

  it('should reject invalid position values (NaN)', () => {
    const onPhysicsState = (replicationClient.onPhysicsState as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const errorHandler = (physicsSync as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    onPhysicsState({
      type: 'physics-state',
      timestamp: Date.now(),
      userId: 'remote-user-id',
      frameNumber: 1,
      bodies: [{
        entityId: 'test-entity',
        position: [NaN, 1, 1] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        timestamp: Date.now(),
      }],
    });

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should reject invalid position values (Infinity)', () => {
    const onPhysicsState = (replicationClient.onPhysicsState as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const errorHandler = (physicsSync as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    onPhysicsState({
      type: 'physics-state',
      timestamp: Date.now(),
      userId: 'remote-user-id',
      frameNumber: 1,
      bodies: [{
        entityId: 'test-entity',
        position: [Infinity, 1, 1] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        timestamp: Date.now(),
      }],
    });

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should reject invalid timestamp (future)', () => {
    const onPhysicsState = (replicationClient.onPhysicsState as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const errorHandler = (physicsSync as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    onPhysicsState({
      type: 'physics-state',
      timestamp: Date.now(),
      userId: 'remote-user-id',
      frameNumber: 1,
      bodies: [{
        entityId: 'test-entity',
        position: [1, 1, 1] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        timestamp: Date.now() + 2000, // 2 seconds in future
      }],
    });

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should reject invalid timestamp (too old)', () => {
    const onPhysicsState = (replicationClient.onPhysicsState as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const errorHandler = (physicsSync as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    onPhysicsState({
      type: 'physics-state',
      timestamp: Date.now(),
      userId: 'remote-user-id',
      frameNumber: 1,
      bodies: [{
        entityId: 'test-entity',
        position: [1, 1, 1] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        timestamp: Date.now() - 10000, // 10 seconds ago
      }],
    });

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should handle null message gracefully', () => {
    const onPhysicsState = (replicationClient.onPhysicsState as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const errorHandler = (physicsSync as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    // @ts-expect-error - Testing invalid input
    onPhysicsState(null);

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should handle invalid bodies array', () => {
    const onPhysicsState = (replicationClient.onPhysicsState as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const errorHandler = (physicsSync as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    onPhysicsState({
      type: 'physics-state',
      timestamp: Date.now(),
      userId: 'remote-user-id',
      frameNumber: 1,
      bodies: null as any,
    });

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should reset state for reconnection', () => {
    const entity = scene.createEntity('DynamicBody');
    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Dynamic;
    entity.addComponent(physics);

    physicsSync.update(0.2);
    
    physicsSync.resetForReconnection();
    
    // Remote states should be cleared
    const remoteStates = (physicsSync as any).remotePhysicsStates;
    expect(remoteStates.size).toBe(0);
    
    // Last sent snapshot should be cleared
    const lastSentSnapshot = (physicsSync as any).lastSentSnapshot;
    expect(lastSentSnapshot).toBeNull();
  });
});

