import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { RenderGraph, type RenderPassNode } from '../../src/renderer/RenderGraph';

// Mock WebGPU constants that aren't available in test environment
beforeAll(() => {
  (globalThis as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
});

// Minimal GPU mocks to satisfy types during unit tests
const createMockDevice = (): GPUDevice => {
  const mockTexture = {
    createView: vi.fn().mockReturnValue({} as unknown as GPUTextureView),
    destroy: vi.fn(),
  } as unknown as GPUTexture;

  return {
    createTexture: vi.fn().mockReturnValue(mockTexture),
  } as unknown as GPUDevice;
};

const createMockEncoder = (): GPUCommandEncoder => {
  return {} as unknown as GPUCommandEncoder;
};

describe('RenderGraph', () => {
  let device: GPUDevice;
  let graph: RenderGraph;
  let encoder: GPUCommandEncoder;

  beforeEach(() => {
    device = createMockDevice();
    graph = new RenderGraph(device);
    encoder = createMockEncoder();
    graph.setCanvasSize(800, 600);
  });

  describe('topological sorting', () => {
    it('should execute passes in dependency order', () => {
      const executionOrder: string[] = [];

      // Pass A produces texture 't1'
      const passA: RenderPassNode = {
        id: 'passA',
        type: 'render',
        inputs: [],
        outputs: ['t1'],
        execute: () => {
          executionOrder.push('A');
        },
      };

      // Pass B produces texture 't2' and reads 't1' (depends on A)
      const passB: RenderPassNode = {
        id: 'passB',
        type: 'render',
        inputs: ['t1'],
        outputs: ['t2'],
        execute: () => {
          executionOrder.push('B');
        },
      };

      // Pass C reads 't2' (depends on B)
      const passC: RenderPassNode = {
        id: 'passC',
        type: 'render',
        inputs: ['t2'],
        outputs: [],
        execute: () => {
          executionOrder.push('C');
        },
      };

      // Add passes in wrong order (C, A, B)
      graph.addPass(passC);
      graph.addPass(passA);
      graph.addPass(passB);

      // Register transient textures
      graph.registerTransientTexture('t1', 'rgba16float', 800, 600);
      graph.registerTransientTexture('t2', 'rgba16float', 800, 600);

      graph.execute(encoder);

      // Should execute in correct order: A -> B -> C
      expect(executionOrder).toEqual(['A', 'B', 'C']);
    });

    it('should handle multiple independent passes', () => {
      const executionOrder: string[] = [];

      const passA: RenderPassNode = {
        id: 'passA',
        type: 'render',
        inputs: [],
        outputs: ['t1'],
        execute: () => {
          executionOrder.push('A');
        },
      };

      const passB: RenderPassNode = {
        id: 'passB',
        type: 'render',
        inputs: [],
        outputs: ['t2'],
        execute: () => {
          executionOrder.push('B');
        },
      };

      const passC: RenderPassNode = {
        id: 'passC',
        type: 'render',
        inputs: ['t1', 't2'],
        outputs: [],
        execute: () => {
          executionOrder.push('C');
        },
      };

      // Add in wrong order
      graph.addPass(passC);
      graph.addPass(passB);
      graph.addPass(passA);

      graph.registerTransientTexture('t1', 'rgba16float', 800, 600);
      graph.registerTransientTexture('t2', 'rgba16float', 800, 600);

      graph.execute(encoder);

      // A and B can execute in any order, but both before C
      expect(executionOrder).toHaveLength(3);
      expect(executionOrder).toContain('A');
      expect(executionOrder).toContain('B');
      expect(executionOrder[2]).toBe('C'); // C must be last
      expect(executionOrder.indexOf('A')).toBeLessThan(executionOrder.indexOf('C'));
      expect(executionOrder.indexOf('B')).toBeLessThan(executionOrder.indexOf('C'));
    });

    it('should detect cycles and log error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Pass A produces 't1', reads 't2' (circular dependency)
      const passA: RenderPassNode = {
        id: 'passA',
        type: 'render',
        inputs: ['t2'],
        outputs: ['t1'],
        execute: () => {},
      };

      // Pass B produces 't2', reads 't1' (circular dependency)
      const passB: RenderPassNode = {
        id: 'passB',
        type: 'render',
        inputs: ['t1'],
        outputs: ['t2'],
        execute: () => {},
      };

      graph.addPass(passA);
      graph.addPass(passB);

      graph.registerTransientTexture('t1', 'rgba16float', 800, 600);
      graph.registerTransientTexture('t2', 'rgba16float', 800, 600);

      graph.execute(encoder);

      // Should detect cycle and log error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RenderGraph] Cycle detected')
      );

      consoleSpy.mockRestore();
    });

    it('should handle passes with no dependencies', () => {
      const executionOrder: string[] = [];

      const passA: RenderPassNode = {
        id: 'passA',
        type: 'render',
        inputs: [],
        outputs: [],
        execute: () => {
          executionOrder.push('A');
        },
      };

      const passB: RenderPassNode = {
        id: 'passB',
        type: 'render',
        inputs: [],
        outputs: [],
        execute: () => {
          executionOrder.push('B');
        },
      };

      graph.addPass(passA);
      graph.addPass(passB);

      graph.execute(encoder);

      // Both should execute
      expect(executionOrder).toHaveLength(2);
      expect(executionOrder).toContain('A');
      expect(executionOrder).toContain('B');
    });

    it('should handle empty pass list', () => {
      expect(() => {
        graph.execute(encoder);
      }).not.toThrow();
    });
  });
});

