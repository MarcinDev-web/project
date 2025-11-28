import type { CustomMeshData, MeshKind } from '@engine/world';
import { generateHeroicTorsoMesh } from '../geometry/torso-geometry';
import { generateSphereMesh } from '../geometry/sphere-geometry';
import { generateCapsuleY } from '../geometry/capsule-geometry';
import { 
  initWasmMeshGenerator, 
  isWasmAvailable,
  generateSphereWasm,
  generateCapsuleWasm,
  generateTorsoWasm,
} from './wasm-mesh-generator';

export interface AvatarMeshGeneratorOptions {
  sphereSegments?: number;
  /** Enable WASM acceleration (default: true) */
  useWasm?: boolean;
}

/**
 * Supported procedural mesh types for avatar generation.
 */
export type ProceduralMeshType = 'avatar_torso' | 'sphere' | 'capsule_y';

/**
 * Type guard to check if a mesh type is procedural.
 */
function isProceduralMeshType(meshType: MeshKind): meshType is ProceduralMeshType {
  return meshType === 'avatar_torso' || meshType === 'sphere' || meshType === 'capsule_y';
}

/**
 * Generates procedural meshes for avatar parts.
 * Handles 'avatar_torso', 'sphere', and 'capsule_y' mesh types.
 * 
 * Uses WASM acceleration when available for 5-10x performance improvement.
 */
export class AvatarMeshGenerator {
  private readonly sphereSegments: number;
  private readonly useWasm: boolean;
  private static readonly cache = new Map<string, CustomMeshData>();
  private static wasmInitialized = false;

  constructor(options: AvatarMeshGeneratorOptions = {}) {
    const segments = options.sphereSegments ?? 16;
    if (segments < 3) {
      throw new Error(
        `[AvatarMeshGenerator] sphereSegments must be >= 3 (got ${segments})`,
      );
    }
    this.sphereSegments = segments;
    this.useWasm = options.useWasm ?? true;
    
    // Initialize WASM in background (non-blocking)
    if (this.useWasm && !AvatarMeshGenerator.wasmInitialized) {
      AvatarMeshGenerator.wasmInitialized = true;
      initWasmMeshGenerator().catch(() => {
        // WASM init failed - will use TS fallback
      });
    }
  }

  /**
   * Generate mesh data for a procedural mesh type.
   * 
   * @param meshType - Type of mesh to generate (accepts any MeshKind, but only generates procedural types)
   * @param partId - ID of the part (for error messages)
   * @returns Mesh data or null if the mesh type is not procedural or generation failed
   */
  generateMesh(meshType: MeshKind, partId: string): CustomMeshData | null {
    if (!isProceduralMeshType(meshType)) {
      // Not a procedural mesh type - return null
      return null;
    }

    // Check cache
    const cacheKey = this.getCacheKey(meshType);
    if (AvatarMeshGenerator.cache.has(cacheKey)) {
      const cached = AvatarMeshGenerator.cache.get(cacheKey)!;
      console.log(`[AvatarMeshGenerator] Cache hit for ${meshType}:${partId}, vertices=${cached.vertices?.length}, indices=${cached.indices?.length}`);
      return cached;
    }

    let mesh: CustomMeshData | null = null;
    if (meshType === 'avatar_torso') {
      mesh = this.generateTorsoMesh(partId);
    } else if (meshType === 'sphere') {
      mesh = this.generateSphereMesh(partId);
    } else if (meshType === 'capsule_y') {
      mesh = this.generateCapsuleY(partId);
    }

    if (mesh) {
      console.log(`[AvatarMeshGenerator] Generated ${meshType} for ${partId}: vertices=${mesh.vertices?.length}, indices=${mesh.indices?.length}`);
      AvatarMeshGenerator.cache.set(cacheKey, mesh);
    } else {
      console.warn(`[AvatarMeshGenerator] Failed to generate ${meshType} for ${partId}`);
    }
    return mesh;
  }

  private getCacheKey(meshType: ProceduralMeshType): string {
    if (meshType === 'avatar_torso') {
      return 'avatar_torso'; // Torso doesn't depend on segments
    }
    return `${meshType}:${this.sphereSegments}`;
  }

  private generateTorsoMesh(partId: string): CustomMeshData | null {
    try {
      // Try WASM first
      if (this.useWasm && isWasmAvailable()) {
        const wasmMesh = generateTorsoWasm();
        if (wasmMesh?.vertices && wasmMesh?.indices) {
          return wasmMesh;
        }
      }
      
      // Fallback to TypeScript
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
      // Try WASM first
      if (this.useWasm && isWasmAvailable()) {
        const wasmMesh = generateSphereWasm(this.sphereSegments);
        if (wasmMesh?.vertices && wasmMesh?.indices) {
          return wasmMesh;
        }
      }
      
      // Fallback to TypeScript
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
      // Try WASM first
      if (this.useWasm && isWasmAvailable()) {
        const radialSegments = Math.max(8, this.sphereSegments);
        const hemisphereSegments = Math.max(4, Math.floor(this.sphereSegments / 2));
        const wasmMesh = generateCapsuleWasm(0.5, 1.0, radialSegments, hemisphereSegments);
        if (wasmMesh?.vertices && wasmMesh?.indices) {
          return wasmMesh;
        }
      }
      
      // Fallback to TypeScript
      const mesh = generateCapsuleY({
        radius: 0.5,
        cylinderHeight: 1.0,
        radialSegments: Math.max(8, this.sphereSegments),
        hemisphereSegments: Math.max(4, Math.floor(this.sphereSegments / 2)),
      });
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

