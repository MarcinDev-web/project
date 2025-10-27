/**
 * Augments a render pipeline descriptor with skinning bind group layout entries.
 * Usage is package-specific; this helper returns a small struct to integrate in the app's pipeline setup.
 */
export function createSkinningBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'skinning-bgl',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });
}

export function createSkinningBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniforms: GPUBuffer,
  jointBuffer: GPUBuffer
): GPUBindGroup {
  return device.createBindGroup({
    label: 'skinning-bg',
    layout,
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: { buffer: jointBuffer } },
    ],
  });
}


