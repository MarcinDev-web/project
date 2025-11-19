/**
 * Common utilities for post-processing passes.
 */

/**
 * Standard full-screen triangle vertex shader.
 * Generates a full-screen triangle from vertex indices 0, 1, 2.
 * No vertex buffer required.
 * 
 * Output:
 * - @builtin(position) pos: vec4<f32>
 * - @location(0) uv: vec2<f32>
 */
export const FULLSCREEN_VERTEX_SHADER = `
struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_fullscreen(@builtin(vertex_index) vid: u32) -> VSOut {
  var o: VSOut;
  let x = f32((vid << 1u) & 2u);
  let y = f32(vid & 2u);
  o.pos = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
  o.uv = vec2<f32>(x, y);
  return o;
}
`;

/**
 * Creates a standard post-process render pipeline.
 * 
 * @param device - GPU device
 * @param label - Pipeline label
 * @param bindGroupLayouts - Bind group layouts
 * @param fragmentShader - Fragment shader module
 * @param fragmentEntryPoint - Fragment shader entry point (default: 'fs_main')
 * @param targets - Color target states (default: [{ format: 'rgba16float' }])
 * @param vertexShaderCode - Optional custom vertex shader code (default: FULLSCREEN_VERTEX_SHADER)
 * @param vertexEntryPoint - Optional custom vertex entry point (default: 'vs_fullscreen')
 */
export function createPostProcessPipeline(
  device: GPUDevice,
  label: string,
  bindGroupLayouts: GPUBindGroupLayout[],
  fragmentShader: GPUShaderModule,
  fragmentEntryPoint: string = 'fs_main',
  targets: GPUColorTargetState[] = [{ format: 'rgba16float' }],
  vertexShaderCode: string = FULLSCREEN_VERTEX_SHADER,
  vertexEntryPoint: string = 'vs_fullscreen'
): GPURenderPipeline {
  const pipelineLayout = device.createPipelineLayout({
    label: `${label}-layout`,
    bindGroupLayouts,
  });

  const vertexModule = device.createShaderModule({
    label: `${label}-vs`,
    code: vertexShaderCode,
  });

  return device.createRenderPipeline({
    label,
    layout: pipelineLayout,
    vertex: {
      module: vertexModule,
      entryPoint: vertexEntryPoint,
    },
    fragment: {
      module: fragmentShader,
      entryPoint: fragmentEntryPoint,
      targets,
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}

