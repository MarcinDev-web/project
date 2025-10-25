import { describe, expect, it } from 'vitest';
import { createMainShaderCode } from './main';
import { ShaderEntryPoint } from './types';

describe('createMainShaderCode', () => {
  it('includes expected entry points', () => {
    const code = createMainShaderCode();

    expect(code).toContain(`@vertex\nfn ${ShaderEntryPoint.VERTEX_MAIN}`);
    expect(code).toContain(`@fragment\nfn ${ShaderEntryPoint.FRAGMENT_MAIN}`);
    expect(code).toContain(`@fragment\nfn ${ShaderEntryPoint.FRAGMENT_OVERLAY}`);
  });

  it('contains uniform struct with shading params', () => {
    const code = createMainShaderCode();

    expect(code).toMatch(/struct Uniforms/);
    expect(code).toContain('viewProjectionMatrix : mat4x4<f32>');
    expect(code).toContain('shadingParams0 : vec4<f32>');
  });

  it('includes shader sections for vertex and fragment stages', () => {
    const code = createMainShaderCode();

    expect(code).toContain('struct VertexOutput');
    expect(code).toContain('fn quat_rotate');
    expect(code).toContain('@fragment\nfn fs_main');
    expect(code).toContain('@fragment\nfn fs_overlay');
    // Atlas-based sampling: atlasUV computed from rect metadata, sampled from atlasTex
    expect(code).toMatch(/let atlasUV = rect\.xy \+ vUV \* rect\.zw;/);
    expect(code).toMatch(/textureSample\(atlasTex, texSampler, atlasUV\)/);
  });
});
