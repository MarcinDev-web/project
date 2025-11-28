import { describe, it, expect } from 'vitest';
import {
  mat4ToDualQuat,
  jointMatricesToDualQuats,
  normalizeDualQuat,
  blendDualQuats,
  type DualQuaternion,
} from './DualQuaternion';

describe('DualQuaternion', () => {
  describe('mat4ToDualQuat', () => {
    it('converts identity matrix to identity dual quaternion', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      
      const dq = mat4ToDualQuat(identity);
      
      // Identity rotation: (0, 0, 0, 1)
      expect(Math.abs(dq.real[0]!)).toBeLessThan(0.001);
      expect(Math.abs(dq.real[1]!)).toBeLessThan(0.001);
      expect(Math.abs(dq.real[2]!)).toBeLessThan(0.001);
      expect(Math.abs(dq.real[3]! - 1)).toBeLessThan(0.001);
      
      // No translation: dual part should be zero
      expect(Math.abs(dq.dual[0]!)).toBeLessThan(0.001);
      expect(Math.abs(dq.dual[1]!)).toBeLessThan(0.001);
      expect(Math.abs(dq.dual[2]!)).toBeLessThan(0.001);
      expect(Math.abs(dq.dual[3]!)).toBeLessThan(0.001);
    });
    
    it('converts translation-only matrix correctly', () => {
      const mat = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        5, 3, 2, 1, // translation (5, 3, 2)
      ]);
      
      const dq = mat4ToDualQuat(mat);
      
      // Identity rotation
      expect(Math.abs(dq.real[3]! - 1)).toBeLessThan(0.001);
      
      // Dual part encodes translation: d = 0.5 * t * r
      // For identity rotation (0,0,0,1), d = 0.5 * (tx, ty, tz, 0) * (0,0,0,1)
      // = 0.5 * (tx, ty, tz, 0)
      expect(Math.abs(dq.dual[0]! - 2.5)).toBeLessThan(0.001); // 0.5 * 5
      expect(Math.abs(dq.dual[1]! - 1.5)).toBeLessThan(0.001); // 0.5 * 3
      expect(Math.abs(dq.dual[2]! - 1.0)).toBeLessThan(0.001); // 0.5 * 2
    });
    
    it('converts 90-degree rotation around Y axis', () => {
      // 90 degrees around Y axis
      const mat = new Float32Array([
        0, 0, -1, 0,
        0, 1, 0, 0,
        1, 0, 0, 0,
        0, 0, 0, 1,
      ]);
      
      const dq = mat4ToDualQuat(mat);
      
      // Expected quaternion for 90° Y rotation: (0, sin(45°), 0, cos(45°))
      const sin45 = Math.sin(Math.PI / 4);
      const cos45 = Math.cos(Math.PI / 4);
      
      expect(Math.abs(dq.real[0]!)).toBeLessThan(0.01);
      expect(Math.abs(Math.abs(dq.real[1]!) - sin45)).toBeLessThan(0.01);
      expect(Math.abs(dq.real[2]!)).toBeLessThan(0.01);
      expect(Math.abs(Math.abs(dq.real[3]!) - cos45)).toBeLessThan(0.01);
    });
  });
  
  describe('jointMatricesToDualQuats', () => {
    it('converts multiple joint matrices', () => {
      const matrices = new Float32Array(32); // 2 joints * 16 floats
      
      // Identity for joint 0
      matrices.set([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ], 0);
      
      // Translation for joint 1
      matrices.set([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        10, 0, 0, 1,
      ], 16);
      
      const dqs = jointMatricesToDualQuats(matrices, 2);
      
      // Should have 16 floats (2 joints * 8 floats per DQ)
      expect(dqs.length).toBe(16);
      
      // Joint 0: identity rotation, no translation
      expect(Math.abs(dqs[3]! - 1)).toBeLessThan(0.001); // real.w
      expect(Math.abs(dqs[4]!)).toBeLessThan(0.001); // dual.x
      
      // Joint 1: identity rotation, translation (10, 0, 0)
      expect(Math.abs(dqs[11]! - 1)).toBeLessThan(0.001); // real.w
      expect(Math.abs(dqs[12]! - 5)).toBeLessThan(0.001); // dual.x = 0.5 * 10
    });
  });
  
  describe('normalizeDualQuat', () => {
    it('normalizes a scaled dual quaternion', () => {
      const dq: DualQuaternion = {
        real: new Float32Array([0, 0, 0, 2]), // scaled identity
        dual: new Float32Array([2, 0, 0, 0]),
      };
      
      normalizeDualQuat(dq);
      
      expect(Math.abs(dq.real[3]! - 1)).toBeLessThan(0.001);
      expect(Math.abs(dq.dual[0]! - 1)).toBeLessThan(0.001);
    });
  });
  
  describe('blendDualQuats', () => {
    it('returns identity for empty input', () => {
      const result = blendDualQuats([], []);
      
      expect(Math.abs(result.real[3]! - 1)).toBeLessThan(0.001);
    });
    
    it('blends two dual quaternions 50/50', () => {
      const dq1: DualQuaternion = {
        real: new Float32Array([0, 0, 0, 1]),
        dual: new Float32Array([0, 0, 0, 0]),
      };
      
      const dq2: DualQuaternion = {
        real: new Float32Array([0, 0, 0, 1]),
        dual: new Float32Array([5, 0, 0, 0]), // translation (10, 0, 0)
      };
      
      const result = blendDualQuats([dq1, dq2], [0.5, 0.5]);
      
      // Should be normalized
      const mag = Math.sqrt(
        result.real[0]! ** 2 +
        result.real[1]! ** 2 +
        result.real[2]! ** 2 +
        result.real[3]! ** 2
      );
      expect(Math.abs(mag - 1)).toBeLessThan(0.001);
      
      // Translation should be blended (approx 5, 0, 0) -> dual.x ~= 2.5
      expect(Math.abs(result.dual[0]! - 2.5)).toBeLessThan(0.1);
    });
    
    it('handles sign correction for opposite hemisphere quaternions', () => {
      const dq1: DualQuaternion = {
        real: new Float32Array([0, 0, 0, 1]),
        dual: new Float32Array([0, 0, 0, 0]),
      };
      
      // Same rotation but in opposite hemisphere
      const dq2: DualQuaternion = {
        real: new Float32Array([0, 0, 0, -1]),
        dual: new Float32Array([0, 0, 0, 0]),
      };
      
      const result = blendDualQuats([dq1, dq2], [0.5, 0.5]);
      
      // Should still produce valid identity-like result
      const mag = Math.sqrt(
        result.real[0]! ** 2 +
        result.real[1]! ** 2 +
        result.real[2]! ** 2 +
        result.real[3]! ** 2
      );
      expect(Math.abs(mag - 1)).toBeLessThan(0.001);
    });
  });
});

