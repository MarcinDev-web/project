import { init, type Trs, type TrsArray } from '@engine/wasm-collision';

type RequestCheckTrs = {
  id: number;
  type: 'checkTrs';
  preview: Trs;
  others: TrsArray;
};

type ResponseIndices = {
  id: number;
  ok: true;
  indices: Uint32Array;
} | {
  id: number;
  ok: false;
  error: string;
};

let ready = false;
let api: Awaited<ReturnType<typeof init>> | null = null;

async function ensureInit() {
  if (ready) return;
  api = await init();
  ready = true;
}

self.onmessage = async (ev: MessageEvent<RequestCheckTrs>) => {
  const data = ev.data;
  if (!data || data.type !== 'checkTrs') return;
  const id = data.id;
  try {
    await ensureInit();
    const indices = api!.batchCheckTrs(data.preview, data.others);
    const msg: ResponseIndices = { id, ok: true, indices };
    // structured clone: Uint32Array is transferable
    (self as any).postMessage(msg, [indices.buffer]);
  } catch (e: unknown) {
    const msg: ResponseIndices = { id, ok: false, error: (e as Error)?.message ?? 'unknown' };
    (self as any).postMessage(msg);
  }
};


