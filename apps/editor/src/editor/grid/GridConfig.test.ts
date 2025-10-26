import { describe, it, expect } from 'vitest';
import { validateGridConfig, DEFAULT_GRID_CONFIG, type GridConfig } from './GridConfig';

describe('GridConfig', () => {
  describe('DEFAULT_GRID_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_GRID_CONFIG.visible).toBe(true);
      expect(DEFAULT_GRID_CONFIG.cellSize).toBe(1.0);
      expect(DEFAULT_GRID_CONFIG.extent).toBe(20);
      expect(DEFAULT_GRID_CONFIG.planes.horizontal).toBe(true);
      expect(DEFAULT_GRID_CONFIG.planes.vertical).toBe(false);
      expect(DEFAULT_GRID_CONFIG.majorLineInterval).toBe(5);
      expect(DEFAULT_GRID_CONFIG.lineWidth.major).toBe(2);
      expect(DEFAULT_GRID_CONFIG.lineWidth.minor).toBe(1);
    });

    it('should pass its own validation', () => {
      const errors = validateGridConfig(DEFAULT_GRID_CONFIG);
      expect(errors).toEqual([]);
    });
  });

  describe('validateGridConfig', () => {
    describe('cellSize validation', () => {
      it('should accept positive cellSize', () => {
        const errors = validateGridConfig({ cellSize: 1.0 });
        expect(errors).toEqual([]);
      });

      it('should reject zero cellSize', () => {
        const errors = validateGridConfig({ cellSize: 0 });
        expect(errors).toContain('cellSize must be greater than 0');
      });

      it('should reject negative cellSize', () => {
        const errors = validateGridConfig({ cellSize: -1 });
        expect(errors).toContain('cellSize must be greater than 0');
      });

      it('should accept very small positive cellSize', () => {
        const errors = validateGridConfig({ cellSize: 0.001 });
        expect(errors).toEqual([]);
      });

      it('should accept very large cellSize', () => {
        const errors = validateGridConfig({ cellSize: 1000 });
        expect(errors).toEqual([]);
      });
    });

    describe('extent validation', () => {
      it('should accept positive extent', () => {
        const errors = validateGridConfig({ extent: 10 });
        expect(errors).toEqual([]);
      });

      it('should reject zero extent', () => {
        const errors = validateGridConfig({ extent: 0 });
        expect(errors).toContain('extent must be greater than 0');
      });

      it('should reject negative extent', () => {
        const errors = validateGridConfig({ extent: -5 });
        expect(errors).toContain('extent must be greater than 0');
      });

      it('should accept large extent', () => {
        const errors = validateGridConfig({ extent: 1000 });
        expect(errors).toEqual([]);
      });
    });

    describe('majorLineInterval validation', () => {
      it('should accept positive majorLineInterval', () => {
        const errors = validateGridConfig({ majorLineInterval: 5 });
        expect(errors).toEqual([]);
      });

      it('should reject zero majorLineInterval', () => {
        const errors = validateGridConfig({ majorLineInterval: 0 });
        expect(errors).toContain('majorLineInterval must be greater than 0');
      });

      it('should reject negative majorLineInterval', () => {
        const errors = validateGridConfig({ majorLineInterval: -1 });
        expect(errors).toContain('majorLineInterval must be greater than 0');
      });

      it('should accept interval of 1', () => {
        const errors = validateGridConfig({ majorLineInterval: 1 });
        expect(errors).toEqual([]);
      });
    });

    describe('lineWidth validation', () => {
      it('should accept positive major lineWidth', () => {
        const errors = validateGridConfig({ lineWidth: { major: 2, minor: 1 } });
        expect(errors).toEqual([]);
      });

      it('should reject zero major lineWidth', () => {
        const errors = validateGridConfig({ lineWidth: { major: 0, minor: 1 } });
        expect(errors).toContain('lineWidth.major must be greater than 0');
      });

      it('should reject negative major lineWidth', () => {
        const errors = validateGridConfig({ lineWidth: { major: -1, minor: 1 } });
        expect(errors).toContain('lineWidth.major must be greater than 0');
      });

      it('should reject zero minor lineWidth', () => {
        const errors = validateGridConfig({ lineWidth: { major: 2, minor: 0 } });
        expect(errors).toContain('lineWidth.minor must be greater than 0');
      });

      it('should reject negative minor lineWidth', () => {
        const errors = validateGridConfig({ lineWidth: { major: 2, minor: -1 } });
        expect(errors).toContain('lineWidth.minor must be greater than 0');
      });

      it('should accept partial lineWidth (major only)', () => {
        const errors = validateGridConfig({ lineWidth: { major: 3 } } as Partial<GridConfig>);
        expect(errors).toEqual([]);
      });

      it('should accept partial lineWidth (minor only)', () => {
        const errors = validateGridConfig({ lineWidth: { minor: 2 } } as Partial<GridConfig>);
        expect(errors).toEqual([]);
      });
    });

    describe('multiple validation errors', () => {
      it('should return all validation errors', () => {
        const errors = validateGridConfig({
          cellSize: -1,
          extent: 0,
          majorLineInterval: -5,
          lineWidth: { major: 0, minor: -1 },
        });

        expect(errors).toHaveLength(5);
        expect(errors).toContain('cellSize must be greater than 0');
        expect(errors).toContain('extent must be greater than 0');
        expect(errors).toContain('majorLineInterval must be greater than 0');
        expect(errors).toContain('lineWidth.major must be greater than 0');
        expect(errors).toContain('lineWidth.minor must be greater than 0');
      });
    });

    describe('valid configs', () => {
      it('should accept empty config', () => {
        const errors = validateGridConfig({});
        expect(errors).toEqual([]);
      });

      it('should accept full valid config', () => {
        const config: GridConfig = {
          visible: true,
          cellSize: 2.0,
          extent: 50,
          planes: { horizontal: true, vertical: true },
          colors: {
            majorLine: '#ffffff',
            minorLine: '#000000',
            origin: '#ff0000',
          },
          majorLineInterval: 10,
          lineWidth: { major: 3, minor: 1.5 },
        };

        const errors = validateGridConfig(config);
        expect(errors).toEqual([]);
      });

      it('should accept fractional values', () => {
        const errors = validateGridConfig({
          cellSize: 0.5,
          lineWidth: { major: 1.5, minor: 0.5 },
        });
        expect(errors).toEqual([]);
      });
    });

    describe('non-validated fields', () => {
      it('should not validate visible field', () => {
        const errors = validateGridConfig({ visible: false });
        expect(errors).toEqual([]);
      });

      it('should not validate planes field', () => {
        const errors = validateGridConfig({
          planes: { horizontal: false, vertical: false },
        });
        expect(errors).toEqual([]);
      });

      it('should not validate colors field', () => {
        const errors = validateGridConfig({
          colors: {
            majorLine: 'invalid-color',
            minorLine: 'also-invalid',
            origin: 'still-invalid',
          },
        });
        expect(errors).toEqual([]);
      });
    });
  });
});
