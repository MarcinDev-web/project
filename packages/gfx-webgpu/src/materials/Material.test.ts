import { describe, it, expect } from 'vitest';
import { Material } from './Material';

describe('Material', () => {
  it('initializes with default values and allows property mutation', () => {
    const material = new Material();

    expect(material.color).toEqual([1, 1, 1, 1]);
    expect(material.metallic).toBe(0);
    expect(material.roughness).toBe(1);

    material.color = [0.2, 0.3, 0.4, 1];
    material.metallic = 0.8;
    material.roughness = 0.1;

    expect(material.color).toEqual([0.2, 0.3, 0.4, 1]);
    expect(material.metallic).toBe(0.8);
    expect(material.roughness).toBe(0.1);
  });
});
