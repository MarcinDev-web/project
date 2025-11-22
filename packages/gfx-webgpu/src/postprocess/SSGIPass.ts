import { Logger } from '@engine/core/utils';
import { FULLSCREEN_VERTEX_SHADER } from './PostProcessUtils';
import { 
    initWasm, 
    BlueNoiseGenerator, 
    SSGIConfig as WasmSSGIConfig, 
    get_ssgi_uniforms 
} from '@engine/wasm-render-logic';

// Shader code embedded to avoid import issues
const SSGI_SHADER = `
struct SSGIUniforms {
    step_count: f32,
    radius: f32,
    thickness: f32,
    max_roughness: f32,
}

@group(0) @binding(0) var normal_texture: texture_2d<f32>;
@group(0) @binding(1) var depth_texture: texture_depth_2d;
@group(0) @binding(2) var noise_texture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> camera: CameraUniforms;
@group(0) @binding(4) var<uniform> ssgi_config: SSGIUniforms;
@group(0) @binding(5) var color_texture: texture_2d<f32>;

struct CameraUniforms {
    view_matrix: mat4x4<f32>,
    projection_matrix: mat4x4<f32>,
    inv_projection_matrix: mat4x4<f32>,
    inv_view_matrix: mat4x4<f32>,
    position: vec3<f32>,
    screen_size: vec2<f32>,
}

fn get_view_position(uv: vec2<f32>, depth: f32) -> vec3<f32> {
    let clip_xy = uv * 2.0 - 1.0;
    let clip_pos = vec4<f32>(clip_xy.x, -clip_xy.y, depth, 1.0);
    let view_pos = camera.inv_projection_matrix * clip_pos;
    return view_pos.xyz / view_pos.w;
}

fn get_uv_from_view_position(view_pos: vec3<f32>) -> vec2<f32> {
    let clip_pos = camera.projection_matrix * vec4<f32>(view_pos, 1.0);
    let ndc = clip_pos.xyz / clip_pos.w;
    return vec2<f32>(ndc.x * 0.5 + 0.5, -ndc.y * 0.5 + 0.5);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4<f32> {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );
    return vec4<f32>(positions[vertex_index], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = frag_coord.xy / camera.screen_size;
    let depth = textureLoad(depth_texture, vec2<i32>(frag_coord.xy), 0);
    
    if (depth >= 1.0) {
        return vec4<f32>(0.0);
    }

    let view_pos = get_view_position(uv, depth);
    
    // Normal in view space
    let normal_rgb = textureLoad(normal_texture, vec2<i32>(frag_coord.xy), 0).rgb;
    let normal_world = normal_rgb * 2.0 - 1.0;
    let normal_view = normalize((camera.view_matrix * vec4<f32>(normal_world, 0.0)).xyz);
    
    let noise_uv = vec2<i32>(frag_coord.xy) % vec2<i32>(textureDimensions(noise_texture));
    let noise = textureLoad(noise_texture, noise_uv, 0).xy;
    
    var indirect_light = vec3<f32>(0.0);
    let steps = i32(ssgi_config.step_count);
    
    // Hybrid raymarching in View Space
    var accum_color = vec3<f32>(0.0);
    var valid_samples = 0.0;
    
    for (var i = 0; i < steps; i++) {
        let t = (f32(i) + noise.x) / f32(steps);
        let sample_dist = t * ssgi_config.radius;
        
        // Random direction in view space (very simplified)
        // In production, use better sampling (e.g. cosine weighted hemisphere)
        let rand_dir = vec3<f32>(noise.x * 2.0 - 1.0, noise.y * 2.0 - 1.0, 1.0); 
        let ray_dir = normalize(normal_view + rand_dir * 0.5);
        
        let sample_pos_view = view_pos + ray_dir * sample_dist;
        let sample_uv = get_uv_from_view_position(sample_pos_view);
        
        if (sample_uv.x >= 0.0 && sample_uv.x <= 1.0 && sample_uv.y >= 0.0 && sample_uv.y <= 1.0) {
             let sample_depth_val = textureLoad(depth_texture, vec2<i32>(sample_uv * camera.screen_size), 0);
             let sample_pos_rec = get_view_position(sample_uv, sample_depth_val);
             
             // Check for occlusion
             let diff = sample_pos_view.z - sample_pos_rec.z;
             
             if (diff > 0.001 && diff < ssgi_config.thickness) {
                 // Hit surface - sample color
                 let sample_color = textureLoad(color_texture, vec2<i32>(sample_uv * camera.screen_size), 0).rgb;
                 accum_color += sample_color;
                 valid_samples += 1.0;
             }
        }
    }
    
    if (valid_samples > 0.0) {
        indirect_light = accum_color / valid_samples;
    }
    
    return vec4<f32>(indirect_light, 1.0);
}
`;

export interface SSGIConfig {
    stepCount?: number;
    radius?: number;
    thickness?: number;
    maxRoughness?: number;
}

export class SSGIPass {
    private device: GPUDevice;
    private pipeline: GPURenderPipeline | null = null;
    private bindGroupLayout: GPUBindGroupLayout | null = null;
    private noiseTexture: GPUTexture | null = null;
    private configBuffer: GPUBuffer | null = null;
    private cameraUniformBuffer: GPUBuffer | null = null; // We need to create or receive this
    
