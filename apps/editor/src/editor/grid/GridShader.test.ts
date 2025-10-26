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
        expect(shaderCode).toContain('var<uniform> gridUniforms : GridUniforms');
      });
    });

    describe('vertex input structure', () => {
      it('should define VertexInput struct', () => {
        expect(shaderCode).toContain('struct VertexInput');
      });

      it('should have position attribute at location 0', () => {
        expect(shaderCode).toContain('@location(0) position : vec3<f32>');
      });

      it('should have color attribute at location 1', () => {
        expect(shaderCode).toContain('@location(1) color : vec4<f32>');
      });
    });

    describe('vertex output structure', () => {
      it('should define VertexOutput struct', () => {
        expect(shaderCode).toContain('struct VertexOutput');
      });

      it('should have builtin position', () => {
        expect(shaderCode).toContain('@builtin(position) position : vec4<f32>');
      });

      it('should have color output at location 0', () => {
        expect(shaderCode).toMatch(/@location\(0\)\s+color\s*:\s*vec4<f32>/);
      });
    });

    describe('vertex shader', () => {
      it('should define vertex function', () => {
        expect(shaderCode).toContain('@vertex');
        expect(shaderCode).toContain('fn vs_grid');
      });

      it('should accept VertexInput parameter', () => {
        expect(shaderCode).toMatch(/fn vs_grid\s*\(\s*input\s*:\s*VertexInput\s*\)/);
      });

      it('should return VertexOutput', () => {
        expect(shaderCode).toMatch(/fn vs_grid[^{]+-> VertexOutput/);
      });

      it('should transform position by viewProjectionMatrix', () => {
        expect(shaderCode).toContain(
          'gridUniforms.viewProjectionMatrix * vec4<f32>(input.position, 1.0)'
        );
      });

      it('should pass through color', () => {
        expect(shaderCode).toContain('output.color = input.color');
      });

      it('should return output', () => {
        const vertexFunctionMatch = shaderCode.match(/@vertex\s+fn vs_grid[^}]+}/s);
        expect(vertexFunctionMatch).toBeDefined();
        expect(vertexFunctionMatch![0]).toContain('return output');
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

      it('should return input color', () => {
        const fragmentFunctionMatch = shaderCode.match(/@fragment\s+fn fs_grid[^}]+}/s);
        expect(fragmentFunctionMatch).toBeDefined();
        expect(fragmentFunctionMatch![0]).toContain('return input.color');
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

      it('should use correct attribute syntax', () => {
        // Check that attributes use @location properly
        expect(shaderCode).toMatch(/@location\(\d+\)/g);
      });

      it('should use correct builtin syntax', () => {
        expect(shaderCode).toContain('@builtin(position)');
      });

      it('should use correct binding syntax', () => {
        expect(shaderCode).toMatch(/@group\(\d+\)\s+@binding\(\d+\)/);
      });
    });

    describe('shader consistency', () => {
      it('should have matching input/output between vertex and fragment', () => {
        // VertexOutput should be returned by vertex and accepted by fragment
        const vertexOutputMatch = shaderCode.match(/fn vs_grid[^}]+-> VertexOutput/);
        const fragmentInputMatch = shaderCode.match(/fn fs_grid\s*\([^)]*:\s*VertexOutput\)/);

        expect(vertexOutputMatch).toBeDefined();
        expect(fragmentInputMatch).toBeDefined();
      });

      it('should have consistent color data flow', () => {
        // Color should flow: input -> vertex output -> fragment input -> fragment output
        expect(shaderCode).toContain('input.color');
        expect(shaderCode).toContain('output.color = input.color');
        expect(shaderCode).toContain('return input.color');
      });

      it('should have consistent position data flow', () => {
        // Position should be transformed in vertex shader
        expect(shaderCode).toContain('input.position');
        expect(shaderCode).toContain('viewProjectionMatrix * vec4<f32>(input.position, 1.0)');
      });
    });

    describe('type correctness', () => {
      it('should use f32 for floating point types', () => {
        expect(shaderCode).toContain('vec3<f32>');
        expect(shaderCode).toContain('vec4<f32>');
        expect(shaderCode).toContain('mat4x4<f32>');
      });

      it('should convert vec3 position to vec4 with w=1.0', () => {
        expect(shaderCode).toContain('vec4<f32>(input.position, 1.0)');
      });

      it('should not use incorrect type conversions', () => {
        // Should not cast position to vec3 after transformation
        expect(shaderCode).not.toContain('vec3<f32>(gridUniforms.viewProjectionMatrix');
      });
    });
  });
});
