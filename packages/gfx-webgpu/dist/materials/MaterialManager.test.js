import { describe, it, expect } from 'vitest';
import { Material } from './Material';
import { MaterialManager } from './MaterialManager';
describe('MaterialManager', () => {
    it('registers, clones, serializes and deserializes materials', () => {
        const mm = new MaterialManager();
        const m = new Material();
        m.color = [0.2, 0.3, 0.4, 1];
        m.metallic = 0.6;
        m.roughness = 0.3;
        m.emissive = [1, 0.8, 0.2];
        m.emissiveIntensity = 2.5;
        m.opacity = 0.9;
        m.alphaMode = 'MASK';
        m.alphaCutoff = 0.4;
        m.doubleSided = true;
        mm.register('m1', m);
        expect(mm.has('m1')).toBe(true);
        const clone = mm.clone('m1', 'm2');
        expect(mm.has('m2')).toBe(true);
        expect(clone.roughness).toBe(0.3);
        expect(clone.emissiveIntensity).toBe(2.5);
        const serialized = mm.serialize('m2');
        expect(serialized.alphaMode).toBe('MASK');
        const restored = mm.deserialize('m3', serialized);
        expect(restored.doubleSided).toBe(true);
        expect(restored.color).toEqual([0.2, 0.3, 0.4, 1]);
    });
});
//# sourceMappingURL=MaterialManager.test.js.map