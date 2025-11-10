import type { CustomMeshData } from '@engine/world';
import { generateHeroicTorsoMesh } from '../geometry/torso-geometry';
import { generateSphereMesh } from '../geometry/sphere-geometry';
import { generateCapsuleY } from '../geometry/capsule-geometry';

export interface AvatarMeshGeneratorOptions {
  sphereSegments?: number;
}

/**
 * Generates procedural meshes for avatar parts.
 * Handles 'avatar_torso' and 'sphere' mesh types.
 */
export class AvatarMeshGenerator {
  private readonly sphereSegments: number;

  constructor(options: AvatarMeshGeneratorOptions = {}) {
    this.sphereSegments = options.sphereSegments ?? 16;
  }

  /**
   * Generate mesh data for a procedural mesh type.
   * 
   * @param meshType - Type of mesh to generate ('avatar_torso' | 'sphere' | 'capsule_y')
   * @param partId - ID of the part (for error messages)
   * @returns Mesh data or null if the mesh type is not procedural or generation failed
   */
  generateMesh(meshType: string, partId: string): CustomMeshData | null {
    if (meshType === 'avatar_torso') {
      return this.generateTorsoMesh(partId);
    } else if (meshType === 'sphere') {
      return this.generateSphereMesh(partId);
    } else if (meshType === 'capsule_y') {
      return this.generateCapsuleY(partId);
    }
    // Not a procedural mesh type - return null
    return null;
  }

  private generateTorsoMesh(partId: string): CustomMeshData | null {
    try {
      const mesh = generateHeroicTorsoMesh();
      if (!mesh.vertices || !mesh.indices) {
        console.error(
          `[AvatarMeshGenerator] Generated invalid torso mesh for part "${partId}" - missing vertices or indices`,
        );
        return null;
      }
      return mesh;
    } catch (error) {
      console.error(
        `[AvatarMeshGenerator] Failed to generate torso mesh for part "${partId}":`,
        error,
      );
      return null;
    }
  }

  private generateSphereMesh(partId: string): CustomMeshData | null {
    try {
      const mesh = generateSphereMesh(this.sphereSegments);
      if (!mesh.vertices || !mesh.indices) {
        console.error(
          `[AvatarMeshGenerator] Generated invalid sphere mesh for part "${partId}" - missing vertices or indices`,
        );
        return null;
      }
      return mesh;
    } catch (error) {
      console.error(
        `[AvatarMeshGenerator] Failed to generate sphere mesh for part "${partId}":`,
        error,
      );
      return null;
    }
  }

  private generateCapsuleY(partId: string): CustomMeshData | null {
    try {
      const mesh = generateCapsuleY(0.5, 1.0, Math.max(8, this.sphereSegments), Math.max(4, Math.floor(this.sphereSegments / 2)));
      if (!mesh.vertices || !mesh.indices) {
        console.error(
          `[AvatarMeshGenerator] Generated invalid capsule_y mesh for part "${partId}" - missing vertices or indices`,
        );
        return null;
      }
      return mesh;
    } catch (error) {
      console.error(
        `[AvatarMeshGenerator] Failed to generate capsule_y mesh for part "${partId}":`,
        error,
      );
      return null;
    }
  }
}

