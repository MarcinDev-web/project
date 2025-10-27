import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpawnPointSystem } from '../SpawnPointSystem';
import { Scene, Entity, SpawnPointComponent } from '@engine/world';
import type { PhysicsWorld, RaycastHit } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

describe('SpawnPointSystem', () => {
  let scene: Scene;
  let mockPhysicsWorld: PhysicsWorld;

  beforeEach(() => {
    scene = new Scene();
    
    // Mock physics world
    mockPhysicsWorld = {
      raycast: vi.fn(),
    } as any;
  });

  describe('findDefaultSpawnPoint', () => {
    it('should find entity with default spawn point', () => {
      const spawnEntity = new Entity('SpawnPoint1');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [5, 2, 3];
      scene.addEntity(spawnEntity);

      const result = SpawnPointSystem.findDefaultSpawnPoint(scene);

      expect(result).toBe(spawnEntity);
    });

    it('should return first default spawn point when multiple exist', () => {
      const spawnEntity1 = new Entity('SpawnPoint1');
      const spawnComponent1 = new SpawnPointComponent();
      spawnComponent1.isDefault = true;
      spawnEntity1.addComponent(spawnComponent1);
      scene.addEntity(spawnEntity1);

      const spawnEntity2 = new Entity('SpawnPoint2');
      const spawnComponent2 = new SpawnPointComponent();
      spawnComponent2.isDefault = true;
      spawnEntity2.addComponent(spawnComponent2);
      scene.addEntity(spawnEntity2);

      const result = SpawnPointSystem.findDefaultSpawnPoint(scene);

      // Should return first one found
      expect(result).toBe(spawnEntity1);
    });

    it('should return first spawn point if none marked as default', () => {
      const spawnEntity1 = new Entity('SpawnPoint1');
      const spawnComponent1 = new SpawnPointComponent();
      spawnComponent1.isDefault = false;
      spawnEntity1.addComponent(spawnComponent1);
      scene.addEntity(spawnEntity1);

      const spawnEntity2 = new Entity('SpawnPoint2');
      const spawnComponent2 = new SpawnPointComponent();
      spawnComponent2.isDefault = false;
      spawnEntity2.addComponent(spawnComponent2);
      scene.addEntity(spawnEntity2);

      const result = SpawnPointSystem.findDefaultSpawnPoint(scene);

      expect(result).toBe(spawnEntity1);
    });

    it('should return null if no spawn points exist', () => {
      const result = SpawnPointSystem.findDefaultSpawnPoint(scene);

      expect(result).toBeNull();
    });

    it('should ignore entities without spawn component', () => {
      const regularEntity = new Entity('Regular');
      scene.addEntity(regularEntity);

      const result = SpawnPointSystem.findDefaultSpawnPoint(scene);

      expect(result).toBeNull();
    });
  });

  describe('findSpawnViaRaycast', () => {
    it('should find spawn point via raycast', () => {
      const mockHit: RaycastHit = {
        entity: null as any,
        distance: 5.0,
        point: [10, 0, 10],
        normal: [0, 1, 0],
        collider: null as any,
      };

      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(mockHit);

      const referencePosition: Vec3 = [10, 10, 10];
      const result = SpawnPointSystem.findSpawnViaRaycast(
        mockPhysicsWorld,
        referencePosition
      );

      expect(result).not.toBeNull();
      expect(result?.position[0]).toBe(10);
      expect(result?.position[1]).toBe(0.1); // Slightly above hit point
      expect(result?.position[2]).toBe(10);
      expect(result?.rotation).toBe(0);
      expect(result?.source).toBe('raycast-fallback');
    });

    it('should cast ray downward', () => {
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const referencePosition: Vec3 = [5, 10, 5];
      SpawnPointSystem.findSpawnViaRaycast(mockPhysicsWorld, referencePosition);

      expect(mockPhysicsWorld.raycast).toHaveBeenCalledWith(
        [5, 10, 5],
        [0, -1, 0],
        expect.objectContaining({
          maxDistance: 100,
          hitTriggers: false,
        })
      );
    });

    it('should return null if raycast misses', () => {
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const referencePosition: Vec3 = [0, 10, 0];
      const result = SpawnPointSystem.findSpawnViaRaycast(
        mockPhysicsWorld,
        referencePosition
      );

      expect(result).toBeNull();
    });

    it('should use custom max distance', () => {
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const referencePosition: Vec3 = [0, 10, 0];
      SpawnPointSystem.findSpawnViaRaycast(
        mockPhysicsWorld,
        referencePosition,
        50
      );

      expect(mockPhysicsWorld.raycast).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ maxDistance: 50 })
      );
    });
  });

  describe('findSpawnPoint', () => {
    it('should prefer user-defined spawn point', () => {
      const spawnEntity = new Entity('SpawnPoint');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnComponent.rotation = Math.PI / 2;
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [5, 2, 3];
      scene.addEntity(spawnEntity);

      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld, [0, 10, 0]);

      expect(result.source).toBe('user-defined');
      expect(result.position).toEqual([5, 2, 3]);
      expect(result.rotation).toBe(Math.PI / 2);
    });

    it('should fall back to raycast when no spawn point exists', () => {
      const mockHit: RaycastHit = {
        entity: null as any,
        distance: 5.0,
        point: [0, 0, 0],
        normal: [0, 1, 0],
        collider: null as any,
      };

      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(mockHit);

      const result = SpawnPointSystem.findSpawnPoint(
        scene,
        mockPhysicsWorld,
        [0, 10, 0]
      );

      expect(result.source).toBe('raycast-fallback');
      expect(result.position[1]).toBe(0.1); // Slightly above ground
    });

    it('should use default origin when everything fails', () => {
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const result = SpawnPointSystem.findSpawnPoint(
        scene,
        mockPhysicsWorld,
        [0, 10, 0]
      );

      expect(result.source).toBe('default-origin');
      expect(result.position).toEqual([0, 1, 0]);
      expect(result.rotation).toBe(0);
    });

    it('should work without physics world', () => {
      const result = SpawnPointSystem.findSpawnPoint(scene);

      expect(result.source).toBe('default-origin');
      expect(result.position).toEqual([0, 1, 0]);
    });

    it('should work without fallback position', () => {
      const result = SpawnPointSystem.findSpawnPoint(scene, mockPhysicsWorld);

      // Without fallback position, cannot raycast
      expect(result.source).toBe('default-origin');
    });
  });

  describe('isValidSpawnPosition', () => {
    it('should return true if ground exists beneath position', () => {
      const mockHit: RaycastHit = {
        entity: null as any,
        distance: 1.0,
        point: [0, -1, 0],
        normal: [0, 1, 0],
        collider: null as any,
      };

      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(mockHit);

      const position: Vec3 = [0, 1, 0];
      const result = SpawnPointSystem.isValidSpawnPosition(
        mockPhysicsWorld,
        position
      );

      expect(result).toBe(true);
    });

    it('should return false if no ground beneath position', () => {
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const position: Vec3 = [0, 10, 0];
      const result = SpawnPointSystem.isValidSpawnPosition(
        mockPhysicsWorld,
        position
      );

      expect(result).toBe(false);
    });

    it('should cast ray downward within max distance', () => {
      vi.mocked(mockPhysicsWorld.raycast).mockReturnValue(null);

      const position: Vec3 = [5, 5, 5];
      SpawnPointSystem.isValidSpawnPosition(mockPhysicsWorld, position);

      expect(mockPhysicsWorld.raycast).toHaveBeenCalledWith(
        [5, 5, 5],
        [0, -1, 0],
        expect.objectContaining({ maxDistance: 2.0 })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty scene', () => {
      const result = SpawnPointSystem.findSpawnPoint(scene);

      expect(result).toBeDefined();
      expect(result.source).toBe('default-origin');
    });

    it('should handle spawn point at origin', () => {
      const spawnEntity = new Entity('SpawnPoint');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [0, 0, 0];
      scene.addEntity(spawnEntity);

      const result = SpawnPointSystem.findSpawnPoint(scene);

      expect(result.source).toBe('user-defined');
      expect(result.position).toEqual([0, 0, 0]);
    });

    it('should handle negative spawn coordinates', () => {
      const spawnEntity = new Entity('SpawnPoint');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnEntity.addComponent(spawnComponent);
      spawnEntity.transform.position = [-10, -5, -20];
      scene.addEntity(spawnEntity);

      const result = SpawnPointSystem.findSpawnPoint(scene);

      expect(result.position).toEqual([-10, -5, -20]);
    });
  });
});

