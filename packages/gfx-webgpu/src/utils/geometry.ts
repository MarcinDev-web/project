// @ts-nocheck
import type { CustomMeshData } from '@engine/world';

/**
 * Generates a box mesh with specific dimensions.
 * @param width Width (X axis)
 * @param height Height (Y axis)
 * @param depth Depth (Z axis)
 * @param segments Number of segments per edge
 */
export function generateBoxMesh(width = 1, height = 1, depth = 1, segments = 1): CustomMeshData {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const seg = Math.max(1, Math.floor(segments));
  
  // 6 faces, each (seg+1)*(seg+1) vertices
  const vertsPerFace = (seg + 1) * (seg + 1);
  const trisPerFace = seg * seg * 2;
  const faces = 6;

  const vertices = new Float32Array(faces * vertsPerFace * 3);
  const normals = new Float32Array(faces * vertsPerFace * 3);
  const uvs = new Float32Array(faces * vertsPerFace * 2);
  const indices = new Uint16Array(faces * trisPerFace * 3);

  let vCursor = 0; // vertex cursor (floats)
  let nCursor = 0; // normal cursor
  let uCursor = 0; // uv cursor
  let iCursor = 0; // index cursor
  let vCount = 0;  // vertex count

  // Helper to build a face
  // u, v are basis vectors for the face
  // origin is the starting corner
  const buildFace = (
    u: [number, number, number],
    v: [number, number, number],
    origin: [number, number, number],
    normal: [number, number, number]
  ) => {
    const faceVertStart = vCount;

    for (let iy = 0; iy <= seg; iy++) {
      for (let ix = 0; ix <= seg; ix++) {
        const ptX = origin[0] + (u[0] * ix * width) / seg + (v[0] * iy * height) / seg; // This mapping is tricky for generic box
        // Better:
        // origin is center + normal*dim/2?
        // Let's use the standard "planes" approach
      }
    }
  };

  // Let's use a simpler approach iterating faces
  const sides = [
    { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], w: w, h: h, d: d, dims: [width, height] }, // Front (+Z)
    { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], w: w, h: h, d: -d, dims: [width, height] }, // Back (-Z)
    { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], w: w, h: h, d: d, dims: [depth, height] }, // Right (+X)
    { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], w: -w, h: h, d: d, dims: [depth, height] }, // Left (-X)
    { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], w: w, h: h, d: d, dims: [width, depth] }, // Top (+Y)
    { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], w: w, h: -h, d: d, dims: [width, depth] }, // Bottom (-Y)
  ];

  // Correct logic:
  // Center of face is normal * (dimension/2)
  // U and V are tangent vectors
  
  const facesDef = [
    { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], sizeU: width, sizeV: height, offset: [0, 0, d] }, // Front
    { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], sizeU: width, sizeV: height, offset: [0, 0, -d] }, // Back
    { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], sizeU: depth, sizeV: height, offset: [w, 0, 0] }, // Right
    { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], sizeU: depth, sizeV: height, offset: [-w, 0, 0] }, // Left
    { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], sizeU: width, sizeV: depth, offset: [0, h, 0] }, // Top
    { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], sizeU: width, sizeV: depth, offset: [0, -h, 0] }, // Bottom
  ];

  for (const face of facesDef) {
    const faceStartV = vCount;
    
    // Vertices
    for (let iy = 0; iy <= seg; iy++) {
      const yProgress = iy / seg; // 0..1
      const yPos = yProgress * face.sizeV - face.sizeV / 2;
      
      for (let ix = 0; ix <= seg; ix++) {
        const xProgress = ix / seg; // 0..1
        const xPos = xProgress * face.sizeU - face.sizeU / 2;
        
        // Position = offset + u*xPos + v*yPos
        vertices[vCursor++] = face.offset[0] + face.u[0] * xPos + face.v[0] * yPos;
        vertices[vCursor++] = face.offset[1] + face.u[1] * xPos + face.v[1] * yPos;
        vertices[vCursor++] = face.offset[2] + face.u[2] * xPos + face.v[2] * yPos;
        
        // Normal
        normals[nCursor++] = face.normal[0];
        normals[nCursor++] = face.normal[1];
        normals[nCursor++] = face.normal[2];
        
        // UV
        uvs[uCursor++] = xProgress;
        uvs[uCursor++] = 1.0 - yProgress; // Flip V to match standard UV
        
        vCount++;
      }
    }
    
    // Indices
    for (let iy = 0; iy < seg; iy++) {
      for (let ix = 0; ix < seg; ix++) {
        const row = seg + 1;
        const a = faceStartV + iy * row + ix;
        const b = faceStartV + (iy + 1) * row + ix;
        const c = faceStartV + (iy + 1) * row + (ix + 1);
        const d = faceStartV + iy * row + (ix + 1);
        
        indices[iCursor++] = a;
        indices[iCursor++] = b;
        indices[iCursor++] = d;
        
        indices[iCursor++] = b;
        indices[iCursor++] = c;
        indices[iCursor++] = d;
      }
    }
  }

  return { vertices, normals, uvs, indices };
}

