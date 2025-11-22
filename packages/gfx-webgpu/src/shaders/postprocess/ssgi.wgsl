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
    let step_len = ssgi_config.radius / f32(steps);
    
    // Simple linear march for demonstration
    // We use noise to randomize the ray direction slightly
    // In SSGI we ideally want to raymarch in Screen Space, 
    // but here we do a hybrid: march in View Space, project to Screen Space.
    
    var accum_color = vec3<f32>(0.0);
    var valid_samples = 0.0;
    
    // Random rotation vector on tangent plane could be better
    // For now, just jitter the march
    
    for (var i = 0; i < steps; i++) {
        let t = (f32(i) + noise.x) / f32(steps);
        let sample_dist = t * ssgi_config.radius;
        
        // March along reflection vector or normal?
        // For diffuse GI, we want cosine weighted hemisphere.
        // This is a simplified "SSAO-like" sampling but grabbing color.
        
        // Random direction in view space (very simplified)
        let rand_dir = vec3<f32>(noise.x * 2.0 - 1.0, noise.y * 2.0 - 1.0, 1.0); // Bias towards Z
        let ray_dir = normalize(normal_view + rand_dir * 0.5);
        
        let sample_pos_view = view_pos + ray_dir * sample_dist;
        let sample_uv = get_uv_from_view_position(sample_pos_view);
        
        if (sample_uv.x >= 0.0 && sample_uv.x <= 1.0 && sample_uv.y >= 0.0 && sample_uv.y <= 1.0) {
             let sample_depth = textureSampleLevel(depth_texture, depth_texture, sample_uv, 0.0); // Error: depth texture cannot be sampled with sampler usually, unless float depth?
             // textureLoad is safer for depth if no sampler provided
             let sample_depth_val = textureLoad(depth_texture, vec2<i32>(sample_uv * camera.screen_size), 0);
             
             let sample_pos_rec = get_view_position(sample_uv, sample_depth_val);
             
             // Check for occlusion
             let dist = distance(sample_pos_rec, view_pos);
             let diff = sample_pos_view.z - sample_pos_rec.z;
             
             if (diff > 0.001 && diff < ssgi_config.thickness) {
                 // Hit surface
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
