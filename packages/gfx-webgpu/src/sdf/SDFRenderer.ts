import type { Mat4, Vec3 } from '@engine/core/math';

/**
 * WGSL Shader for SDF Raymarching
 * Implements sphere tracing, soft blending (clay), and basic lighting.
 */
const SDF_SHADER_CODE = /* wgsl */ `
// --- Structs ---

struct Uniforms {
    viewProjectionInverse: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    time: f32,
    smoothness: f32, // Controls the "clay" blending factor
    _pad0: f32,
    _pad1: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// --- SDF Primitives ---

fn sdSphere(p: vec3<f32>, s: f32) -> f32 {
    return length(p) - s;
}

fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdTorus(p: vec3<f32>, t: vec2<f32>) -> f32 {
    let q = vec2<f32>(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

fn sdPlane(p: vec3<f32>, n: vec3<f32>, h: f32) -> f32 {
    return dot(p, n) + h;
}

// --- SDF Operators ---

// Smooth Union (The "Clay" Magic)
// k = smoothness factor
fn opSmoothUnion(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

fn opSmoothSubtraction(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
}

// Rotation matrix helper
fn rotateY(p: vec3<f32>, angle: f32) -> vec3<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return vec3<f32>(
        c * p.x - s * p.z,
        p.y,
        s * p.x + c * p.z
    );
}

// --- Scene Definition ---

fn map(p: vec3<f32>) -> f32 {
    let t = uniforms.time;
    let k = max(0.01, uniforms.smoothness); // Smoothness factor

    // 1. Floor
    let floorDist = sdPlane(p, vec3<f32>(0.0, 1.0, 0.0), 2.0);

    // 2. Central Morphing Object
    // Rotate the space
    let pRot = rotateY(p, t * 0.5);
    
    // Combine Sphere and Box with smooth union
    let sphere = sdSphere(pRot, 1.5);
    let box = sdBox(pRot + vec3<f32>(sin(t)*0.5, cos(t)*0.5, 0.0), vec3<f32>(1.2, 1.2, 1.2));
    var d = opSmoothUnion(sphere, box, k);

    // 3. Orbiting "Clay" Blobs
    let blob1Pos = vec3<f32>(cos(t * 1.5) * 2.5, sin(t * 1.2) * 1.5, sin(t * 1.5) * 2.5);
    let blob1 = sdSphere(p - blob1Pos, 0.8);
    d = opSmoothUnion(d, blob1, k);

    let blob2Pos = vec3<f32>(sin(t * 0.8) * 3.0, cos(t * 0.9) * 2.0, cos(t * 1.1) * 3.0);
    let blob2 = sdSphere(p - blob2Pos, 0.6);
    d = opSmoothUnion(d, blob2, k * 1.5); // Extra gooey

    // 4. Negative Shape (Tunneling effect)
    // Create a hole passing through
    // let cylinder = length(pRot.xy) - 0.5;
    // d = opSmoothSubtraction(cylinder, d, 0.1);

    return min(d, floorDist);
}

// --- Normal Calculation ---
// Gradient of the SDF gives the normal vector
fn calcNormal(p: vec3<f32>) -> vec3<f32> {
    let e = 0.001;
    let dx = map(p + vec3<f32>(e, 0.0, 0.0)) - map(p - vec3<f32>(e, 0.0, 0.0));
    let dy = map(p + vec3<f32>(0.0, e, 0.0)) - map(p - vec3<f32>(0.0, e, 0.0));
    let dz = map(p + vec3<f32>(0.0, 0.0, e)) - map(p - vec3<f32>(0.0, 0.0, e));
    return normalize(vec3<f32>(dx, dy, dz));
}

// --- Vertex Shader ---
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    // Full screen triangle
    let x = f32((vertexIndex << 1u) & 2u);
    let y = f32(vertexIndex & 2u);
    let uv = vec2<f32>(x, y);
    
    output.position = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
    output.uv = vec2<f32>(x, 1.0 - y); // Flip Y for consistency
    return output;
}

// --- Fragment Shader ---
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // 1. Ray setup
    // Screen coords (-1 to 1)
    let uv = input.position.xy; // This might be in window coords... let's use passed UV
    let ndc = vec2<f32>(input.uv.x * 2.0 - 1.0, (1.0 - input.uv.y) * 2.0 - 1.0);

    // Unproject to get ray direction
    // We assume the "position" output from VS is at z=0 (near plane)
    // but we need direction. A robust way is to unproject two points (near/far) or use inverse view-proj.
    
    let clipPos = vec4<f32>(ndc, 1.0, 1.0); // Point on far plane
    let worldPos4 = uniforms.viewProjectionInverse * clipPos;
    let worldTarget = worldPos4.xyz / worldPos4.w;
    let rayDir = normalize(worldTarget - uniforms.cameraPosition);
    
    var rayPos = uniforms.cameraPosition;
    
    // 2. Raymarching Loop (Sphere Tracing)
    var totalDist = 0.0;
    let MAX_DIST = 100.0;
    let MAX_STEPS = 128;
    let EPSILON = 0.001;
    
    var hit = false;
    var i = 0;
    
    for (i = 0; i < MAX_STEPS; i++) {
        let d = map(rayPos);
        if (d < EPSILON) {
            hit = true;
            break;
        }
        if (totalDist > MAX_DIST) {
            break;
        }
        rayPos += rayDir * d;
        totalDist += d;
    }
    
    // 3. Shading
    var color = vec3<f32>(0.05, 0.08, 0.12); // Background / Sky
    
    if (hit) {
        let normal = calcNormal(rayPos);
        let lightDir = normalize(vec3<f32>(0.5, 1.0, -0.5));
        
        // Diffuse (Lambert)
        let diff = max(dot(normal, lightDir), 0.0);
        
        // Specular (Phong)
        let viewDir = normalize(uniforms.cameraPosition - rayPos);
        let reflectDir = reflect(-lightDir, normal);
        let spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        
        // Ambient
        let ambient = 0.1;
        
        // Material Color (Clay-like pink/orange)
        // We can vary color based on position to show blending
        var matColor = vec3<f32>(0.8, 0.4, 0.3); // Terracotta
        
        // Visualize iterations for debug (heat map)
        // matColor = mix(matColor, vec3<f32>(1.0, 0.0, 0.0), f32(i) / f32(MAX_STEPS));

        color = matColor * (diff + ambient) + vec3<f32>(1.0) * spec * 0.5;
        
        // Fog
        let fogFactor = 1.0 - exp(-totalDist * 0.02);
        color = mix(color, vec3<f32>(0.05, 0.08, 0.12), fogFactor);
    }
    
    return vec4<f32>(color, 1.0);
}
`;

