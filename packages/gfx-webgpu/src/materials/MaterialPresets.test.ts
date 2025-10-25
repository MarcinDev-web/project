import { describe, it, expect } from 'vitest';
import { createPreset } from './MaterialPresets';

describe('MaterialPresets', () => {
  it('creates polished metal with high metallic and low roughness', () => {
    const m = createPreset('metal_polished');
    expect(m.metallic).toBe(1);
    expect(m.roughness).toBeLessThan(0.2);
  });

  it('creates clear glass as transparent and double-sided', () => {
    const m = createPreset('glass_clear');
    expect(m.alphaMode).toBe('BLEND');
    expect(m.doubleSided).toBe(true);
    expect(m.opacity).toBeLessThan(0.5);
  });

  it('creates emissive neon with non-zero emission', () => {
    const m = createPreset('emissive_neon');
    expect(m.emissiveIntensity).toBeGreaterThan(0);
    expect(m.emissive[2]).toBeGreaterThan(m.emissive[0]);
  });
});


