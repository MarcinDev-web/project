import type { CustomMeshData } from '@engine/world';
/**
 * Vertex stride for interleaved mesh data format.
 * Format: [x, y, z, nx, ny, nz, u, v] = 8 floats per vertex
 */
export declare const VERTEX_STRIDE_FLOATS = 8;
/**
 * Shoulder width ratio relative to torso core width.
 * This is the style ABI for avatar torso proportions.
 * Artists and community content creators should reference this value.
 *
 * shoulderShelfWidthX ≈ 1.35 * torsoCoreWidthX
 */
export declare const SHOULDER_TO_TORSO_RATIO = 1.35;
/**
 * Default torso geometry parameters
 */
export interface TorsoGeometryParams {
  /** Lower torso width (relative to full width) */
  lowerWidth?: number;
  /** Lower torso height (relative to total height) */
  lowerHeight?: number;
  /** Lower torso depth */
  lowerDepth?: number;
  /** Shoulder width multiplier relative to torso core */
  shoulderWidthRatio?: number;
  /** Shoulder height (relative to total height) */
  shoulderHeight?: number;
  /** Shoulder depth */
  shoulderDepth?: number;
  /** Overlap between lower torso and shoulder shelf (for seamless blend) */
  shoulderOverlap?: number;
  /** Vertical offset of lower torso center */
  lowerCenterY?: number;
}
/**
 * Generates a heroic torso mesh with compound geometry:
 * - Lower torso: main body (narrower)
 * - Upper shoulder shelf: wider horizontal block (pauldron-like)
 *
 * This creates an action-figure silhouette with proper attachment points
 * for upper arms. The shoulder shelf provides 5-10% visual overlap with
 * UpperArm joints in T-pose for organic appearance.
 *
 * The mesh is designed to be scaled by the avatar system's localScale,
 * so dimensions here are in unit space (will be multiplied by scale).
 *
 * @param params - Optional geometry parameters (uses defaults if not provided)
 * @returns CustomMeshData with vertices, normals, and indices
 */
export declare function generateHeroicTorsoMesh(params?: TorsoGeometryParams): CustomMeshData;
//# sourceMappingURL=torso-geometry.d.ts.map