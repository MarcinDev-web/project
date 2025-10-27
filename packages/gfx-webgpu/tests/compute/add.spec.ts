import { test } from '@playwright/test';
import { ensureWebGPU, runCompute } from '../helpers/webgpu';
import { expectArrayClose } from '../helpers/expect';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('adds two arrays on GPU', async ({ page }) => {
  await ensureWebGPU(page);
  const wgslSource = readFileSync(resolve(process.cwd(), 'packages/gfx-webgpu/src/shaders/compute/add.wgsl'), 'utf-8');

  const length = 1024;
  const a = Float32Array.from({ length }, (_, i) => i);
  const b = Float32Array.from({ length }, (_, i) => length - i);
  const expected = Float32Array.from({ length }, (_, i) => a[i] + b[i]);

  const out = await runCompute(page, {
    wgslSource,
    length,
    bindings: [
      { binding: 0, role: 'read', data: a },
      { binding: 1, role: 'read', data: b },
      { binding: 2, role: 'read_write' },
    ],
    workgroupSize: 64,
  });

  expectArrayClose(out, expected, { abs: 1e-6, rel: 1e-6 });
});


