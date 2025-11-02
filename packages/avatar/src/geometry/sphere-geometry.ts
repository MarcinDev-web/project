import type { CustomMeshData } from '@engine/world';

/**
 * Generates a sphere mesh with UV sphere topology.
 * 
 * The sphere is generated procedurally with configurable segments for smoothness.
 * This creates proper normals and UV coordinates for texturing.
 * 
 * @param segments - Number of horizontal and vertical segments (default: 16)
 * @returns CustomMeshData with vertices, normals, and indices
 */
export function generateSphereMesh(segments = 16): CustomMeshData {
  // Store positions, normals, and UVs separately for clarity
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  // Generate vertices for UV sphere with UV coordinates
  // Final format: [x, y, z, nx, ny, nz, u, v] per vertex (8 floats)
  
  // Top vertex
  positions.push(0, 1, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0); // Top of sphere
  
  // Middle vertices (latitudes)
  for (let lat = 1; lat < segments; lat++) {
    const theta = (lat * Math.PI) / segments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const v = lat / segments; // V coordinate (0 to 1)
    
    for (let lon = 0; lon < segments; lon++) {
      const phi = (lon * 2 * Math.PI) / segments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const u = lon / segments; // U coordinate (0 to 1)
      
      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;
      
      positions.push(x, y, z);
      normals.push(x, y, z); // For a unit sphere, normals = positions
      uvs.push(u, v);
    }
  }
  
  // Bottom vertex
  positions.push(0, -1, 0);
  normals.push(0, -1, 0);
  uvs.push(0.5, 1); // Bottom of sphere
  
  // Generate indices
  // Top cap triangles
  const topVertexIdx = 0;
  for (let lon = 0; lon < segments; lon++) {
    const current = 1 + lon;
    const next = 1 + ((lon + 1) % segments);
    indices.push(topVertexIdx, next, current);
  }
  
  // Middle quads (converted to triangles)
  for (let lat = 0; lat < segments - 2; lat++) {
    for (let lon = 0; lon < segments; lon++) {
      const current = 1 + (lat * segments) + lon;
      const next = 1 + (lat * segments) + ((lon + 1) % segments);
      const belowCurrent = 1 + ((lat + 1) * segments) + lon;
      const belowNext = 1 + ((lat + 1) * segments) + ((lon + 1) % segments);
      
      // First triangle
      indices.push(current, next, belowCurrent);
      // Second triangle
      indices.push(next, belowNext, belowCurrent);
    }
  }
  
  // Bottom cap triangles
  const bottomVertexIdx = 1 + (segments - 1) * segments;
  for (let lon = 0; lon < segments; lon++) {
    const current = 1 + ((segments - 2) * segments) + lon;
    const next = 1 + ((segments - 2) * segments) + ((lon + 1) % segments);
    indices.push(current, bottomVertexIdx, next);
  }
  
  // Convert to typed arrays
  const posArray = new Float32Array(positions);
  const normalArray = new Float32Array(normals);
  const uvArray = new Float32Array(uvs);
  const indexArray = new Uint16Array(indices);
  
  // Interleave positions, normals, and UVs for renderer format
  // Format: [x, y, z, nx, ny, nz, u, v, x, y, z, nx, ny, nz, u, v, ...] (8 floats per vertex)
  const vertexCount = positions.length / 3;
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

