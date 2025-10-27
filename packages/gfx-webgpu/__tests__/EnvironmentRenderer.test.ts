import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentRenderer } from '@engine/gfx-webgpu';
import { EnvironmentComponent } from '@engine/world';
import type { Mat4, Vec3 } from '@engine/core/math';

describe('EnvironmentRenderer', () => {
  let renderer: EnvironmentRenderer;

  beforeEach(() => {
    renderer = new EnvironmentRenderer();
  });

  describe('Construction', () => {
    it('should create an instance', () => {
      expect(renderer).toBeDefined();
      expect(renderer).toBeInstanceOf(EnvironmentRenderer);
    });
  });

  describe('API Surface', () => {
    it('should have initialize method', () => {
      expect(typeof renderer.initialize).toBe('function');
    });

    it('should have updateUniforms method', () => {
      expect(typeof renderer.updateUniforms).toBe('function');
    });

    it('should have updateParams method', () => {
      expect(typeof renderer.updateParams).toBe('function');
    });

    it('should have render method', () => {
      expect(typeof renderer.render).toBe('function');
    });

    it('should have cleanup method', () => {
      expect(typeof renderer.cleanup).toBe('function');
    });
  });

  describe('Update Methods Without Initialization', () => {
    it('should not throw when updating uniforms before initialization', () => {
      const inverseVP: Mat4 = new Float32Array(16) as Mat4;
      const cameraPos: Vec3 = [0, 0, 0];

      expect(() => {
        renderer.updateUniforms(inverseVP, cameraPos);
      }).not.toThrow();
    });

    it('should not throw when updating params before initialization', () => {
      const environment = new EnvironmentComponent();

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should not throw when rendering before initialization', () => {
      const environment = new EnvironmentComponent();
      const mockPassEncoder = {} as GPURenderPassEncoder;

      expect(() => {
        renderer.render(mockPassEncoder, environment);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should not throw when cleaning up uninitialized renderer', () => {
      expect(() => {
        renderer.cleanup();
      }).not.toThrow();
    });

    it('should be safe to call cleanup multiple times', () => {
      expect(() => {
        renderer.cleanup();
        renderer.cleanup();
        renderer.cleanup();
      }).not.toThrow();
    });
  });

  describe('Environment Component Integration', () => {
    it('should accept solid skybox type', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'solid';

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should accept gradient skybox type', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'gradient';

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should accept procedural-sky type', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'procedural-sky';

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle disabled environment component', () => {
      const environment = new EnvironmentComponent();
      environment.enabled = false;
      const mockPassEncoder = {} as GPURenderPassEncoder;

      expect(() => {
        renderer.render(mockPassEncoder, environment);
      }).not.toThrow();
    });

    it('should handle different color configurations', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [1, 0, 0];
      environment.horizonColor = [0, 1, 0];
      environment.groundColor = [0, 0, 1];

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle sun configuration', () => {
      const environment = new EnvironmentComponent();
      environment.sunDirection = [0.5, 0.5, 0.5];
      environment.sunColor = [1, 0.9, 0.8];
      environment.sunIntensity = 0.8;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });
  });

  describe('Matrix and Vector Inputs', () => {
    it('should accept identity matrix', () => {
      const identity: Mat4 = new Float32Array([
        1, 0, 0, 0, 
        0, 1, 0, 0, 
        0, 0, 1, 0, 
        0, 0, 0, 1
      ]) as Mat4;
      const cameraPos: Vec3 = [0, 0, 0];

      expect(() => {
        renderer.updateUniforms(identity, cameraPos);
      }).not.toThrow();
    });

    it('should accept arbitrary camera positions', () => {
      const matrix: Mat4 = new Float32Array(16) as Mat4;
      const positions: Vec3[] = [
        [0, 0, 0],
        [10, 20, 30],
        [-5, -10, -15],
        [100, 0, -100],
      ];

      for (const pos of positions) {
        expect(() => {
          renderer.updateUniforms(matrix, pos);
        }).not.toThrow();
      }
    });
  });

  describe('Multiple Update Cycles', () => {
    it('should handle multiple uniform updates', () => {
      const matrix: Mat4 = new Float32Array(16) as Mat4;
      const cameraPos: Vec3 = [0, 0, 0];

      expect(() => {
        for (let i = 0; i < 100; i++) {
          cameraPos[0] = i;
          renderer.updateUniforms(matrix, cameraPos);
        }
      }).not.toThrow();
    });

    it('should handle multiple params updates', () => {
      const environment = new EnvironmentComponent();

      expect(() => {
        for (let i = 0; i < 100; i++) {
          environment.sunIntensity = i / 100;
          renderer.updateParams(environment);
        }
      }).not.toThrow();
    });

    it('should handle switching between skybox types', () => {
      const environment = new EnvironmentComponent();
      const types: Array<'solid' | 'gradient' | 'procedural-sky'> = [
        'solid',
        'gradient',
        'procedural-sky',
        'gradient',
        'solid',
        'procedural-sky',
      ];

      expect(() => {
        for (const type of types) {
          environment.skyboxType = type;
          renderer.updateParams(environment);
        }
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero sun intensity', () => {
      const environment = new EnvironmentComponent();
      environment.sunIntensity = 0;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle very high sun intensity', () => {
      const environment = new EnvironmentComponent();
      environment.sunIntensity = 10.0;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle negative sun intensity', () => {
      const environment = new EnvironmentComponent();
      environment.sunIntensity = -1.0;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle black colors', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [0, 0, 0];
      environment.horizonColor = [0, 0, 0];
      environment.groundColor = [0, 0, 0];

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle very bright colors', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [10, 10, 10];
      environment.horizonColor = [5, 5, 5];
      environment.groundColor = [2, 2, 2];

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle zero-length sun direction', () => {
      const environment = new EnvironmentComponent();
      environment.sunDirection = [0, 0, 0];

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should maintain state across multiple operations', () => {
      const environment = new EnvironmentComponent();
      const matrix: Mat4 = new Float32Array(16) as Mat4;
      const cameraPos: Vec3 = [5, 10, 15];

      expect(() => {
        renderer.updateUniforms(matrix, cameraPos);
        renderer.updateParams(environment);
        environment.skyboxType = 'gradient';
        renderer.updateParams(environment);
        renderer.updateUniforms(matrix, cameraPos);
      }).not.toThrow();
    });
  });
});

