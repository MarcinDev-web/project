import init, * as wasm from '@engine/compute-wasm';

export async function demoAdd(): Promise<number> {
  await init();
  return wasm.add(2, 3);
}


