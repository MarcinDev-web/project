// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { initSync, add } from '../pkg/compute_wasm.js';

it('adds two numbers via WASM', () => {
  const wasmPath = path.resolve(process.cwd(), 'packages/compute-wasm/pkg/compute_wasm_bg.wasm');
  const bytes = readFileSync(wasmPath);
  initSync(bytes);
  expect(add(2, 3)).toBe(5);
});


