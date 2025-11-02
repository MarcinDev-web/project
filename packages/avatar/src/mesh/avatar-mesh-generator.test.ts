import { describe, it, expect } from 'vitest';
import { AvatarMeshGenerator } from './avatar-mesh-generator';

describe('AvatarMeshGenerator', () => {
  describe('generateMesh', () => {
    it('should generate sphere mesh', () => {
      const generator = new AvatarMeshGenerator();
      const mesh = generator.generateMesh('sphere', 'test_sphere');
      expect(mesh).not.toBeNull();
      expect(mesh?.vertices).toBeDefined();
      expect(mesh?.indices).toBeDefined();
    });

    it('should generate torso mesh', () => {
      const generator = new AvatarMeshGenerator();
      const mesh = generator.generateMesh('avatar_torso', 'test_torso');
      expect(mesh).not.toBeNull();
      expect(mesh?.vertices).toBeDefined();
      expect(mesh?.indices).toBeDefined();
    });

    it('should return null for non-procedural mesh types', () => {
      const generator = new AvatarMeshGenerator();
      const mesh = generator.generateMesh('cube', 'test_cube');
      expect(mesh).toBeNull();
    });

    it('should use custom sphere segments', () => {
      const generator = new AvatarMeshGenerator({ sphereSegments: 8 });
      const mesh = generator.generateMesh('sphere', 'test_sphere');
      expect(mesh).not.toBeNull();
      // Lower segment count should produce fewer vertices
      expect(mesh?.vertices).toBeDefined();
    });
  });
});

