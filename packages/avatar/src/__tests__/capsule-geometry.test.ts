import { describe, expect, it } from 'vitest';

import { generateCapsuleY } from '../geometry/capsule-geometry';

type Vec3 = [number, number, number];

function getPosition(vertices: Float32Array, vertexIndex: number): Vec3 {
  const base = vertexIndex * 8;
  return [
    vertices[base + 0]!,
    vertices[base + 1]!,
    vertices[base + 2]!,
  ];
}

function triangleAreaSquared(a: Vec3, b: Vec3, c: Vec3): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const acx = c[0] - a[0];
  const acy = c[1] - a[1];
  const acz = c[2] - a[2];
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return cx * cx + cy * cy + cz * cz;
}

function expectNonDegenerateCapsule(radialSegments: number, hemisphereSegments: number) {
  const mesh = generateCapsuleY({ radius: 0.5, cylinderHeight: 1.0, radialSegments, hemisphereSegments });
  expect(mesh.vertices).toBeDefined();
  expect(mesh.indices).toBeDefined();

  const { vertices, indices } = mesh;
  expect(vertices.length % 8).toBe(0);
  expect(indices.length % 3).toBe(0);

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]!;
    const ib = indices[i + 1]!;
    const ic = indices[i + 2]!;

    const a = getPosition(vertices, ia);
    const b = getPosition(vertices, ib);
    const c = getPosition(vertices, ic);

    expect(triangleAreaSquared(a, b, c)).toBeGreaterThan(1e-8);
  }
}

describe('generateCapsuleY', () => {
  it('produces valid geometry for default segment counts', () => {
    expectNonDegenerateCapsule(16, 8);
  });

  it('produces valid geometry for minimal supported segments', () => {
    expectNonDegenerateCapsule(8, 4);
  });
});
