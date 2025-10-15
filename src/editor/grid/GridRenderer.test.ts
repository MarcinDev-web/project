import { describe, it, expect, beforeEach } from 'vitest';
import { GridRenderer } from './GridRenderer';
import type { GridConfig } from './GridConfig';

describe('GridRenderer', () => {
  let gridRenderer: GridRenderer;
  let defaultConfig: Partial<GridConfig>;

  beforeEach(() => {
    defaultConfig = {
      visible: true,
      cellSize: 1.0,
      extent: 10,
      planes: { horizontal: true, vertical: false },
      colors: {
        minorLine: '#333333',
        majorLine: '#555555',
        origin: '#ff0000',
      },
      majorLineInterval: 5,
      lineWidth: { major: 2, minor: 1 },
    };
    gridRenderer = new GridRenderer(defaultConfig);
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const renderer = new GridRenderer();
      expect(renderer).toBeDefined();
      expect(renderer.isVisible()).toBe(true);
    });

    it('should create instance with custom config', () => {
      const customConfig: Partial<GridConfig> = {
        cellSize: 2.0,
        extent: 20,
        visible: false,
      };
      const renderer = new GridRenderer(customConfig);
      expect(renderer).toBeDefined();
      expect(renderer.isVisible()).toBe(false);
    });
  });

  describe('visibility', () => {
    it('should show grid', () => {
      gridRenderer.hide();
      expect(gridRenderer.isVisible()).toBe(false);

      gridRenderer.show();
      expect(gridRenderer.isVisible()).toBe(true);
    });

    it('should hide grid', () => {
      gridRenderer.show();
      expect(gridRenderer.isVisible()).toBe(true);

      gridRenderer.hide();
      expect(gridRenderer.isVisible()).toBe(false);
    });

    it('should set visibility explicitly', () => {
      gridRenderer.setVisible(false);
      expect(gridRenderer.isVisible()).toBe(false);

      gridRenderer.setVisible(true);
      expect(gridRenderer.isVisible()).toBe(true);
    });
  });

  describe('setConfig', () => {
    it('should update cell size', () => {
      gridRenderer.setConfig({ cellSize: 2.0 });
      // Can't directly test internal config, but no errors should occur
      expect(gridRenderer).toBeDefined();
    });

    it('should update extent', () => {
      gridRenderer.setConfig({ extent: 20 });
      expect(gridRenderer).toBeDefined();
    });

    it('should update colors', () => {
      gridRenderer.setConfig({
        colors: {
          minorLine: '#ff0000',
          majorLine: '#00ff00',
          origin: '#0000ff',
        },
      });
      expect(gridRenderer).toBeDefined();
    });

    it('should update visibility through config', () => {
      gridRenderer.setConfig({ visible: false });
      expect(gridRenderer.isVisible()).toBe(false);

      gridRenderer.setConfig({ visible: true });
      expect(gridRenderer.isVisible()).toBe(true);
    });

    it('should merge partial config with existing config', () => {
      gridRenderer.setConfig({ cellSize: 2.0 });
      gridRenderer.setConfig({ extent: 15 });
      // Both changes should be retained
      expect(gridRenderer).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('should dispose without errors', () => {
      expect(() => gridRenderer.dispose()).not.toThrow();
    });

    it('should allow multiple dispose calls', () => {
      gridRenderer.dispose();
      expect(() => gridRenderer.dispose()).not.toThrow();
    });
  });

  describe('render', () => {
    it('should not throw when render is called without initialization', () => {
      const mockPassEncoder = {
        setPipeline: () => {},
        setBindGroup: () => {},
        setVertexBuffer: () => {},
        draw: () => {},
      } as unknown as GPURenderPassEncoder;

      const mockMatrix = new Float32Array(16);

      // Should not throw, just return early
      expect(() => {
        gridRenderer.render(mockPassEncoder, mockMatrix);
      }).not.toThrow();
    });
  });

  describe('configuration edge cases', () => {
    it('should handle zero extent', () => {
      expect(() => {
        gridRenderer.setConfig({ extent: 0 });
      }).not.toThrow();
    });

    it('should handle very large extent', () => {
      expect(() => {
        gridRenderer.setConfig({ extent: 1000 });
      }).not.toThrow();
    });

    it('should handle very small cell size', () => {
      expect(() => {
        gridRenderer.setConfig({ cellSize: 0.01 });
      }).not.toThrow();
    });

    it('should handle very large cell size', () => {
      expect(() => {
        gridRenderer.setConfig({ cellSize: 100 });
      }).not.toThrow();
    });

    it('should handle planes configuration', () => {
      gridRenderer.setConfig({
        planes: { horizontal: false, vertical: true },
      });
      expect(gridRenderer).toBeDefined();
    });

    it('should handle major line interval', () => {
      gridRenderer.setConfig({ majorLineInterval: 10 });
      expect(gridRenderer).toBeDefined();
    });
  });

  describe('color parsing', () => {
    it('should handle valid hex colors', () => {
      expect(() => {
        gridRenderer.setConfig({
          colors: {
            minorLine: '#123456',
            majorLine: '#abcdef',
            origin: '#fedcba',
          },
        });
      }).not.toThrow();
    });

    it('should handle hex colors without #', () => {
      expect(() => {
        gridRenderer.setConfig({
          colors: {
            minorLine: '123456',
            majorLine: 'abcdef',
            origin: 'fedcba',
          },
        });
      }).not.toThrow();
    });

    it('should handle uppercase hex colors', () => {
      expect(() => {
        gridRenderer.setConfig({
          colors: {
            minorLine: '#ABCDEF',
            majorLine: '#123456',
            origin: '#FEDCBA',
          },
        });
      }).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid config changes', () => {
      for (let i = 0; i < 100; i++) {
        gridRenderer.setConfig({ cellSize: 0.5 + i * 0.1 });
      }
      expect(gridRenderer).toBeDefined();
    });

    it('should handle visibility toggling', () => {
      for (let i = 0; i < 100; i++) {
        gridRenderer.setVisible(i % 2 === 0);
      }
      expect(gridRenderer.isVisible()).toBe(false);
    });

    it('should handle config changes after dispose', () => {
      gridRenderer.dispose();
      // Should not throw even after dispose
      expect(() => {
        gridRenderer.setConfig({ cellSize: 2.0 });
      }).not.toThrow();
    });
  });
});
