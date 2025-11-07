import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestCheckTrs } from '../../wasm/collisionWorkerClient';

// Mock Web Worker for Node.js environment
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  private messageHandlers: Array<(data: any) => void> = [];

  constructor(_url: string | URL, _options?: WorkerOptions) {
    // Simulate worker initialization
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: { type: 'ready' } } as MessageEvent);
      }
    }, 0);
  }

  postMessage(data: any): void {
    // Simulate worker processing
    setTimeout(() => {
      if (this.onmessage && data.id) {
        // Return mock indices array
        const indices = new Uint32Array([0, 1, 2]);
        this.onmessage({
          data: {
            id: data.id,
            ok: true,
            indices,
          },
        } as MessageEvent);
      }
    }, 10);
  }

  terminate(): void {
    // Cleanup
  }
}

// Mock Worker global
global.Worker = MockWorker as any;

describe('collision worker smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns indices array', async () => {
    const indices = await requestCheckTrs(
      {
        pos: new Float32Array([0, 0, 0]),
        rot: new Float32Array([0, 0, 0, 1]),
        scl: new Float32Array([1, 1, 1]),
      },
      {
        positions: new Float32Array([2, 0, 0]),
        rotations: new Float32Array([0, 0, 0, 1]),
        scales: new Float32Array([1, 1, 1]),
      },
      1000
    );
    expect(indices).toBeInstanceOf(Uint32Array);
    expect(indices.length).toBeGreaterThanOrEqual(0);
  });
});