    private cachedBindGroup: GPUBindGroup | null = null;
    private cachedDepthView: GPUTextureView | null = null;
    private cachedNormalView: GPUTextureView | null = null;
    private cachedColorView: GPUTextureView | null = null; // Input color (previous frame/current scene)
    private cachedOutputView: GPUTextureView | null = null;

    private config: Required<SSGIConfig> = {
        stepCount: 16,
        radius: 2.0,
        thickness: 0.5,
        maxRoughness: 1.0
    };

    private wasmReady = false;

    constructor(device: GPUDevice) {
        this.device = device;
        this.initWasmAsync();
    }

    private async initWasmAsync() {
        try {
            await initWasm();
            this.wasmReady = true;
            this.initializeResources();
        } catch (e) {
            Logger.error("Failed to init WASM for SSGI", e as Error);
        }
    }

    setConfig(config: SSGIConfig) {
        this.config = { ...this.config, ...config };
        this.updateConfigBuffer();
    }

    private initializeResources() {
        if (!this.wasmReady) return;

        // 1. Generate Noise Texture using Rust WASM
        const noiseSize = 64;
        const blueNoise = new BlueNoiseGenerator(BigInt(Date.now()));
        const noiseData = blueNoise.generate_noise_texture(noiseSize, noiseSize);
        // noiseData is Vec<u8> (Uint8Array)
        
        this.noiseTexture = this.device.createTexture({
            size: [noiseSize, noiseSize, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        this.device.queue.writeTexture(
            { texture: this.noiseTexture },
            noiseData as unknown as BufferSource,
            { bytesPerRow: noiseSize * 4 },
            { width: noiseSize, height: noiseSize }
        );

        // 2. Create Config Buffer
        this.configBuffer = this.device.createBuffer({
            size: 16, // 4 floats
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.updateConfigBuffer();

        // 3. Create Bind Group Layout
        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } }, // normal
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }, // depth
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } }, // noise
                { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // camera
                { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // config
                { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } }, // color
            ]
        });

        // 4. Create Pipeline
        this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({ code: SSGI_SHADER }), // Use shared VS or embedded
                entryPoint: 'vs_main'
            },
            fragment: {
                module: this.device.createShaderModule({ code: SSGI_SHADER }),
                entryPoint: 'fs_main',
                targets: [{ format: 'rgba16float' }] // Assuming HDR pipeline
            },
            primitive: { topology: 'triangle-list' }
        });
    }

    private updateConfigBuffer() {
        if (!this.configBuffer || !this.wasmReady) return;

        const wasmConfig = new WasmSSGIConfig(
            this.config.stepCount, 
            this.config.radius, 
            this.config.thickness, 
            this.config.maxRoughness
        );
        
        const uniforms = get_ssgi_uniforms(wasmConfig);
        const data = uniforms.get_data(); // Float32Array
        
        this.device.queue.writeBuffer(this.configBuffer, 0, data as unknown as BufferSource);
        
        // Dispose WASM objects
        // wasmConfig.free(); // If wasm-bindgen generates free
        // uniforms.free();
    }

    render(
        encoder: GPUCommandEncoder,
        depthView: GPUTextureView,
        normalView: GPUTextureView,
        colorView: GPUTextureView,
        outputView: GPUTextureView,
        cameraUniformBuffer: GPUBuffer
    ) {
        if (!this.pipeline || !this.bindGroupLayout || !this.noiseTexture || !this.configBuffer) return;

        if (!this.cachedBindGroup || 
            this.cachedDepthView !== depthView || 
            this.cachedNormalView !== normalView || 
            this.cachedColorView !== colorView ||
            this.cachedOutputView !== outputView ||
            this.cameraUniformBuffer !== cameraUniformBuffer) {
            
            this.cachedBindGroup = this.device.createBindGroup({
                layout: this.bindGroupLayout,
                entries: [
                    { binding: 0, resource: normalView },
                    { binding: 1, resource: depthView },
                    { binding: 2, resource: this.noiseTexture.createView() },
                    { binding: 3, resource: { buffer: cameraUniformBuffer } },
                    { binding: 4, resource: { buffer: this.configBuffer } },
                    { binding: 5, resource: colorView },
                ]
            });

            this.cachedDepthView = depthView;
            this.cachedNormalView = normalView;
            this.cachedColorView = colorView;
            this.cachedOutputView = outputView;
            this.cameraUniformBuffer = cameraUniformBuffer;
        }

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: outputView,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 }
            }]
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.cachedBindGroup);
        pass.draw(3, 1, 0, 0);
        pass.end();
    }

    dispose() {
        try {
            this.noiseTexture?.destroy();
            this.configBuffer?.destroy();
        } catch {
            // ignore
        }
        this.noiseTexture = null;
        this.configBuffer = null;
        this.pipeline = null;
        this.bindGroupLayout = null;
        this.cachedBindGroup = null;
        this.cachedDepthView = null;
        this.cachedNormalView = null;
        this.cachedColorView = null;
        this.cachedOutputView = null;
        this.cameraUniformBuffer = null;
    }
}

