import type { CustomMeshData } from '@engine/world';
/**
 * Shoulder width ratio relative to torso core width.
 * This is the style ABI for avatar torso proportions.
 * Artists and community content creators should reference this value.
 *
 * shoulderShelfWidthX ≈ 1.35 * torsoCoreWidthX
 */
export declare const SHOULDER_TO_TORSO_RATIO = 1.35;
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
 * @returns CustomMeshData with vertices, normals, and indices
 */
export declare function generateHeroicTorsoMesh(): CustomMeshData;
//# sourceMappingURL=torso-geometry.d.ts.map