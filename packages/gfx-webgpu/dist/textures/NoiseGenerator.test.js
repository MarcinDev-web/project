import { describe, it, expect } from 'vitest';
import { PerlinNoise, SimplexNoise, WorleyNoise, NoiseUtils } from './NoiseGenerator';
describe('PerlinNoise', () => {
    describe('constructor', () => {
        it('should create instance with default seed', () => {
            const noise = new PerlinNoise();
            expect(noise).toBeDefined();
        });
        it('should create instance with custom seed', () => {
            const noise = new PerlinNoise(12345);
            expect(noise).toBeDefined();
        });
        it('should produce same results with same seed', () => {
            const noise1 = new PerlinNoise(42);
            const noise2 = new PerlinNoise(42);
            const value1 = noise1.noise(1.5, 2.5);
            const value2 = noise2.noise(1.5, 2.5);
            expect(value1).toBe(value2);
        });
        it('should produce different results with different seeds', () => {
            const noise1 = new PerlinNoise(42);
            const noise2 = new PerlinNoise(123);
            const value1 = noise1.noise(1.5, 2.5);
            const value2 = noise2.noise(1.5, 2.5);
            expect(value1).not.toBe(value2);
        });
    });
    describe('noise', () => {
        it('should return values in range [-1, 1]', () => {
            const noise = new PerlinNoise(42);
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * 100;
                const y = Math.random() * 100;
                const value = noise.noise(x, y);
                expect(value).toBeGreaterThanOrEqual(-1);
                expect(value).toBeLessThanOrEqual(1);
            }
        });
        it('should be continuous', () => {
            const noise = new PerlinNoise(42);
            const step = 0.001;
            const v1 = noise.noise(5.0, 5.0);
            const v2 = noise.noise(5.0 + step, 5.0);
            // Adjacent samples should be similar
            expect(Math.abs(v2 - v1)).toBeLessThan(0.1);
        });
        it('should return same value for same coordinates', () => {
            const noise = new PerlinNoise(42);
            const v1 = noise.noise(3.5, 7.2);
            const v2 = noise.noise(3.5, 7.2);
            expect(v1).toBe(v2);
        });
    });
    describe('octaveNoise', () => {
        it('should return values in range [-1, 1]', () => {
            const noise = new PerlinNoise(42);
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * 100;
                const y = Math.random() * 100;
                const value = noise.octaveNoise(x, y, 4);
                expect(value).toBeGreaterThanOrEqual(-1);
                expect(value).toBeLessThanOrEqual(1);
            }
        });
        it('should have more detail with more octaves', () => {
            const noise = new PerlinNoise(42);
            // Single octave should be smoother
            const smooth = noise.octaveNoise(5.5, 5.5, 1);
            const detailed = noise.octaveNoise(5.5, 5.5, 8);
            // Both should be valid values
            expect(Math.abs(smooth)).toBeLessThanOrEqual(1);
            expect(Math.abs(detailed)).toBeLessThanOrEqual(1);
        });
    });
});
describe('SimplexNoise', () => {
    describe('constructor', () => {
        it('should create instance with default seed', () => {
            const noise = new SimplexNoise();
            expect(noise).toBeDefined();
        });
        it('should create instance with custom seed', () => {
            const noise = new SimplexNoise(12345);
            expect(noise).toBeDefined();
        });
        it('should produce same results with same seed', () => {
            const noise1 = new SimplexNoise(42);
            const noise2 = new SimplexNoise(42);
            const value1 = noise1.noise(1.5, 2.5);
            const value2 = noise2.noise(1.5, 2.5);
            expect(value1).toBe(value2);
        });
    });
    describe('noise', () => {
        it('should return values in range [-1, 1]', () => {
            const noise = new SimplexNoise(42);
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * 100;
                const y = Math.random() * 100;
                const value = noise.noise(x, y);
                expect(value).toBeGreaterThanOrEqual(-1);
                expect(value).toBeLessThanOrEqual(1);
            }
        });
        it('should be continuous', () => {
            const noise = new SimplexNoise(42);
            const step = 0.001;
            const v1 = noise.noise(5.0, 5.0);
            const v2 = noise.noise(5.0 + step, 5.0);
            // Adjacent samples should be similar
            expect(Math.abs(v2 - v1)).toBeLessThan(0.1);
        });
    });
    describe('octaveNoise', () => {
        it('should return values in range [-1, 1]', () => {
            const noise = new SimplexNoise(42);
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * 100;
                const y = Math.random() * 100;
                const value = noise.octaveNoise(x, y, 4);
                expect(value).toBeGreaterThanOrEqual(-1);
                expect(value).toBeLessThanOrEqual(1);
            }
        });
    });
});
describe('WorleyNoise', () => {
    describe('constructor', () => {
        it('should create instance with default seed', () => {
            const noise = new WorleyNoise();
            expect(noise).toBeDefined();
        });
        it('should create instance with custom seed', () => {
            const noise = new WorleyNoise(12345);
            expect(noise).toBeDefined();
        });
        it('should produce same results with same seed', () => {
            const noise1 = new WorleyNoise(42);
            const noise2 = new WorleyNoise(42);
            const value1 = noise1.noise(1.5, 2.5);
            const value2 = noise2.noise(1.5, 2.5);
            expect(value1).toBe(value2);
        });
    });
    describe('noise', () => {
        it('should return positive values', () => {
            const noise = new WorleyNoise(42);
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * 100;
                const y = Math.random() * 100;
                const value = noise.noise(x, y);
                expect(value).toBeGreaterThanOrEqual(0);
            }
        });
        it('should support different distance metrics', () => {
            const noise = new WorleyNoise(42);
            const euclidean = noise.noise(5.5, 5.5, 'euclidean');
            const manhattan = noise.noise(5.5, 5.5, 'manhattan');
            const chebyshev = noise.noise(5.5, 5.5, 'chebyshev');
            // All should be valid positive values
            expect(euclidean).toBeGreaterThanOrEqual(0);
            expect(manhattan).toBeGreaterThanOrEqual(0);
            expect(chebyshev).toBeGreaterThanOrEqual(0);
            // Different metrics should give different results
            expect(euclidean).not.toBe(manhattan);
        });
        it('should return 0 at cell center', () => {
            const noise = new WorleyNoise(42);
            // Values very close to feature points should be close to 0
            for (let i = 0; i < 10; i++) {
                const x = Math.floor(Math.random() * 10) + 0.5;
                const y = Math.floor(Math.random() * 10) + 0.5;
                const value = noise.noise(x, y);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThan(1);
            }
        });
    });
    describe('noiseN', () => {
        it('should return N distances', () => {
            const noise = new WorleyNoise(42);
            const distances = noise.noiseN(5.5, 5.5, 3);
            expect(distances).toHaveLength(3);
            expect(distances[0]).toBeLessThanOrEqual(distances[1]);
            expect(distances[1]).toBeLessThanOrEqual(distances[2]);
        });
        it('should return sorted distances', () => {
            const noise = new WorleyNoise(42);
            const distances = noise.noiseN(7.3, 3.8, 5);
            for (let i = 1; i < distances.length; i++) {
                expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
            }
        });
    });
});
describe('NoiseUtils', () => {
    describe('normalize', () => {
        it('should map [-1, 1] to [0, 1]', () => {
            expect(NoiseUtils.normalize(-1)).toBe(0);
            expect(NoiseUtils.normalize(0)).toBe(0.5);
            expect(NoiseUtils.normalize(1)).toBe(1);
        });
        it('should handle intermediate values', () => {
            expect(NoiseUtils.normalize(-0.5)).toBe(0.25);
            expect(NoiseUtils.normalize(0.5)).toBe(0.75);
        });
    });
    describe('clamp01', () => {
        it('should clamp values to [0, 1]', () => {
            expect(NoiseUtils.clamp01(-1)).toBe(0);
            expect(NoiseUtils.clamp01(0)).toBe(0);
            expect(NoiseUtils.clamp01(0.5)).toBe(0.5);
            expect(NoiseUtils.clamp01(1)).toBe(1);
            expect(NoiseUtils.clamp01(2)).toBe(1);
        });
    });
    describe('power', () => {
        it('should apply power curve', () => {
            expect(NoiseUtils.power(0.5, 2)).toBe(0.25);
            expect(NoiseUtils.power(0.5, 3)).toBe(0.125);
            expect(NoiseUtils.power(1, 10)).toBe(1);
            expect(NoiseUtils.power(0, 10)).toBe(0);
        });
    });
    describe('remap', () => {
        it('should remap values between ranges', () => {
            expect(NoiseUtils.remap(0, 0, 1, 0, 100)).toBe(0);
            expect(NoiseUtils.remap(1, 0, 1, 0, 100)).toBe(100);
            expect(NoiseUtils.remap(0.5, 0, 1, 0, 100)).toBe(50);
        });
        it('should handle different ranges', () => {
            expect(NoiseUtils.remap(-1, -1, 1, 0, 1)).toBe(0);
            expect(NoiseUtils.remap(0, -1, 1, 0, 1)).toBe(0.5);
            expect(NoiseUtils.remap(1, -1, 1, 0, 1)).toBe(1);
        });
    });
    describe('ridge', () => {
        it('should create ridged pattern', () => {
            expect(NoiseUtils.ridge(0)).toBe(1);
            expect(NoiseUtils.ridge(1)).toBe(0);
            expect(NoiseUtils.ridge(-1)).toBe(0);
            expect(NoiseUtils.ridge(0.5)).toBe(0.5);
        });
    });
    describe('turbulence', () => {
        it('should produce positive values', () => {
            const noise = new PerlinNoise(42);
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * 10;
                const y = Math.random() * 10;
                const value = NoiseUtils.turbulence(noise, x, y, 4);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
            }
        });
    });
});
//# sourceMappingURL=NoiseGenerator.test.js.map