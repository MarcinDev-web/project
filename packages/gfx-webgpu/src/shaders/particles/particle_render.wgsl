// Particle Rendering Shader - SoA Layout
// Optimized for memory coalescing: adjacent particle instances read contiguous memory

// ============================================================================
// Uniforms
// ============================================================================

struct Uniforms {
    viewProjectionMatrix: mat4x4<f32>,
    right: vec3<f32>,         // Camera right vector for billboarding
    _pad0: f32,
    up: vec3<f32>,            // Camera up vector for billboarding
    _pad1: f32,
    cameraPos: vec3<f32>,     // For soft particles / distance fade
    _pad2: f32,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

// ============================================================================
// SoA Particle Data Bindings (read-only for rendering)
// Adjacent instances read adjacent memory locations - optimal coalescing
// ============================================================================

@group(0) @binding(1) var<storage, read> positions : array<vec4<f32>>;      // xyz=position, w=unused
@group(0) @binding(2) var<storage, read> velocities : array<vec4<f32>>;     // xyz=velocity, w=life
@group(0) @binding(3) var<storage, read> colors : array<vec4<f32>>;         // rgba color
@group(0) @binding(4) var<storage, read> sizeRotation : array<vec4<f32>>;   // x=size, y=rotation, z=angularVel, w=flags

// Texture bindings
@group(1) @binding(0) var particleTexture : texture_2d<f32>;
@group(1) @binding(1) var particleSampler : sampler;

// Optional: sorted indices for back-to-front rendering
@group(2) @binding(0) var<storage, read> sortedIndices : array<u32>;
@group(2) @binding(1) var<uniform> useSort : u32;

// ============================================================================
// Vertex Output
// ============================================================================

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) color : vec4<f32>,
    @location(2) worldPos : vec3<f32>,
};

// ============================================================================
// Quad vertex data (6 vertices for 2 triangles)
// ============================================================================

const QUAD_CORNERS = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),  // Bottom-left
    vec2<f32>( 0.5, -0.5),  // Bottom-right
    vec2<f32>(-0.5,  0.5),  // Top-left
    vec2<f32>(-0.5,  0.5),  // Top-left
    vec2<f32>( 0.5, -0.5),  // Bottom-right
    vec2<f32>( 0.5,  0.5)   // Top-right
);

const QUAD_UVS = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
);

// ============================================================================
// Vertex Shader - Billboarded particle quads
// ============================================================================

@vertex
fn vs_main(
    @builtin(vertex_index) vertexIndex : u32,
    @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
    // Optionally use sorted indices for correct alpha blending
    var particleIdx = instanceIndex;
    if (useSort > 0u) {
        particleIdx = sortedIndices[instanceIndex];
    }

    // ========================================
    // SoA reads - each read hits contiguous memory across instances
    // ========================================
    
    // Read life first (packed in velocities.w) for early-out
    let velocityData = velocities[particleIdx];
    let life = velocityData.w;

    // Dead particle - output degenerate triangle
    if (life <= 0.0) {
        var output : VertexOutput;
        output.position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        output.uv = vec2<f32>(0.0);
        output.color = vec4<f32>(0.0);
        output.worldPos = vec3<f32>(0.0);
        return output;
    }

    // Read remaining particle data from SoA arrays
    let pos = positions[particleIdx].xyz;
    let color = colors[particleIdx];
    let sizeRotData = sizeRotation[particleIdx];
    
    let size = sizeRotData.x;
    let rotation = sizeRotData.y;
    let flags = u32(sizeRotData.w);

    // ========================================
    // Billboard quad construction
    // ========================================
    
    let corner = QUAD_CORNERS[vertexIndex];
    let uv = QUAD_UVS[vertexIndex];

    // Apply rotation to corner
    let cosR = cos(rotation);
    let sinR = sin(rotation);
    let rotatedCorner = vec2<f32>(
        corner.x * cosR - corner.y * sinR,
        corner.x * sinR + corner.y * cosR
    ) * size;

    // Billboard: offset in camera-aligned plane
    let worldPos = pos 
        + uniforms.right * rotatedCorner.x 
        + uniforms.up * rotatedCorner.y;

    // ========================================
    // Output
    // ========================================
    
    var output : VertexOutput;
    output.position = uniforms.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
    output.uv = uv;
    output.color = color;
    output.worldPos = worldPos;

    return output;
}

// ============================================================================
// Fragment Shader
// ============================================================================

@fragment
fn fs_main(
    @location(0) uv : vec2<f32>, 
    @location(1) color : vec4<f32>,
    @location(2) worldPos : vec3<f32>
) -> @location(0) vec4<f32> {
    let texColor = textureSample(particleTexture, particleSampler, uv);
    
    // Premultiplied alpha output
    var finalColor = texColor * color;
    
    // Optional: distance-based fade for soft particles
    // let dist = length(worldPos - uniforms.cameraPos);
    // finalColor.a *= smoothstep(0.1, 1.0, dist);
    
    return finalColor;
}

// ============================================================================
// Alternative: Velocity-stretched particles vertex shader
// For effects like rain, sparks, etc.
// ============================================================================

@vertex
fn vs_stretched(
    @builtin(vertex_index) vertexIndex : u32,
    @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
    var particleIdx = instanceIndex;
    if (useSort > 0u) {
        particleIdx = sortedIndices[instanceIndex];
    }

    let velocityData = velocities[particleIdx];
    let life = velocityData.w;

    if (life <= 0.0) {
        var output : VertexOutput;
        output.position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        output.uv = vec2<f32>(0.0);
        output.color = vec4<f32>(0.0);
        output.worldPos = vec3<f32>(0.0);
        return output;
    }

    let pos = positions[particleIdx].xyz;
    let vel = velocityData.xyz;
    let color = colors[particleIdx];
    let sizeRotData = sizeRotation[particleIdx];
    let size = sizeRotData.x;

    // ========================================
    // Velocity-aligned stretched quad
    // ========================================
    
    let corner = QUAD_CORNERS[vertexIndex];
    let uv = QUAD_UVS[vertexIndex];

    // Stretch along velocity direction
    let velLen = length(vel);
    var stretchDir = vec3<f32>(0.0, 1.0, 0.0);
    if (velLen > 0.001) {
        stretchDir = vel / velLen;
    }

    // Calculate perpendicular direction in view space
    let viewDir = normalize(uniforms.cameraPos - pos);
    let perpDir = normalize(cross(stretchDir, viewDir));

    // Scale stretch based on velocity magnitude
    let stretchScale = min(velLen * 0.1, 2.0);
    
    // Offset: x along perpendicular, y along velocity direction
    let worldPos = pos 
        + perpDir * corner.x * size
        + stretchDir * corner.y * size * (1.0 + stretchScale);

    var output : VertexOutput;
    output.position = uniforms.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
    output.uv = uv;
    output.color = color;
    output.worldPos = worldPos;

    return output;
}

// ============================================================================
// Additive blending fragment shader variant
// ============================================================================

@fragment
fn fs_additive(
    @location(0) uv : vec2<f32>, 
    @location(1) color : vec4<f32>,
    @location(2) worldPos : vec3<f32>
) -> @location(0) vec4<f32> {
    let texColor = textureSample(particleTexture, particleSampler, uv);
    
    // Additive blending: RGB is additive, alpha modulates intensity
    let intensity = texColor.a * color.a;
    return vec4<f32>(texColor.rgb * color.rgb * intensity, 0.0);
}

