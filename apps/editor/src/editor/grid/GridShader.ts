/**
 * WGSL shader code for infinite grid rendering.
 * Uses analytical anti-aliasing and distance fading.
 */

export enum GridShaderEntryPoint {
  VERTEX = 'vs_grid',
  FRAGMENT = 'fs_grid',
}

/**
 * Creates shader code for grid rendering.
 */
export function createGridShaderCode(): string {
  return `
struct GridUniforms {
  viewProjectionMatrix : mat4x4<f32>,
  eyePosition : vec3<f32>,
  cellSize : f32,
  fadeDistance : f32,
  majorLineInterval : f32,
  minorLineWidth : f32,
  majorLineWidth : f32,
  
  minorColor : vec4<f32>,
  majorColor : vec4<f32>,
  axisColorX : vec4<f32>,
  axisColorZ : vec4<f32>,
  originColor : vec4<f32>,
};

@group(0) @binding(0) var<uniform> u : GridUniforms;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) worldPos : vec3<f32>,
};

@vertex
fn vs_grid(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
  // Generate a large quad centered at eyePosition snapped to grid
  // 2 triangles:
  // 0: -1, -1
  // 1:  1, -1
  // 2: -1,  1
  // 3: -1,  1
  // 4:  1, -1
  // 5:  1,  1
  
  var pos = vec2<f32>(0.0);
  if (vertexIndex == 0u) { pos = vec2<f32>(-1.0, -1.0); }
  else if (vertexIndex == 1u) { pos = vec2<f32>(1.0, -1.0); }
  else if (vertexIndex == 2u) { pos = vec2<f32>(-1.0, 1.0); }
  else if (vertexIndex == 3u) { pos = vec2<f32>(-1.0, 1.0); }
  else if (vertexIndex == 4u) { pos = vec2<f32>(1.0, -1.0); }
  else if (vertexIndex == 5u) { pos = vec2<f32>(1.0, 1.0); }

  // Make the quad large enough to cover the fade distance
  let scale = u.fadeDistance * 2.0;
  
  // Snap center to cell size to avoid jittering as camera moves
  let snap = u.cellSize;
  let center = floor(u.eyePosition.xz / snap) * snap;
  
  let worldPos = vec3<f32>(
    center.x + pos.x * scale,
    0.0,
    center.y + pos.y * scale
  );

  var output : VertexOutput;
  output.position = u.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
  output.worldPos = worldPos;
  return output;
}

// Anti-aliased grid line calculation
fn getGridLine(coord: f32, spacing: f32, lineWidth: f32, deriv: f32) -> f32 {
  let off = coord / spacing;
  let localDeriv = deriv / spacing;
  let line = abs(fract(off - 0.5) - 0.5);
  return 1.0 - min(line / (localDeriv * lineWidth), 1.0);
}

@fragment
fn fs_grid(input : VertexOutput) -> @location(0) vec4<f32> {
  let worldPos = input.worldPos;
  let dist = distance(worldPos.xz, u.eyePosition.xz);
  
  // Fade out
  // Start fading at 80% of fadeDistance
  let alpha = 1.0 - smoothstep(u.fadeDistance * 0.5, u.fadeDistance, dist);
  
  if (alpha <= 0.0) {
    discard;
  }
  
  // Derivatives for AA
  // fwidth gives approximate change of value per pixel
  let derivativeX = fwidth(worldPos.x);
  let derivativeZ = fwidth(worldPos.z);
  // Use max derivative to handle anisotropy simply
  let derivative = max(derivativeX, derivativeZ);
  
  // Minor grid lines
  let minorLineX = getGridLine(worldPos.x, u.cellSize, u.minorLineWidth, derivativeX);
  let minorLineZ = getGridLine(worldPos.z, u.cellSize, u.minorLineWidth, derivativeZ);
  let minorGrid = max(minorLineX, minorLineZ);
  
  // Major grid lines
  let majorLineX = getGridLine(worldPos.x, u.cellSize * u.majorLineInterval, u.majorLineWidth, derivativeX);
  let majorLineZ = getGridLine(worldPos.z, u.cellSize * u.majorLineInterval, u.majorLineWidth, derivativeZ);
  let majorGrid = max(majorLineX, majorLineZ);
  
  // Axis lines (X axis is where Z is 0, Z axis is where X is 0)
  // We want slightly thicker axes
  let axisWidth = u.majorLineWidth * 2.0;
  let xAxis = 1.0 - min(abs(worldPos.z) / (derivativeZ * axisWidth), 1.0); // X axis (Z=0)
  let zAxis = 1.0 - min(abs(worldPos.x) / (derivativeX * axisWidth), 1.0); // Z axis (X=0)
  
  var color = vec4<f32>(0.0);
  
  // Composite colors (painters algorithm order: minor -> major -> axes)
  
  if (minorGrid > 0.0) {
    color = mix(color, u.minorColor, minorGrid);
  }
  
  if (majorGrid > 0.0) {
    // Blend major over minor
    color = mix(color, u.majorColor, majorGrid);
  }
  
  if (xAxis > 0.0) {
    color = mix(color, u.axisColorX, xAxis);
  }
  
  if (zAxis > 0.0) {
    color = mix(color, u.axisColorZ, zAxis);
  }
  
  // Apply distance fade
  color.a *= alpha;
  
  return color;
}
`;
}