/**
 * SDF Renderer Prototype
 * Renders a procedural Signed Distance Field scene to the screen.
 */
export class SDFRenderer {
  private device: GPUDevice;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private initialized = false;
  
  // Parameters
  private smoothness = 0.5;
  private time = 0;

  constructor() {
    this.device = null!;
  }

  /**
   * Initialize the renderer with the GPU device and output format.
   */
  async initialize(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device;

    // 1. Create Uniform Buffer
    // Size: mat4 (64) + vec3 (12) + f32 (4) + f32 (4) + padding (8) = 92 -> aligned to 16 bytes -> 96 bytes
    // Actually:
    // mat4: 64 bytes
    // vec3 cameraPos: 12 bytes
    // f32 time: 4 bytes
    // f32 smoothness: 4 bytes
    // padding: 12 bytes to reach 16-byte alignment for next block if needed, or just ensure buffer is multiple of 16
    // Total: 64 + 16 (vec3 + align) + 16 (params + align) = ~96 bytes safe bet.
    const uniformBufferSize = 128; // Safe size
    this.uniformBuffer = device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'SDF Uniforms',
    });

    // 2. Create Shader Module
    const shaderModule = device.createShaderModule({
      code: SDF_SHADER_CODE,
      label: 'SDF Shader',
    });

    // 3. Create Pipeline
    this.pipeline = await device.createRenderPipelineAsync({
      label: 'SDF Raymarching Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: format,
          blend: {
            // Standard alpha blending (if we want to overlay, though this is opaque mostly)
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          }
        }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    // 4. Create Bind Group
    // Note: We use getBindGroupLayout(0) from the auto-generated layout
    this.bindGroup = device.createBindGroup({
      label: 'SDF Bind Group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
      ],
    });

    this.initialized = true;
    console.log('SDF Renderer Initialized');
  }

  /**
   * Update rendering parameters.
   */
  updateParams(params: { smoothness?: number; time?: number }) {
    if (params.smoothness !== undefined) this.smoothness = params.smoothness;
    if (params.time !== undefined) this.time = params.time;
  }

  /**
   * Render the SDF scene.
   * @param passEncoder The current render pass encoder.
   * @param viewProjectionInverse The inverse of (Projection * View) matrix, to unproject rays.
   * @param cameraPosition The world position of the camera.
   */
  render(
    passEncoder: GPURenderPassEncoder,
    viewProjectionInverse: Mat4 | Float32Array,
    cameraPosition: Vec3 | Float32Array | number[]
  ) {
    if (!this.initialized) return;

    // Update Uniforms
    // Layout:
    // mat4 viewProjectionInverse (0-64)
    // vec3 cameraPosition (64-76)
    // f32 time (76-80)
    // f32 smoothness (80-84)
    // padding (84-96)

    const uniformData = new Float32Array(32); // 128 bytes
    
    // 1. ViewProj Inverse
    for (let i = 0; i < 16; i++) {
      uniformData[i] = viewProjectionInverse[i] ?? 0;
    }

    // 2. Camera Pos
    uniformData[16] = cameraPosition[0];
    uniformData[17] = cameraPosition[1];
    uniformData[18] = cameraPosition[2];
    
    // 3. Time
    uniformData[19] = this.time;
    
    // 4. Smoothness
    uniformData[20] = this.smoothness;

    this.device.queue.writeBuffer(
        this.uniformBuffer,
        0,
        uniformData.buffer,
        uniformData.byteOffset,
        uniformData.byteLength
    );

    // Draw
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.draw(3, 1, 0, 0); // Draw 3 vertices (full screen triangle)
  }
  
  /**
   * Cleanup resources.
   */
  dispose() {
    if (this.uniformBuffer) this.uniformBuffer.destroy();
    this.initialized = false;
  }
}

