/**
 * Integration tests for spawn point detection system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scene, Entity, SpawnPointComponent } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { RaycastHit } from '@engine/world/physics';
import { SpawnPointSystem } from '../../editor/systems/SpawnPointSystem';
import type { Vec3 } from '@engine/core/math';

describe('Spawn Detection Integration', () => {
  let scene: Scene;
  let mockPhysicsWorld: PhysicsWorld;

  beforeEach(() => {
    scene = new Scene();
    
    // Mock physics world
    mockPhysicsWorld = {
      raycast: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      update: vi.fn(),
      raycastAll: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('User-defined Spawn Points', () => {
    it('should spawn player at SpawnPointComponent position', () => {
      // Create spawn point entity
      const spawnEntity = new Entity('PlayerStart');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnComponent.rotation = Math.PI / 2; // 90 degrees
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [10, 5, 15];
      scene.addEntity(spawnEntity);

      // Find spawn point
      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      expect(result.source).toBe('user-defined');
      expect(result.position).toEqual([10, 5, 15]);
      expect(result.rotation).toBe(Math.PI / 2);
    });

    it('should use first default spawn point when multiple exist', () => {
      // Create two spawn points
      const spawn1 = new Entity('Spawn1');
      const component1 = new SpawnPointComponent();
      component1.isDefault = true;
      spawn1.addComponent(component1);
      spawn1.transform.position = [5, 2, 3];
      scene.addEntity(spawn1);

      const spawn2 = new Entity('Spawn2');
      const component2 = new SpawnPointComponent();
      component2.isDefault = true;
      spawn2.addComponent(component2);
      spawn2.transform.position = [10, 5, 10];
      scene.addEntity(spawn2);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      // Should use first one
      expect(result.source).toBe('user-defined');
      expect(result.position).toEqual([5, 2, 3]);
    });

    it('should use first spawn point if none marked as default', () => {
      // Create spawn points without default flag
      const spawn1 = new Entity('Spawn1');
      const component1 = new SpawnPointComponent();
      component1.isDefault = false;
      spawn1.addComponent(component1);
      spawn1.transform.position = [3, 3, 3];
      scene.addEntity(spawn1);

      const spawn2 = new Entity('Spawn2');
      const component2 = new SpawnPointComponent();
      component2.isDefault = false;
      spawn2.addComponent(component2);
      spawn2.transform.position = [7, 7, 7];
      scene.addEntity(spawn2);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      expect(result.source).toBe('user-defined');
      expect(result.position).toEqual([3, 3, 3]);
    });
  });

  describe('Raycast Fallback', () => {
    it('should spawn player on solid block via raycast', () => {
      // No spawn point entities
      
      // Mock raycast to hit ground
      const mockHit: RaycastHit = {
        entity: null as any,
        physics: null as any,
        colliderIndex: 0,
        distance: 8.0,
        point: [0, 2, 0],
        normal: [0, 1, 0],
      };
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(mockHit);

      const cameraPosition: Vec3 = [0, 10, 0];
      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, cameraPosition);

      expect(result.source).toBe('raycast-fallback');
      expect(result.position[1]).toBe(2.1); // Slightly above ground (0.1 offset)
      expect(result.rotation).toBe(0);
      
      // Verify raycast was called downward from camera
      expect(mockPhysicsWorld.raycast).toHaveBeenCalledWith(
        [0, 10, 0],
        [0, -1, 0],
        expect.objectContaining({ maxDistance: 100 })
      );
    });

    it('should not spawn player in air (always on solid ground)', () => {
      // Mock raycast miss (no ground below)
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      // Should fall back to default origin
      expect(result.source).toBe('default-origin');
      expect(result.position).toEqual([0, 1, 0]); // Default spawn slightly above origin
    });

    it('should prioritize user-defined spawn over raycast', () => {
      // Create spawn point
      const spawnEntity = new Entity('PlayerStart');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [100, 50, 100];
      scene.addEntity(spawnEntity);

      // Mock raycast to return a different position
      const mockHit: RaycastHit = {
        entity: null as any,
        physics: null as any,
        colliderIndex: 0,
        distance: 5.0,
        point: [0, 2, 0],
        normal: [0, 1, 0],
      };
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(mockHit);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      // Should use user-defined, not raycast
      expect(result.source).toBe('user-defined');
      expect(result.position).toEqual([100, 50, 100]);
      
      // Raycast should not have been called
      expect(mockPhysicsWorld.raycast).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle scene with no physics world', () => {
      const result = SpawnPointSystem.findSpawnPoint(scene, null, [0, 10, 0]);

      expect(result.source).toBe('default-origin');
      expect(result.position).toEqual([0, 1, 0]);
    });

    it('should handle scene with no fallback position', () => {
      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld);

      // Without fallback position, cannot raycast
      expect(result.source).toBe('default-origin');
    });

    it('should handle spawn point at world origin', () => {
      const spawnEntity = new Entity('Origin');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [0, 0, 0];
      scene.addEntity(spawnEntity);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      expect(result.source).toBe('user-defined');
      expect(result.position).toEqual([0, 0, 0]);
    });

    it('should handle spawn point with negative coordinates', () => {
      const spawnEntity = new Entity('NegativeSpawn');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [-50, -10, -30];
      scene.addEntity(spawnEntity);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      expect(result.source).toBe('user-defined');
      expect(result.position).toEqual([-50, -10, -30]);
    });

    it('should handle very high camera positions', () => {
      // Mock raycast to return null when distance exceeds maxDistance (100)
      // Since camera is at y=1000 and maxDistance is 100, raycast should return null
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const cameraPosition: Vec3 = [0, 1000, 0]; // Very high
      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, cameraPosition);

      expect(result.source).toBe('default-origin'); // Exceeds default maxDistance of 100
      expect(result.position).toEqual([0, 1, 0]);
    });

    it('should handle raycast with custom max distance', () => {
      const mockHit: RaycastHit = {
        entity: null as any,
        physics: null as any,
        colliderIndex: 0,
        distance: 50.0,
        point: [0, -40, 0],
        normal: [0, 1, 0],
      };
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(mockHit);

      const cameraPosition: Vec3 = [0, 10, 0];
      const result = SpawnPointSystem.findSpawnViaRaycast(mockPhysicsWorld, cameraPosition, 200);

      expect(result).not.toBeNull();
      expect(result?.source).toBe('raycast-fallback');
    });
  });

  describe('Spawn Validation', () => {
    it('should validate spawn position with ground beneath', () => {
      const mockHit: RaycastHit = {
        entity: null as any,
        physics: null as any,
        colliderIndex: 0,
        distance: 1.0,
        point: [0, -1, 0],
        normal: [0, 1, 0],
      };
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(mockHit);

      const position: Vec3 = [0, 1, 0];
      const isValid = SpawnPointSystem.isValidSpawnPosition(mockPhysicsWorld, position);

      expect(isValid).toBe(true);
    });

    it('should invalidate spawn position without ground', () => {
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const position: Vec3 = [0, 100, 0];
      const isValid = SpawnPointSystem.isValidSpawnPosition(mockPhysicsWorld, position);

      expect(isValid).toBe(false);
    });
  });

  describe('Integration with Play Mode', () => {
    it('should provide rotation from spawn point', () => {
      const spawnEntity = new Entity('PlayerStart');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnComponent.rotation = Math.PI; // 180 degrees (facing -Z)
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [0, 2, 0];
      scene.addEntity(spawnEntity);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      expect(result.rotation).toBe(Math.PI);
    });

    it('should provide default rotation when using raycast', () => {
      const mockHit: RaycastHit = {
        entity: null as any,
        physics: null as any,
        colliderIndex: 0,
        distance: 5.0,
        point: [0, 0, 0],
        normal: [0, 1, 0],
      };
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(mockHit);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      expect(result.rotation).toBe(0); // Default rotation
    });
  });
});

