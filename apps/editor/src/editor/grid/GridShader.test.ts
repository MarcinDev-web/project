import { describe, it, expect, beforeEach } from 'vitest';
import { GridShaderEntryPoint, createGridShaderCode } from './GridShader';

describe('GridShader', () => {
  describe('GridShaderEntryPoint', () => {
    it('should have vertex entry point', () => {
      expect(GridShaderEntryPoint.VERTEX).toBe('vs_grid');
    });

    it('should have fragment entry point', () => {
      expect(GridShaderEntryPoint.FRAGMENT).toBe('fs_grid');
    });
  });

  describe('createGridShaderCode', () => {
    let shaderCode: string;

    beforeEach(() => {
      shaderCode = createGridShaderCode();
    });

    it('should return non-empty string', () => {
      expect(shaderCode).toBeDefined();
      expect(shaderCode.length).toBeGreaterThan(0);
    });

    describe('uniform structure', () => {
      it('should define GridUniforms struct', () => {
        expect(shaderCode).toContain('struct GridUniforms');
      });

      it('should have viewProjectionMatrix in uniforms', () => {
        expect(shaderCode).toContain('viewProjectionMatrix : mat4x4<f32>');
      });

      it('should declare uniform variable', () => {
        expect(shaderCode).toContain('@group(0) @binding(0)');
        expect(shaderCode).toContain('var<uniform> u : GridUniforms');
      });
    });

    describe('vertex output structure', () => {
      it('should define VertexOutput struct', () => {
        expect(shaderCode).toContain('struct VertexOutput');
      });

      it('should have builtin position', () => {
        expect(shaderCode).toContain('@builtin(position) position : vec4<f32>');
      });

      it('should have worldPos output at location 0', () => {
        expect(shaderCode).toContain('@location(0) worldPos : vec3<f32>');
      });
    });

    describe('vertex shader', () => {
      it('should define vertex function', () => {
        expect(shaderCode).toContain('@vertex');
        expect(shaderCode).toContain('fn vs_grid');
      });

      it('should use vertex_index builtin', () => {
        expect(shaderCode).toContain('@builtin(vertex_index) vertexIndex : u32');
      });

      it('should return VertexOutput', () => {
        expect(shaderCode).toMatch(/fn vs_grid[^{]+-> VertexOutput/);
      });

      it('should calculate world position', () => {
        expect(shaderCode).toContain('let worldPos = vec3<f32>');
      });

      it('should transform position by viewProjectionMatrix', () => {
        expect(shaderCode).toContain(
          'u.viewProjectionMatrix * vec4<f32>(worldPos, 1.0)'
        );
      });

      it('should return output', () => {
        expect(shaderCode).toContain('return output;');
      });
    });

    describe('fragment shader', () => {
      it('should define fragment function', () => {
        expect(shaderCode).toContain('@fragment');
        expect(shaderCode).toContain('fn fs_grid');
      });

      it('should accept VertexOutput parameter', () => {
        expect(shaderCode).toMatch(/fn fs_grid\s*\(\s*input\s*:\s*VertexOutput\s*\)/);
      });

      it('should return color at location 0', () => {
        expect(shaderCode).toMatch(/fn fs_grid[^{]+-> @location\(0\) vec4<f32>/);
      });

      it('should calculate grid lines', () => {
        expect(shaderCode).toContain('getGridLine');
        expect(shaderCode).toContain('minorGrid');
        expect(shaderCode).toContain('majorGrid');
      });
    });

    describe('WGSL syntax validation', () => {
      it('should use correct struct syntax', () => {
        // Check that all structs are properly closed
        const structCount = (shaderCode.match(/struct\s+\w+\s*{/g) || []).length;
        const closingBraces = (shaderCode.match(/}\s*;/g) || []).length;
        expect(closingBraces).toBeGreaterThanOrEqual(structCount);
      });

      it('should use correct function syntax', () => {
        // Check that functions have proper syntax
        expect(shaderCode).toMatch(/@vertex\s+fn\s+\w+/);
        expect(shaderCode).toMatch(/@fragment\s+fn\s+\w+/);
      });

      it('should use correct builtin syntax', () => {
        expect(shaderCode).toContain('@builtin(position)');
      });

      it('should use correct binding syntax', () => {
        expect(shaderCode).toMatch(/@group\(\d+\)\s+@binding\(\d+\)/);
      });
    });

    describe('type correctness', () => {
      it('should use f32 for floating point types', () => {
        expect(shaderCode).toContain('vec3<f32>');
        expect(shaderCode).toContain('vec4<f32>');
        expect(shaderCode).toContain('mat4x4<f32>');
      });
    });
  });
});
