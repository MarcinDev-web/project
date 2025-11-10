import type { CustomMeshData } from '@engine/world';

/**
 * Generates a unit capsule aligned on Y axis (centered at origin).
 * Total height = cylinderHeight + 2*radius. Defaults: radius=0.5, cylinderHeight=1.
 * Returned mesh uses interleaved format [x,y,z, nx,ny,nz, u,v] and triangle indices.
 */
export function generateCapsuleY(
	radius = 0.5,
	cylinderHeight = 1.0,
	radialSegments = 16,
	hemisphereSegments = 8,
): CustomMeshData {
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];

	const totalHeight = cylinderHeight + 2 * radius;
	const halfCyl = cylinderHeight * 0.5;

	// Helper to push a ring of vertices around Y
	function pushRing(y: number, ringRadius: number, v: number, normalYFromSphereCenter?: number) {
		for (let i = 0; i < radialSegments; i++) {
			const theta = (i / radialSegments) * Math.PI * 2;
			const cosT = Math.cos(theta);
			const sinT = Math.sin(theta);
			const x = ringRadius * cosT;
			const z = ringRadius * sinT;

			let nx = cosT;
			let ny = 0;
			let nz = sinT;

			// If normalYFromSphereCenter provided (hemisphere), compute true sphere normal
			if (typeof normalYFromSphereCenter === 'number') {
				const lenInv = 1 / Math.sqrt(cosT * cosT + nz * nz + normalYFromSphereCenter * normalYFromSphereCenter);
				nx = cosT * lenInv;
				ny = normalYFromSphereCenter * lenInv;
				nz = sinT * lenInv;
			}

			positions.push(x, y, z);
			normals.push(nx, ny, nz);
			uvs.push(i / radialSegments, v);
		}
	}

	// Build vertices
	// 1) Top pole (single vertex)
	const topPoleY = halfCyl + radius;
	positions.push(0, topPoleY, 0);
	normals.push(0, 1, 0); // Point straight up
	uvs.push(0.5, 0); // Center of top UV
	const topPoleIndex = 0;

	// 2) Top hemisphere (from pi/2..0, excluding pole)
	for (let h = 1; h <= hemisphereSegments; h++) {
		const t = h / hemisphereSegments; // 0..1
		const phi = (t * Math.PI) / 2; // 0..pi/2
		const ringR = radius * Math.cos(phi);
		const y = halfCyl + radius * Math.sin(phi);
		const v = (totalHeight * 0.5 - y) / totalHeight; // map y to 0..1
		// normal y relative to sphere center
		const ny = Math.sin(phi);
		pushRing(y, ringR, v, ny);
	}

	// 3) Bottom hemisphere (from 0..pi/2, excluding pole)
	for (let h = 1; h <= hemisphereSegments; h++) {
		const t = h / hemisphereSegments; // 0..1
		const phi = (t * Math.PI) / 2; // 0..pi/2
		const ringR = radius * Math.cos(phi);
		const y = -halfCyl - radius * Math.sin(phi);
		const v = (totalHeight * 0.5 - y) / totalHeight;
		const ny = -Math.sin(phi);
		pushRing(y, ringR, v, ny);
	}

	// 4) Bottom pole (single vertex)
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
		indices.push(i0, i1, i2);
	}

	// Connect rings (excluding poles)
	// Top hemisphere has hemisphereSegments rings (h=1 to hemisphereSegments)
	// Bottom hemisphere has hemisphereSegments rings (h=1 to hemisphereSegments)
	const rings = hemisphereSegments + hemisphereSegments; // Excluding poles
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

	// Convert to typed arrays and interleave
	const posArray = new Float32Array(positions);
	const normalArray = new Float32Array(normals);
	const uvArray = new Float32Array(uvs);
	const indexArray = new Uint16Array(indices);

	const vertexCount = positions.length / 3;
	const interleavedData = new Float32Array(vertexCount * 8);
	for (let i = 0; i < vertexCount; i++) {
		const base = i * 8;
		const posIdx = i * 3;
		const uvIdx = i * 2;
		interleavedData[base + 0] = posArray[posIdx + 0]!;
		interleavedData[base + 1] = posArray[posIdx + 1]!;
		interleavedData[base + 2] = posArray[posIdx + 2]!;
		interleavedData[base + 3] = normalArray[posIdx + 0]!;
		interleavedData[base + 4] = normalArray[posIdx + 1]!;
		interleavedData[base + 5] = normalArray[posIdx + 2]!;
		interleavedData[base + 6] = uvArray[uvIdx + 0]!;
		interleavedData[base + 7] = uvArray[uvIdx + 1]!;
	}

	return {
		vertices: interleavedData,
		indices: indexArray,
	};
}


