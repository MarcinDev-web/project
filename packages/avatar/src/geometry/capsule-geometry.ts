import type { CustomMeshData } from '@engine/world';
import { VERTEX_STRIDE_FLOATS } from './torso-geometry';

/**
 * Options for generating a capsule mesh
 */
export interface CapsuleOptions {
	/** Radius of the capsule hemispheres and cylinder (default: 0.5) */
	radius?: number;
	/** Height of the cylinder section (default: 1.0) */
	cylinderHeight?: number;
	/** Number of radial segments around the capsule (default: 16) */
	radialSegments?: number;
	/** Number of segments for each hemisphere (default: 8) */
	hemisphereSegments?: number;
	/** If true, reverses normals to face inward (default: false) */
	insideOut?: boolean;
}

/**
 * Generates a unit capsule aligned on Y axis (centered at origin).
 * Total height = cylinderHeight + 2*radius. Defaults: radius=0.5, cylinderHeight=1.
 * Returned mesh uses interleaved format [x,y,z, nx,ny,nz, u,v] and triangle indices.
 * 
 * UV coordinates: U ranges [0, 1) creating a seam along the length.
 * This mesh requires addressModeU = 'repeat' for correct texture wrapping (seam disappears).
 * 
 * @param options - Optional geometry parameters (uses defaults if not provided)
 * @returns CustomMeshData with vertices, normals, and indices
 */
