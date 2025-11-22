// Particle Rendering Shader

// NOTE: Prepend particle_structs.wgsl here

struct Uniforms {
    viewProjectionMatrix: mat4x4<f32>,
    right: vec3<f32>, // Camera Right vector for billboarding
    up: vec3<f32>,    // Camera Up vector for billboarding
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> particles : array<Particle>;
@group(0) @binding(2) var particleTexture : texture_2d<f32>;
@group(0) @binding(3) var particleSampler : sampler;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) color : vec4<f32>,
};

@vertex
fn vs_main(
    @builtin(vertex_index) vertexIndex : u32,
    @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
    let particle = particles[instanceIndex];
    
    // Skip dead particles
    if (particle.life <= 0.0) {
        return VertexOutput(vec4<f32>(0.0), vec2<f32>(0.0), vec4<f32>(0.0));
    }

    // Standard Quad UVs
    var uv = vec2<f32>(0.0, 0.0);
    var corner = vec2<f32>(0.0, 0.0);
    
    // 0: -0.5, -0.5 (Bottom Left)
    // 1:  0.5, -0.5 (Bottom Right)
    // 2: -0.5,  0.5 (Top Left)
    // 3:  0.5,  0.5 (Top Right)
    // Triangle Strip order: 0, 1, 2, 3 (requires different indexing or index buffer)
    // Here using vertex_index % 6 for Triangle List if using draw(6, ...)
    // Or hardcoded array if draw(4, ...) with strip.
    
    let corners = array<vec2<f32>, 6>(
        vec2<f32>(-0.5, -0.5),
        vec2<f32>( 0.5, -0.5),
        vec2<f32>(-0.5,  0.5),
        vec2<f32>(-0.5,  0.5),
        vec2<f32>( 0.5, -0.5),
        vec2<f32>( 0.5,  0.5)
    );
    
    let uvs = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(1.0, 0.0)
    );
    
    corner = corners[vertexIndex];
    uv = uvs[vertexIndex];
    
    // Billboarding
    // Rotate corner by particle rotation
    let c = cos(particle.rotation);
    let s = sin(particle.rotation);
    let rotatedCorner = vec2<f32>(
        corner.x * c - corner.y * s,
        corner.x * s + corner.y * c
    ) * particle.size;
    
    let worldPos = particle.position 
        + uniforms.right * rotatedCorner.x 
        + uniforms.up * rotatedCorner.y;
        
    var output : VertexOutput;
    output.position = uniforms.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
    output.uv = uv;
    output.color = particle.color;
    
    return output;
}

@fragment
fn fs_main(@location(0) uv : vec2<f32>, @location(1) color : vec4<f32>) -> @location(0) vec4<f32> {
    let texColor = textureSample(particleTexture, particleSampler, uv);
    return texColor * color;
}

