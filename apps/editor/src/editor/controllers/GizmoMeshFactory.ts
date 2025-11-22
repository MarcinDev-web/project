import type { CustomMeshData } from '@engine/world';
import {
  generateCylinderMesh,
  generateBoxMesh,
  generateTorusMesh,
  generatePlaneMesh,
} from '@engine/gfx-webgpu/utils/geometry';

export class GizmoMeshFactory {
  static createArrowShaftMesh(length: number, radius: number): CustomMeshData {
    // Cylinder for the shaft
    return generateCylinderMesh(radius, radius, length, 12, 1, false);
  }

  static createArrowHeadMesh(length: number, radius: number): CustomMeshData {
    // Cone for the head (cylinder with top radius 0)
    return generateCylinderMesh(0, radius, length, 12, 1, false);
  }

  static createRingMesh(radius: number, tubeRadius: number): CustomMeshData {
    // Torus for rotation
    // We need slightly higher segments for smooth rotation rings
    return generateTorusMesh(radius, tubeRadius, 8, 32, Math.PI * 2);
  }

  static createScaleBoxMesh(size: number): CustomMeshData {
    // Box for scale handles
    return generateBoxMesh(size, size, size, 1);
  }

  static createPlaneHandleMesh(size: number): CustomMeshData {
    // Plane for planar movement
    // Offset is handled by entity transform, so just a centered plane here
    return generatePlaneMesh(size, size, 1);
  }

  /**
   * Merges multiple meshes into one.
   * Useful if we want to combine shaft and head into a single mesh,
   * but for now keeping them separate allows different materials/colors if needed
   * or simpler hit testing logic (though we'll likely use a parent collider).
   */
  static mergeMeshes(meshes: CustomMeshData[], _transforms?: Float32Array[]): CustomMeshData {
    // Placeholder for potential optimization
    // For now, we'll return the first one or implement full merge if needed
    if (meshes.length === 0) throw new Error('No meshes to merge');
    return meshes[0]!;
  }
}