/**
 * Generates a plane mesh.
 * @param width Width of the plane (X axis)
 * @param depth Depth of the plane (Z axis)
 * @param segments Number of segments along each axis
 */
export function generatePlaneMesh(width = 1, depth = 1, segments = 1): CustomMeshData {
  const widthHalf = width / 2;
  const depthHalf = depth / 2;
  const gridX = Math.floor(segments);
  const gridZ = Math.floor(segments);
  const gridX1 = gridX + 1;
  const gridZ1 = gridZ + 1;
  const segmentWidth = width / gridX;
  const segmentDepth = depth / gridZ;

  const vertices = new Float32Array(gridX1 * gridZ1 * 3);
  const normals = new Float32Array(gridX1 * gridZ1 * 3);
  const uvs = new Float32Array(gridX1 * gridZ1 * 2);
  const indices = new Uint16Array(gridX * gridZ * 6);

  let vIdx = 0;
  let nIdx = 0;
  let uIdx = 0;

  for (let iz = 0; iz < gridZ1; iz++) {
    const z = iz * segmentDepth - depthHalf;
    for (let ix = 0; ix < gridX1; ix++) {
      const x = ix * segmentWidth - widthHalf;

      vertices[vIdx++] = x;
      vertices[vIdx++] = 0;
      vertices[vIdx++] = z;

      normals[nIdx++] = 0;
      normals[nIdx++] = 1;
      normals[nIdx++] = 0;

      uvs[uIdx++] = ix / gridX;
      uvs[uIdx++] = iz / gridZ;
    }
  }

  let iIdx = 0;
  for (let iz = 0; iz < gridZ; iz++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = ix + gridX1 * iz;
      const b = ix + gridX1 * (iz + 1);
      const c = (ix + 1) + gridX1 * (iz + 1);
      const d = (ix + 1) + gridX1 * iz;

      indices[iIdx++] = a;
      indices[iIdx++] = b;
      indices[iIdx++] = d;

      indices[iIdx++] = b;
      indices[iIdx++] = c;
      indices[iIdx++] = d;
    }
  }

  return { vertices, normals, uvs, indices };
}

/**
 * Generates a cylinder mesh.
 * @param radiusTop Radius of the top cap
 * @param radiusBottom Radius of the bottom cap
 * @param height Height of the cylinder
 * @param radialSegments Number of segmented faces around the circumference
 * @param heightSegments Number of rows of faces along the height
 * @param openEnded A boolean indicating whether the ends of the cylinder are open or capped
 */
