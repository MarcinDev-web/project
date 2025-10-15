import { describe, it, expect } from 'vitest';
import { createPbrShaderCode } from './pbr';
import { ShaderEntryPoint } from './types';

describe('createPbrShaderCode', () => {
  it('includes expected entry points', () => {
    const code = createPbrShaderCode();
    expect(code).toContain(`@vertex\nfn ${ShaderEntryPoint.VERTEX_MAIN}`);
    expect(code).toContain(`@fragment\nfn ${ShaderEntryPoint.FRAGMENT_MAIN}`);
    expect(code).toContain(`@fragment\nfn ${ShaderEntryPoint.FRAGMENT_OVERLAY}`);
  });

  it('contains PBR core functions', () => {
    const code = createPbrShaderCode();
    expect(code).toContain('fresnel_schlick');
    expect(code).toContain('distribution_ggx');
    expect(code).toContain('geometry_smith');
  });

  it('uses atlas sampling and normal mapping', () => {
    const code = createPbrShaderCode();
    expect(code).toMatch(/let atlasUV = atlasOffset \+ vUV \* atlasScale;/);
    expect(code).toMatch(/textureSample\(normalAtlasTex, texSampler, atlasUV\)/);
  });
});


