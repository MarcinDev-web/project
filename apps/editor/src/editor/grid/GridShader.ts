/**
 * WGSL shader code for grid rendering.
 * Renders simple lines for the 3D grid visualization.
 */

export enum GridShaderEntryPoint {
  VERTEX = 'vs_grid',
  FRAGMENT = 'fs_grid',
}

/**
 * Creates shader code for grid line rendering.
 * Uses a simple line-list topology with per-vertex colors.
 */
export function createGridShaderCode(): string {
  return `
struct GridUniforms {
  viewProjectionMatrix : mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> gridUniforms : GridUniforms;

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) color : vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec4<f32>,
};

@vertex
fn vs_grid(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  output.position = gridUniforms.viewProjectionMatrix * vec4<f32>(input.position, 1.0);
  output.color = input.color;
  return output;
}

@fragment
fn fs_grid(input : VertexOutput) -> @location(0) vec4<f32> {
  return input.color;
}
`;
}