export function generateCylinderMesh(
  radiusTop = 1,
  radiusBottom = 1,
  height = 1,
  radialSegments = 16,
  heightSegments = 1,
  openEnded = false
): CustomMeshData {
  radialSegments = Math.floor(radialSegments);
  heightSegments = Math.floor(heightSegments);

  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let index = 0;
  const indexArray: number[][] = [];
  const halfHeight = height / 2;

  // Generate torso
  for (let y = 0; y <= heightSegments; y++) {
    const indexRow: number[] = [];
    const v = y / heightSegments;
    const radius = v * (radiusBottom - radiusTop) + radiusTop;

    for (let x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      vertices.push(radius * sinTheta, -v * height + halfHeight, radius * cosTheta);
      
      // Normal
      const slope = (radiusBottom - radiusTop) / height;
      const normal = [sinTheta, slope, cosTheta];
      // Normalize
      const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      normals.push(normal[0] / len, normal[1] / len, normal[2] / len);

      uvs.push(u, 1 - v);
      indexRow.push(index++);
    }
    indexArray.push(indexRow);
  }

  for (let x = 0; x < radialSegments; x++) {
    for (let y = 0; y < heightSegments; y++) {
      const a = indexArray[y][x];
      const b = indexArray[y + 1][x];
      const c = indexArray[y + 1][x + 1];
      const d = indexArray[y][x + 1];

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Generate caps
  if (!openEnded) {
    if (radiusTop > 0) generateCap(true);
    if (radiusBottom > 0) generateCap(false);
  }

  function generateCap(top: boolean) {
    const centerIndexStart = index;
    const radius = top ? radiusTop : radiusBottom;
    const sign = top ? 1 : -1;

    // Center vertex
    vertices.push(0, halfHeight * sign, 0);
    normals.push(0, sign, 0);
    uvs.push(0.5, 0.5);
    index++;

    const centerIndex = centerIndexStart;

    for (let x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      vertices.push(radius * sinTheta, halfHeight * sign, radius * cosTheta);
      normals.push(0, sign, 0);
      uvs.push(0.5 + (sinTheta * 0.5) * sign, 0.5 + (cosTheta * 0.5));
      index++;
    }

    for (let x = 0; x < radialSegments; x++) {
      const c = centerIndex;
      const i = centerIndex + 1 + x;
      
      if (top) {
        indices.push(i, i + 1, c);
      } else {
        indices.push(i + 1, i, c);
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

/**
 * Generates a sphere mesh.
 * @param radius Sphere radius
 * @param widthSegments Horizontal segments
 * @param heightSegments Vertical segments
 */
export function generateSphereMesh(
  radius = 1,
  widthSegments = 16,
  heightSegments = 16
): CustomMeshData {
  widthSegments = Math.max(3, Math.floor(widthSegments));
  heightSegments = Math.max(2, Math.floor(heightSegments));

  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= heightSegments; y++) {
    const v = y / heightSegments;
    const theta = v * Math.PI;

    for (let x = 0; x <= widthSegments; x++) {
      const u = x / widthSegments;
      const phi = u * Math.PI * 2;

      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const ux = cosPhi * sinTheta;
      const uy = cosTheta;
      const uz = sinPhi * sinTheta;

      vertices.push(ux * radius, uy * radius, uz * radius);
      normals.push(ux, uy, uz);
      uvs.push(u, 1 - v);
    }
  }

  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < widthSegments; x++) {
      const a = (widthSegments + 1) * y + x;
      const b = (widthSegments + 1) * (y + 1) + x;
      const c = (widthSegments + 1) * (y + 1) + (x + 1);
      const d = (widthSegments + 1) * y + (x + 1);

      if (y !== 0) indices.push(a, b, d);
      if (y !== heightSegments - 1) indices.push(b, c, d);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

/**
 * Generates a capsule mesh.
 * @param radius Radius of the capsule
 * @param height Height of the cylindrical part
 * @param radialSegments Segments around the capsule
 * @param capSegments Segments for the caps
 */
export function generateCapsuleMesh(
  radius = 1,
  height = 1,
  radialSegments = 16,
  capSegments = 8
): CustomMeshData {
  // Reuse cylinder logic for body and sphere logic for caps?
  // Easier to generate from scratch
  
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Helper to add vertex
  const addVertex = (x: number, y: number, z: number, u: number, v: number) => {
    vertices.push(x, y, z);
    
    // Normal (for capsule, it's just vector from axis, but caps are different)
    // Actually, for a capsule centered at origin along Y:
    // If y > height/2, center is (0, height/2, 0)
    // If y < -height/2, center is (0, -height/2, 0)
    // Else center is (0, y, 0)
    
    let cy = 0;
    if (y > height / 2) cy = height / 2;
    else if (y < -height / 2) cy = -height / 2;
    else cy = y;
    
    const nx = x;
    const ny = y - cy;
    const nz = z;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    
    if (len > 0.0001) {
      normals.push(nx / len, ny / len, nz / len);
    } else {
      normals.push(0, 1, 0); // Degenerate case
    }
    
    uvs.push(u, v);
  };

  const halfHeight = height / 2;
  
  // Generate profile
  // Top cap (quarter circle) -> Cylinder (straight line) -> Bottom cap (quarter circle)
  
  // Total segments = capSegments + 1 (cylinder body) + capSegments
  // Actually, let's do it by latitude rings
  
  const rings = capSegments * 2 + 1; // +1 for the cylinder body (simplified)
  // Better: generate rings for top cap, then rings for bottom cap, connecting them
  
  // Top cap
  for (let i = 0; i <= capSegments; i++) {
    const v = i / capSegments;
    const theta = v * Math.PI / 2; // 0 to pi/2
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    
    const ringY = halfHeight + radius * cosTheta;
    const ringRadius = radius * sinTheta;
    
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const phi = u * Math.PI * 2;
      const x = ringRadius * Math.sin(phi);
      const z = ringRadius * Math.cos(phi);
      
      // Map V to 0..1 over whole capsule?
      // Total length = height + 2*radius
      // V = (y + totalHeight/2) / totalHeight
      const totalHeight = height + 2 * radius;
      const mapV = (ringY + totalHeight / 2) / totalHeight;
      
      addVertex(x, ringY, z, u, 1 - mapV);
    }
  }
  
  // Bottom cap
  for (let i = 0; i <= capSegments; i++) {
    const v = i / capSegments;
    const theta = Math.PI / 2 + v * Math.PI / 2; // pi/2 to pi
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    
    const ringY = -halfHeight + radius * cosTheta; // Note: cosTheta is negative here
    const ringRadius = radius * sinTheta;
    
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const phi = u * Math.PI * 2;
      const x = ringRadius * Math.sin(phi);
      const z = ringRadius * Math.cos(phi);
      
      const totalHeight = height + 2 * radius;
      const mapV = (ringY + totalHeight / 2) / totalHeight;
      
      addVertex(x, ringY, z, u, 1 - mapV);
    }
  }
  
  // Indices
  // We have (capSegments + 1) rings for top, and (capSegments + 1) rings for bottom
  // Total rings = 2 * capSegments + 2
  // But wait, the last ring of top cap (theta=pi/2) is at y=halfHeight, radius=radius
  // The first ring of bottom cap (theta=pi/2) is at y=-halfHeight, radius=radius
  // We need to connect them with the cylinder body
  
  const stride = radialSegments + 1;
  const topCapRings = capSegments + 1;
  const bottomCapRings = capSegments + 1;
  
  // Top cap faces
  for (let i = 0; i < capSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  
  // Cylinder body faces (connect last ring of top cap to first ring of bottom cap)
  const topLastRingStart = capSegments * stride;
  const bottomFirstRingStart = topCapRings * stride;
  
  for (let j = 0; j < radialSegments; j++) {
    const a = topLastRingStart + j;
    const b = bottomFirstRingStart + j;
    const c = bottomFirstRingStart + (j + 1);
    const d = topLastRingStart + (j + 1);
    
    indices.push(a, b, d);
    indices.push(b, c, d);
  }
  
  // Bottom cap faces
  for (let i = 0; i < capSegments; i++) {
    const offset = bottomFirstRingStart;
    for (let j = 0; j < radialSegments; j++) {
      const a = offset + i * stride + j;
      const b = offset + (i + 1) * stride + j;
      const c = offset + (i + 1) * stride + (j + 1);
      const d = offset + i * stride + (j + 1);
      
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

/**
 * Generates a torus mesh.
 * @param radius Radius of the torus (distance from center to tube center)
 * @param tube Radius of the tube
 * @param radialSegments Segments around the tube cross-section
 * @param tubularSegments Segments around the torus ring
 * @param arc Central angle (defaults to Math.PI * 2)
 */
export function generateTorusMesh(
  radius = 1,
  tube = 0.4,
  radialSegments = 8,
  tubularSegments = 6,
  arc = Math.PI * 2
): CustomMeshData {
  radialSegments = Math.floor(radialSegments);
  tubularSegments = Math.floor(tubularSegments);

  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= tubularSegments; i++) {
      const u = (i / tubularSegments) * arc;
      const v = (j / radialSegments) * Math.PI * 2;

      const cx = radius * Math.cos(u);
      const cy = radius * Math.sin(u);

      const x = (radius + tube * Math.cos(v)) * Math.cos(u);
      const y = (radius + tube * Math.cos(v)) * Math.sin(u);
      const z = tube * Math.sin(v);

      vertices.push(x, y, z);

      const nx = x - cx;
      const ny = y - cy;
      const nz = z;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      
      if (len > 0.0001) {
        normals.push(nx / len, ny / len, nz / len);
      } else {
        normals.push(0, 0, 1);
      }

      uvs.push(i / tubularSegments, j / radialSegments);
    }
  }

  for (let j = 1; j <= radialSegments; j++) {
    for (let i = 1; i <= tubularSegments; i++) {
      const a = (tubularSegments + 1) * j + i - 1;
      const b = (tubularSegments + 1) * (j - 1) + i - 1;
      const c = (tubularSegments + 1) * (j - 1) + i;
      const d = (tubularSegments + 1) * j + i;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}