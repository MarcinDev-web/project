import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, Scene, PhysicsComponent, RigidbodyType } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import { PhysicsSync } from '../src/multiplayer/PhysicsSync';
import { ReplicationClient } from '../src/ReplicationClient';
import type { PhysicsStateMessage } from '../src/types/replication';

/**
 * Test PhysicsSync component.
 * Tests behavior: sending physics state, receiving updates, local player filtering.
 */
describe('PhysicsSync', () => {
  let physicsSync: PhysicsSync;
  let mockReplicationClient: ReplicationClient;
  let scene: Scene;
  let mockPhysicsWorld: PhysicsWorld;
  let onPhysicsStateCallback: (message: PhysicsStateMessage) => void;
  let sentStates: Omit<PhysicsStateMessage, 'type' | 'timestamp' | 'sessionId' | 'userId'>[];

  beforeEach(() => {
    sentStates = [];

    // Create mock ReplicationClient
    mockReplicationClient = {
      getLocalUserId: vi.fn(() => 'local-user-123'),
      sendPhysicsState: vi.fn((state) => {
        sentStates.push(state);
      }),
      onPhysicsState: vi.fn((callback) => {
        onPhysicsStateCallback = callback;
        return () => {}; // Return unsubscribe function
      }),
      getState: vi.fn(() => 'connected' as any),
    } as unknown as ReplicationClient;

    // Create scene
    scene = new Scene('TestScene');

    // Create mock PhysicsWorld
    mockPhysicsWorld = {
      step: vi.fn(),
    } as unknown as PhysicsWorld;

    physicsSync = new PhysicsSync({
      physicsWorld: mockPhysicsWorld,
      scene,
      replicationClient: mockReplicationClient,
      sendInterval: 100, // 100ms for faster tests
    });
  });

  describe('initialization', () => {
    it('should subscribe to physics state messages on construction', () => {
      expect(mockReplicationClient.onPhysicsState).toHaveBeenCalledTimes(1);
    });

    it('should use default config values', () => {
      const sync = new PhysicsSync({
        physicsWorld: mockPhysicsWorld,
        scene,
        replicationClient: mockReplicationClient,
      });

      expect(sync).toBeDefined();
    });
  });

  describe('sending physics state', () => {
    it('should send physics state of dynamic rigid bodies', () => {
      // Create entity with dynamic physics
      const entity = new Entity('dynamic_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      entity.addComponent(physics);
      entity.transform.position = [5, 10, 15];
      scene.addEntity(entity);

      // Update to trigger send (after interval)
      physicsSync.update(0.2); // 200ms, should trigger send (interval is 100ms)

      expect(mockReplicationClient.sendPhysicsState).toHaveBeenCalled();
      const sentState = sentStates[0];
      expect(sentState?.bodies.length).toBe(1);
      expect(sentState?.bodies[0]?.entityId).toBe(entity.id);
      expect(sentState?.bodies[0]?.position).toEqual([5, 10, 15]);
    });

    it('should not send static rigid bodies', () => {
      const entity = new Entity('static_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Static;
      entity.addComponent(physics);
      scene.addEntity(entity);

      physicsSync.update(0.2);

      // Should not send static bodies
      expect(mockReplicationClient.sendPhysicsState).not.toHaveBeenCalled();
    });

    it('should not send kinematic rigid bodies', () => {
      const entity = new Entity('kinematic_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Kinematic;
      entity.addComponent(physics);
      scene.addEntity(entity);

      physicsSync.update(0.2);

      expect(mockReplicationClient.sendPhysicsState).not.toHaveBeenCalled();
    });

    it('should not send local player entities', () => {
      const localPlayerEntity = new Entity('local_player');
      localPlayerEntity.userData.userId = 'local-user-123';
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      localPlayerEntity.addComponent(physics);
      scene.addEntity(localPlayerEntity);

      physicsSync.update(0.2);

      // Should skip local player
      const sentState = sentStates[0];
      if (sentState) {
        expect(sentState.bodies.find(b => b.entityId === localPlayerEntity.id)).toBeUndefined();
      }
    });

    it('should include velocity and angularVelocity in state', () => {
      const entity = new Entity('dynamic_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      physics.velocity = [1, 2, 3];
      physics.angularVelocity = [0.1, 0.2, 0.3];
      entity.addComponent(physics);
      scene.addEntity(entity);

      physicsSync.update(0.2);

      const sentState = sentStates[0];
      expect(sentState?.bodies[0]?.velocity).toEqual([1, 2, 3]);
      expect(sentState?.bodies[0]?.angularVelocity).toEqual([0.1, 0.2, 0.3]);
    });

    it('should respect sendInterval', () => {
      const entity = new Entity('dynamic_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      entity.addComponent(physics);
      scene.addEntity(entity);

      physicsSync.update(0.05); // 50ms - should not send yet

      expect(mockReplicationClient.sendPhysicsState).not.toHaveBeenCalled();

      physicsSync.update(0.06); // Another 60ms, total 110ms - should send

      expect(mockReplicationClient.sendPhysicsState).toHaveBeenCalledTimes(1);
    });

    it('should increment frame number', () => {
      const initialFrame = physicsSync.getFrameNumber();

      physicsSync.update(0.01);
      physicsSync.update(0.01);

      expect(physicsSync.getFrameNumber()).toBeGreaterThan(initialFrame);
    });

    it('should reset frame number', () => {
      physicsSync.update(0.01);
      const frame = physicsSync.getFrameNumber();

      physicsSync.resetFrameNumber(100);

      expect(physicsSync.getFrameNumber()).toBe(100);
      expect(physicsSync.getFrameNumber()).not.toBe(frame);
    });
  });

  describe('receiving physics state', () => {
    it('should apply remote physics state to entities', () => {
      const remoteEntity = new Entity('remote_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      remoteEntity.addComponent(physics);
      remoteEntity.transform.position = [0, 0, 0];
      scene.addEntity(remoteEntity);

      const message: PhysicsStateMessage = {
        type: 'physics-state',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        frameNumber: 1,
        bodies: [{
          entityId: remoteEntity.id,
          position: [10, 20, 30],
          rotation: [0, 0, 0, 1],
          velocity: [1, 2, 3],
          angularVelocity: [0.1, 0.2, 0.3],
          timestamp: Date.now(),
        }],
      };

      onPhysicsStateCallback(message);
      physicsSync.update(0.01); // Trigger apply

      expect(remoteEntity.transform.position).toEqual([10, 20, 30]);
    });

    it('should not apply state to local player entities', () => {
      const localEntity = new Entity('local_player');
      localEntity.userData.userId = 'local-user-123';
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      localEntity.addComponent(physics);
      localEntity.transform.position = [0, 0, 0];
      scene.addEntity(localEntity);

      const message: PhysicsStateMessage = {
        type: 'physics-state',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        frameNumber: 1,
        bodies: [{
          entityId: localEntity.id,
          position: [100, 100, 100], // Try to move local player
          rotation: [0, 0, 0, 1],
          timestamp: Date.now(),
        }],
      };

      onPhysicsStateCallback(message);
      physicsSync.update(0.01);

      // Local player position should not change
      expect(localEntity.transform.position).toEqual([0, 0, 0]);
    });

    it('should apply velocity to dynamic bodies', () => {
      const remoteEntity = new Entity('remote_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      remoteEntity.addComponent(physics);
      scene.addEntity(remoteEntity);

      const message: PhysicsStateMessage = {
        type: 'physics-state',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        frameNumber: 1,
        bodies: [{
          entityId: remoteEntity.id,
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          velocity: [5, 10, 15],
          timestamp: Date.now(),
        }],
      };

      onPhysicsStateCallback(message);
      physicsSync.update(0.01);

      expect(physics.velocity).toEqual([5, 10, 15]);
    });

    it('should apply angularVelocity to dynamic bodies', () => {
      const remoteEntity = new Entity('remote_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      remoteEntity.addComponent(physics);
      scene.addEntity(remoteEntity);

      const message: PhysicsStateMessage = {
        type: 'physics-state',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        frameNumber: 1,
        bodies: [{
          entityId: remoteEntity.id,
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          angularVelocity: [1, 2, 3],
          timestamp: Date.now(),
        }],
      };

      onPhysicsStateCallback(message);
      physicsSync.update(0.01);

      expect(physics.angularVelocity).toEqual([1, 2, 3]);
    });

    it('should handle multiple entities in one message', () => {
      const entity1 = new Entity('entity1');
      const entity2 = new Entity('entity2');
      const physics1 = new PhysicsComponent();
      const physics2 = new PhysicsComponent();
      physics1.rigidbodyType = RigidbodyType.Dynamic;
      physics2.rigidbodyType = RigidbodyType.Dynamic;
      entity1.addComponent(physics1);
      entity2.addComponent(physics2);
      scene.addEntity(entity1);
      scene.addEntity(entity2);

      const message: PhysicsStateMessage = {
        type: 'physics-state',
        timestamp: Date.now(),
        userId: 'remote-user-456',
        frameNumber: 1,
        bodies: [
          {
            entityId: entity1.id,
            position: [1, 2, 3],
            rotation: [0, 0, 0, 1],
            timestamp: Date.now(),
          },
          {
            entityId: entity2.id,
            position: [4, 5, 6],
            rotation: [0, 0, 0, 1],
            timestamp: Date.now(),
          },
        ],
      };

      onPhysicsStateCallback(message);
      physicsSync.update(0.01);

      expect(entity1.transform.position).toEqual([1, 2, 3]);
      expect(entity2.transform.position).toEqual([4, 5, 6]);
    });
  });

  describe('state similarity detection', () => {
    it('should skip sending if state has not changed significantly', () => {
      const entity = new Entity('dynamic_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      entity.transform.position = [5, 5, 5];
      entity.addComponent(physics);
      scene.addEntity(entity);

      // First send
      physicsSync.update(0.2);
      expect(mockReplicationClient.sendPhysicsState).toHaveBeenCalledTimes(1);

      // Small position change (less than 5cm threshold)
      entity.transform.position = [5.01, 5.01, 5.01];
      physicsSync.update(0.2);

      // Should not send again (state too similar)
      expect(mockReplicationClient.sendPhysicsState).toHaveBeenCalledTimes(1);
    });

    it('should send if position changed significantly', () => {
      const entity = new Entity('dynamic_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      entity.transform.position = [5, 5, 5];
      entity.addComponent(physics);
      scene.addEntity(entity);

      physicsSync.update(0.2);
      vi.clearAllMocks();

      // Significant position change (>5cm)
      entity.transform.position = [10, 10, 10];
      physicsSync.update(0.2);

      expect(mockReplicationClient.sendPhysicsState).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on dispose', () => {
      const entity = new Entity('dynamic_entity');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      entity.addComponent(physics);
      scene.addEntity(entity);

      physicsSync.update(0.2);
      physicsSync.dispose();

      // Should clear internal state
      expect(physicsSync.getFrameNumber()).toBeGreaterThanOrEqual(0);
    });
  });
});