export function generateCapsuleY(options: CapsuleOptions = {}): CustomMeshData {
	const {
		radius = 0.5,
		cylinderHeight = 1.0,
		radialSegments = 16,
		hemisphereSegments = 8,
		insideOut = false,
	} = options;
	// Validate input parameters
	if (radius <= 0) {
		throw new Error(`generateCapsuleY: "radius" must be > 0 (got ${radius})`);
	}
	if (cylinderHeight < 0) {
		throw new Error(`generateCapsuleY: "cylinderHeight" must be >= 0 (got ${cylinderHeight})`);
	}
	if (radialSegments < 3) {
		throw new Error(`generateCapsuleY: "radialSegments" must be >= 3 (got ${radialSegments})`);
	}
	if (hemisphereSegments < 2) {
		throw new Error(`generateCapsuleY: "hemisphereSegments" must be >= 2 (got ${hemisphereSegments})`);
	}

	// Validate vertex stride matches expected format [x,y,z, nx,ny,nz, u,v] = 8 floats
	if (VERTEX_STRIDE_FLOATS !== 8) {
		throw new Error(`generateCapsuleY expects VERTEX_STRIDE_FLOATS === 8 (got ${VERTEX_STRIDE_FLOATS})`);
	}

	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];

	const totalHeight = cylinderHeight + 2 * radius;
	const halfCyl = cylinderHeight * 0.5;

	// Helper to push a ring of vertices for cylinder section (horizontal normals)
	function pushCylinderRing(y: number, radius: number, v: number) {
		for (let i = 0; i < radialSegments; i++) {
			const theta = (i / radialSegments) * Math.PI * 2;
			const cosT = Math.cos(theta);
			const sinT = Math.sin(theta);
			const x = radius * cosT;
			const z = radius * sinT;

			// Cylinder normals point horizontally outward
			const nx = cosT;
			const ny = 0;
			const nz = sinT;

			positions.push(x, y, z);
			normals.push(nx, ny, nz);
			// U coordinate: [0, 1) range creates seam - requires addressModeU = 'repeat'
			uvs.push(i / radialSegments, v);
		}
	}

	// Helper to push a ring of vertices for hemisphere section (spherical normals)
	function pushHemisphereRing(y: number, ringRadius: number, v: number, sphereCenterY: number) {
		for (let i = 0; i < radialSegments; i++) {
			const theta = (i / radialSegments) * Math.PI * 2;
			const cosT = Math.cos(theta);
			const sinT = Math.sin(theta);
			const x = ringRadius * cosT;
			const z = ringRadius * sinT;

			// Compute true sphere normal from position relative to sphere center
			const cx = x;
			const cy = y - sphereCenterY;
			const cz = z;
			const lenInv = 1 / Math.sqrt(cx * cx + cy * cy + cz * cz);
			const nx = cx * lenInv;
			const ny = cy * lenInv;
			const nz = cz * lenInv;

			positions.push(x, y, z);
			normals.push(nx, ny, nz);
			// U coordinate: [0, 1) range creates seam - requires addressModeU = 'repeat'
			uvs.push(i / radialSegments, v);
		}
	}

	// Build vertices
	// 1) Top pole (single vertex)
	const topPoleY = halfCyl + radius;
	const topSphereCenterY = halfCyl + radius; // Center of top hemisphere sphere
	positions.push(0, topPoleY, 0);
	normals.push(0, 1, 0); // Point straight up
	uvs.push(0.5, 0); // Center of top UV
	const topPoleIndex = 0;

	// 2) Top hemisphere (from pi/2..0, excluding pole and cylinder edge)
	// Skip the last ring (h=hemisphereSegments) which has ringR=0 and would create degenerate triangles
	for (let h = 1; h < hemisphereSegments; h++) {
		const t = h / hemisphereSegments; // 0..1
		const phi = (t * Math.PI) / 2; // 0..pi/2
		const ringR = radius * Math.cos(phi);
		const y = halfCyl + radius * Math.sin(phi);
		const v = (totalHeight * 0.5 - y) / totalHeight; // map y to 0..1
		pushHemisphereRing(y, ringR, v, topSphereCenterY);
	}

	// 3) Cylinder section - top edge ring (connects top hemisphere to cylinder)
	const topCylinderY = halfCyl;
	const topCylinderV = (totalHeight * 0.5 - topCylinderY) / totalHeight;
	pushCylinderRing(topCylinderY, radius, topCylinderV);

	// 4) Cylinder section - bottom edge ring (connects cylinder to bottom hemisphere)
	const bottomCylinderY = -halfCyl;
	const bottomCylinderV = (totalHeight * 0.5 - bottomCylinderY) / totalHeight;
	pushCylinderRing(bottomCylinderY, radius, bottomCylinderV);

	// 5) Bottom hemisphere (from 0..pi/2, excluding pole and cylinder edge)
	// Skip the last ring (h=hemisphereSegments) which has ringR=0 and would create degenerate triangles
	const bottomSphereCenterY = -halfCyl - radius; // Center of bottom hemisphere sphere
	for (let h = 1; h < hemisphereSegments; h++) {
		const t = h / hemisphereSegments; // 0..1
		const phi = (t * Math.PI) / 2; // 0..pi/2
		const ringR = radius * Math.cos(phi);
		const y = -halfCyl - radius * Math.sin(phi);
		const v = (totalHeight * 0.5 - y) / totalHeight;
		pushHemisphereRing(y, ringR, v, bottomSphereCenterY);
	}

	// 6) Bottom pole (single vertex)
	const bottomPoleY = -halfCyl - radius;
	const bottomPoleIndex = positions.length / 3;
	positions.push(0, bottomPoleY, 0);
	normals.push(0, -1, 0); // Point straight down
	uvs.push(0.5, 1); // Center of bottom UV

	// Generate indices
	// Top pole cap: connect top pole to first ring
	const firstRingStart = 1; // After top pole vertex
	for (let i = 0; i < radialSegments; i++) {
		const i0 = topPoleIndex;
		const i1 = firstRingStart + i;
		const i2 = firstRingStart + ((i + 1) % radialSegments);
		indices.push(i0, i2, i1); // Reversed winding order for outward-facing normals
	}

	// Connect rings (excluding poles)
	// Top hemisphere: (hemisphereSegments - 1) rings (h=1 to hemisphereSegments-1)
	// Cylinder: 2 rings (top and bottom edges)
	// Bottom hemisphere: (hemisphereSegments - 1) rings (h=1 to hemisphereSegments-1)
	// Total rings: (hemisphereSegments - 1) + 2 + (hemisphereSegments - 1) = 2 * hemisphereSegments
	const rings = (hemisphereSegments - 1) + 2 + (hemisphereSegments - 1); // = 2 * hemisphereSegments
	for (let r = 0; r < rings - 1; r++) {
		const currStart = firstRingStart + r * radialSegments;
		const nextStart = firstRingStart + (r + 1) * radialSegments;
		if (nextStart >= bottomPoleIndex) break;
		for (let i = 0; i < radialSegments; i++) {
			const i0 = currStart + i;
			const i1 = currStart + ((i + 1) % radialSegments);
			const i2 = nextStart + i;
			const i3 = nextStart + ((i + 1) % radialSegments);
			indices.push(i0, i1, i2);
			indices.push(i1, i3, i2);
		}
	}

	// Bottom pole cap: connect last ring to bottom pole
	const lastRingStart = bottomPoleIndex - radialSegments;
	for (let i = 0; i < radialSegments; i++) {
		const i0 = lastRingStart + i;
		const i1 = lastRingStart + ((i + 1) % radialSegments);
		const i2 = bottomPoleIndex;
		indices.push(i0, i1, i2);
	}

	// Reverse normals if insideOut is true
	if (insideOut) {
		for (let i = 0; i < normals.length; i++) {
			normals[i] = -(normals[i] ?? 0);
		}
	}

	// Convert to typed arrays and interleave
	const posArray = new Float32Array(positions);
	const normalArray = new Float32Array(normals);
	const uvArray = new Float32Array(uvs);
	const indexArray = new Uint16Array(indices);

	const vertexCount = positions.length / 3;
	const interleavedData = new Float32Array(vertexCount * VERTEX_STRIDE_FLOATS);
	for (let i = 0; i < vertexCount; i++) {
		const base = i * VERTEX_STRIDE_FLOATS;
		const posIdx = i * 3;
		const uvIdx = i * 2;
		interleavedData[base + 0] = posArray[posIdx + 0] ?? 0;
		interleavedData[base + 1] = posArray[posIdx + 1] ?? 0;
		interleavedData[base + 2] = posArray[posIdx + 2] ?? 0;
		interleavedData[base + 3] = normalArray[posIdx + 0] ?? 0;
		interleavedData[base + 4] = normalArray[posIdx + 1] ?? 0;
		interleavedData[base + 5] = normalArray[posIdx + 2] ?? 0;
		interleavedData[base + 6] = uvArray[uvIdx + 0] ?? 0;
		interleavedData[base + 7] = uvArray[uvIdx + 1] ?? 0;
	}

	return {
		vertices: interleavedData,
		indices: indexArray,
	};
}


