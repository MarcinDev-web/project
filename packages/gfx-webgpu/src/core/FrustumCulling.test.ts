import { describe, it, expect } from 'vitest';
import { extractFrustumFromVP, cullEntities } from './FrustumCuller';
import { Scene, Entity } from '@engine/world';
import { mat4Perspective, mat4LookAt, mat4Multiply, type Mat4 } from '@engine/core/math';

function makeVP(): Mat4 {
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const vp = new Float32Array(16);
  // 60 deg FOV, square aspect, near/far typical
  mat4Perspective(proj, Math.PI / 3, 1, 0.1, 100);
  // Camera at (0,0,5) looking at origin
  mat4LookAt(view, [0, 0, 5], [0, 0, 0], [0, 1, 0]);
  mat4Multiply(vp, proj, view);
  return vp;
}

describe('Frustum culling utilities', () => {
  it('extractFrustumFromVP returns 6 normalized planes', () => {
    const vp = makeVP();
    const frustum = extractFrustumFromVP(vp);
    expect(frustum.planes.length).toBe(6);
    for (const p of frustum.planes) {
      const len = Math.hypot(p.nx, p.ny, p.nz);
      expect(len).toBeGreaterThan(0.9);
      expect(len).toBeLessThan(1.1);
    }
  });

  it('cullEntities filters entities outside the view frustum', () => {
    const scene = new Scene('test');
    const center = new Entity('center');
    // default at [0,0,0]
    scene.addEntity(center);

    const right = new Entity('right');
    right.transform.position = [10, 0, 0];
    scene.addEntity(right);

    const behind = new Entity('behind');
    behind.transform.position = [0, 0, 20]; // behind the camera
    scene.addEntity(behind);

    const frustum = extractFrustumFromVP(makeVP());
    const outVisible: Entity[] = [];
    cullEntities(scene.getActiveEntities(), frustum, outVisible);

    const names = new Set(outVisible.map((e) => e.name));
    expect(names.has('center')).toBe(true);
    expect(names.has('right')).toBe(false);
    expect(names.has('behind')).toBe(false);
    expect(outVisible.length).toBe(1);
  });

  it('handles rotated entities correctly (AABB includes rotation)', () => {
    const scene = new Scene('test');
    const rotated = new Entity('rotated');
    rotated.transform.position = [0, 0, 0];
    rotated.transform.scale = [0.5, 5, 0.5]; // tall thin box
    rotated.transform.setEulerAngles(0, Math.PI / 4, 0); // rotate 45°
    scene.addEntity(rotated);

    // After rotation, should have wider AABB
    const frustum = extractFrustumFromVP(makeVP());
    const outVisible: Entity[] = [];
    cullEntities(scene.getActiveEntities(), frustum, outVisible);

    expect(outVisible).toContain(rotated);
  });
});
