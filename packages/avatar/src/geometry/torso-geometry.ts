import type { CustomMeshData } from '@engine/world';

/**
 * Shoulder width ratio relative to torso core width.
 * This is the style ABI for avatar torso proportions.
 * Artists and community content creators should reference this value.
 * 
 * shoulderShelfWidthX ≈ 1.35 * torsoCoreWidthX
 */
export const SHOULDER_TO_TORSO_RATIO = 1.35;

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
export function generateHeroicTorsoMesh(): CustomMeshData {
  // Dimensions in unit space (before localScale applied)
  // These are relative proportions, actual size comes from localScale: [0.4, 0.55, 0.24]
  
  // Lower torso (main body) - narrower
  const lowerWidth = 0.95;  // 95% of full width (allows shoulder to extend)
  const lowerHeight = 0.8;  // 80% of total height
  const lowerDepth = 1.0;   // Full depth
  
  // Upper shoulder shelf - wider
  const shoulderWidth = SHOULDER_TO_TORSO_RATIO; // 1.35x = extends on each side
  const shoulderHeight = 0.25; // 25% of total height (upper portion)
  const shoulderDepth = 1.0;
  const shoulderOverlap = 0.05; // 5% overlap with lower torso for seamless blend
  
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  // Helper to add a box to the mesh
  const addBox = (
    centerX: number,
    centerY: number,
    centerZ: number,
    width: number,
    height: number,
    depth: number,
  ) => {
    const halfW = width / 2;
    const halfH = height / 2;
    const halfD = depth / 2;
    
    // Define 8 corners
    const corners: [number, number, number][] = [
      [-halfW, -halfH, -halfD], // 0: left-bottom-back
      [halfW, -halfH, -halfD],  // 1: right-bottom-back
      [halfW, halfH, -halfD],   // 2: right-top-back
      [-halfW, halfH, -halfD],  // 3: left-top-back
      [-halfW, -halfH, halfD],  // 4: left-bottom-front
      [halfW, -halfH, halfD],   // 5: right-bottom-front
      [halfW, halfH, halfD],    // 6: right-top-front
      [-halfW, halfH, halfD],   // 7: left-top-front
    ];
    
    // Each face needs 4 vertices (for proper normals per face)
    // Front face (+Z)
    addQuad(
      corners[4]!, corners[5]!, corners[6]!, corners[7]!,
      [0, 0, 1], centerX, centerY, centerZ,
    );
    
    // Back face (-Z)
    addQuad(
      corners[1]!, corners[0]!, corners[3]!, corners[2]!,
      [0, 0, -1], centerX, centerY, centerZ,
    );
    
    // Right face (+X)
    addQuad(
      corners[5]!, corners[1]!, corners[2]!, corners[6]!,
      [1, 0, 0], centerX, centerY, centerZ,
    );
    
    // Left face (-X)
    addQuad(
      corners[0]!, corners[4]!, corners[7]!, corners[3]!,
      [-1, 0, 0], centerX, centerY, centerZ,
    );
    
    // Top face (+Y)
    addQuad(
      corners[3]!, corners[7]!, corners[6]!, corners[2]!,
      [0, 1, 0], centerX, centerY, centerZ,
    );
    
    // Bottom face (-Y)
    addQuad(
      corners[4]!, corners[0]!, corners[1]!, corners[5]!,
      [0, -1, 0], centerX, centerY, centerZ,
    );
  };
  
  const addQuad = (
    v0: [number, number, number],
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    normal: [number, number, number],
    offsetX: number,
    offsetY: number,
    offsetZ: number,
  ) => {
    const baseIdx = vertices.length / 3;
    
    // Add 4 vertices with UV coordinates
    // Standard box mapping: [0,0] bottom-left, [1,0] bottom-right, [1,1] top-right, [0,1] top-left
    const quadVerts = [v0, v1, v2, v3];
    const quadUVs: [number, number][] = [
      [0, 0], // bottom-left
      [1, 0], // bottom-right
      [1, 1], // top-right
      [0, 1], // top-left
    ];
    
    for (let i = 0; i < 4; i++) {
      const v = quadVerts[i]!;
      const uv = quadUVs[i]!;
      vertices.push(v[0] + offsetX, v[1] + offsetY, v[2] + offsetZ);
      normals.push(normal[0], normal[1], normal[2]);
      uvs.push(uv[0], uv[1]);
    }
    
    // Add 2 triangles (6 indices)
    indices.push(
      baseIdx, baseIdx + 1, baseIdx + 2,
      baseIdx, baseIdx + 2, baseIdx + 3,
    );
  };
  
  // Add lower torso (centered at origin, extends downward more)
  const lowerCenterY = -0.15; // Shifted down slightly
  addBox(0, lowerCenterY, 0, lowerWidth, lowerHeight, lowerDepth);
  
  // Add upper shoulder shelf (positioned at top, overlapping slightly with lower torso)
  const shoulderCenterY = lowerCenterY + (lowerHeight / 2) - (shoulderOverlap / 2) + (shoulderHeight / 2);
  addBox(0, shoulderCenterY, 0, shoulderWidth, shoulderHeight, shoulderDepth);
  
  // Convert to typed arrays
  const posArray = new Float32Array(vertices);
  const normalArray = new Float32Array(normals);
  const uvArray = new Float32Array(uvs);
  const indexArray = new Uint16Array(indices);
  
  // Interleave positions, normals, and UVs for renderer format
  // Format: [x, y, z, nx, ny, nz, u, v, x, y, z, nx, ny, nz, u, v, ...] (8 floats per vertex)
  const vertexCount = vertices.length / 3;
  const interleavedData = new Float32Array(vertexCount * 8);
  
  for (let i = 0; i < vertexCount; i++) {
    const base = i * 8;
    const posIdx = i * 3;
    const uvIdx = i * 2;
    
    // Position
    interleavedData[base + 0] = posArray[posIdx + 0]!; // x
    interleavedData[base + 1] = posArray[posIdx + 1]!; // y
    interleavedData[base + 2] = posArray[posIdx + 2]!; // z
    // Normal
    interleavedData[base + 3] = normalArray[posIdx + 0]!; // nx
    interleavedData[base + 4] = normalArray[posIdx + 1]!; // ny
    interleavedData[base + 5] = normalArray[posIdx + 2]!; // nz
    // UV
    interleavedData[base + 6] = uvArray[uvIdx + 0]!; // u
    interleavedData[base + 7] = uvArray[uvIdx + 1]!; // v
  }
  
  return {
    vertices: interleavedData,
    indices: indexArray,
  };
}

