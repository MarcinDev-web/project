import type { Trs, TrsArray } from '@engine/wasm-collision';

type Pending = {
  resolve: (v: Uint32Array) => void;
  reject: (e: unknown) => void;
  timeoutId: any;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let inFlight = false;
const queue: Array<() => void> = [];

function ensureWorker(): void {
  if (worker) return;
  worker = new Worker(new URL('../workers/collisionWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev: MessageEvent<any>) => {
    const msg = ev.data as { id: number; ok: boolean; indices?: Uint32Array; error?: string };
    if (!msg || typeof msg.id !== 'number') return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timeoutId);
    if (msg.ok && msg.indices) p.resolve(msg.indices);
    else p.reject(new Error(msg.error || 'Worker error'));
    inFlight = false;
    const next = queue.shift();
    if (next) next();
  };
}

export function requestCheckTrs(preview: Trs, others: TrsArray, timeoutMs = 16, signal?: AbortSignal): Promise<Uint32Array> {
  ensureWorker();
  const id = nextId++;
  const payload = { id, type: 'checkTrs' as const, preview, others };
  return new Promise<Uint32Array>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pending.delete(id);
      reject(new Error('collision worker timeout'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timeoutId });
    const send = () => {
      if (signal?.aborted) {
        clearTimeout(timeoutId);
        pending.delete(id);
        reject(new Error('aborted'));
        return;
      }
      inFlight = true;
      worker!.postMessage(payload, [
        preview.pos.buffer,
        preview.rot.buffer,
        preview.scl.buffer,
        others.positions.buffer,
        others.rotations.buffer,
        others.scales.buffer,
      ]);
    };
    if (inFlight) queue.push(send);
    else send();
    signal?.addEventListener('abort', () => {
      if (pending.has(id)) {
        clearTimeout(timeoutId);
        pending.delete(id);
        reject(new Error('aborted'));
      }
    }, { once: true });
  });
}

export function warmupCollisionWorker(): void {
  try {
    ensureWorker();
    const preview: Trs = {
      pos: new Float32Array([0, 0, 0]),
      rot: new Float32Array([0, 0, 0, 1]),
      scl: new Float32Array([1, 1, 1]),
    };
    const empty: TrsArray = {
      positions: new Float32Array(0),
      rotations: new Float32Array(0),
      scales: new Float32Array(0),
    };
    void requestCheckTrs(preview, empty, 100).catch(() => {});
  } catch {
    // ignore
  }
}


