/**
 * Line shader for logic cube connections
 * Renders animated beams between connected cubes
 */
export function createLineShaderCode() {
    return `
struct Uniforms {
  viewProjectionMatrix: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  time: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) color: vec3<f32>,
  @location(2) thickness: f32,
  @location(3) animationOffset: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) animationPhase: f32,
  @location(2) distanceAlongLine: f32,
};

@vertex
fn vs_main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  
  // Transform to clip space
  output.position = uniforms.viewProjectionMatrix * vec4<f32>(input.position, 1.0);
  
  // Pass through color
  output.color = input.color;
  
  // Calculate animation phase (flowing effect)
  output.animationPhase = input.animationOffset + uniforms.time;
  
  // Distance along line for animation
  output.distanceAlongLine = f32(vertexIndex) * 0.1;
  
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Animated flowing effect
  let flowSpeed = 2.0;
  let flowPhase = fract(input.animationPhase * flowSpeed + input.distanceAlongLine);
  
  // Pulsing brightness
  let pulse = sin(input.animationPhase * 3.0) * 0.2 + 0.8;
  
  // Create flowing highlights
  let highlight = smoothstep(0.3, 0.5, flowPhase) * smoothstep(0.7, 0.5, flowPhase);
  
  // Combine color with animation
  let finalColor = input.color * pulse + vec3<f32>(highlight * 0.5);
  
  // Add glow
  let glowStrength = 0.3;
  let glow = vec3<f32>(glowStrength) * pulse;
  
  return vec4<f32>(finalColor + glow, 0.85);
}
`;
}
//# sourceMappingURL=lineShader.js.map