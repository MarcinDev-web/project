/**
 * Smoke tests for WASM collision module.
 * Verifies that the WASM module loads correctly and basic APIs are functional.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { init } from '../index';
import type { WasmCollision } from '../index';

describe('wasm-collision smoke', () => {
  let wasm: WasmCollision;

  beforeAll(async () => {
    wasm = await init();
  });

  it('loads WASM module successfully', () => {
    expect(wasm).toBeDefined();
  });

  it('exports obbIntersect function', () => {
    expect(wasm.obbIntersect).toBeDefined();
    expect(typeof wasm.obbIntersect).toBe('function');
  });

  it('exports sphereSphereIntersect function', () => {
    expect(wasm.sphereSphereIntersect).toBeDefined();
    expect(typeof wasm.sphereSphereIntersect).toBe('function');
  });

  it('exports batchCheckTrs function', () => {
    expect(wasm.batchCheckTrs).toBeDefined();
    expect(typeof wasm.batchCheckTrs).toBe('function');
  });

  it('exports CollisionWorld constructor', () => {
    expect(wasm.CollisionWorld).toBeDefined();
  });

  it('detects simple sphere collision', () => {
    const center1 = new Float32Array([0, 0, 0]);
    const center2 = new Float32Array([1, 0, 0]);
    
    // Spheres overlap (radius 1 each, centers 1 apart)
    expect(wasm.sphereSphereIntersect(center1, 1.0, center2, 1.0)).toBe(true);
    
    // Spheres don't overlap (radius 0.4 each, centers 1 apart)
    expect(wasm.sphereSphereIntersect(center1, 0.4, center2, 0.4)).toBe(false);
  });

  it('detects OBB collision with identity rotation', () => {
    // Two axis-aligned boxes
    const centerA = new Float32Array([0, 0, 0]);
    const axesA = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]); // Identity rotation
    const halfA = new Float32Array([1, 1, 1]);

    const centerB = new Float32Array([1.5, 0, 0]);
    const axesB = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]); // Identity rotation
    const halfB = new Float32Array([1, 1, 1]);

    const obbA = { center: centerA, axes: axesA, half: halfA };
    const obbB = { center: centerB, axes: axesB, half: halfB };

    // Boxes overlap (half sizes 1 + 1 = 2, centers 1.5 apart)
    expect(wasm.obbIntersect(obbA, obbB)).toBe(true);

    // Move box B further away
    const centerBFar = new Float32Array([3, 0, 0]);
    const obbBFar = { center: centerBFar, axes: axesB, half: halfB };
    
    // Boxes don't overlap (centers 3 apart, half sizes sum to 2)
    expect(wasm.obbIntersect(obbA, obbBFar)).toBe(false);
  });

  it('handles empty batch check', () => {
    const preview = {
      pos: new Float32Array([0, 0, 0]),
      rot: new Float32Array([0, 0, 0, 1]),
      scl: new Float32Array([1, 1, 1]),
    };
    
    const empty = {
      positions: new Float32Array(0),
      rotations: new Float32Array(0),
      scales: new Float32Array(0),
    };

    const result = wasm.batchCheckTrs(preview, empty);
    expect(result).toBeDefined();
    expect(result.length).toBe(0);
  });

  it('detects collisions in batch check', () => {
    const preview = {
      pos: new Float32Array([0, 0, 0]),
      rot: new Float32Array([0, 0, 0, 1]),
      scl: new Float32Array([2, 2, 2]), // Box with half-size 1
    };
    
    // 3 boxes: one colliding, two not colliding
    const others = {
      positions: new Float32Array([
        0.5, 0, 0,    // Colliding (close to origin)
        5, 0, 0,      // Not colliding (far away)
        0, 5, 0,      // Not colliding (far away)
      ]),
      rotations: new Float32Array([
        0, 0, 0, 1,
        0, 0, 0, 1,
        0, 0, 0, 1,
      ]),
      scales: new Float32Array([
        1, 1, 1,
        1, 1, 1,
        1, 1, 1,
      ]),
    };

    const result = wasm.batchCheckTrs(preview, others);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0); // First box is colliding
  });
});

