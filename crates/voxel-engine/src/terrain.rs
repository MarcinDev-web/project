use wasm_bindgen::prelude::*;
use noise::{NoiseFn, Perlin};

#[wasm_bindgen]
pub fn generate_heightmap(
    width: u32,
    depth: u32,
    seed: u32,
    scale: f64,
    offset_x: f64,
    offset_z: f64,
    octaves: u32,
    persistence: f64,
    lacunarity: f64
) -> Vec<f32> {
    let perlin = Perlin::new(seed);
    let mut heightmap = Vec::with_capacity((width * depth) as usize);

    for z in 0..depth {
        for x in 0..width {
            let nx = (x as f64 + offset_x) * scale;
            let nz = (z as f64 + offset_z) * scale;
            
            let mut amplitude = 1.0;
            let mut frequency = 1.0;
            let mut noise_value = 0.0;
            let mut _max_value = 0.0; // Used to normalize if needed, but we return raw noise

            for _ in 0..octaves {
                noise_value += perlin.get([nx * frequency, nz * frequency]) * amplitude;
                _max_value += amplitude;
                amplitude *= persistence;
                frequency *= lacunarity;
            }

            heightmap.push(noise_value as f32);
        }
    }

    heightmap
}

#[wasm_bindgen]
pub fn generate_chunk(
    cx: i32,
    cy: i32,
    cz: i32,
    size: u32,
    seed: u32,
    scale: f64,
    noise_scale: f64, // Scale for 3D noise
    threshold: f64,   // Threshold for caves
) -> Vec<u16> {
    let perlin = Perlin::new(seed);
    let mut voxels = Vec::with_capacity((size * size * size) as usize);

    for z in 0..size {
        for y in 0..size {
            for x in 0..size {
                let wx = (cx * size as i32 + x as i32) as f64;
                let wy = (cy * size as i32 + y as i32) as f64;
                let wz = (cz * size as i32 + z as i32) as f64;

                // Simple 2D terrain height
                // FBM for terrain
                let mut terrain_height = 0.0;
                let mut amplitude = 1.0;
                let mut frequency = 1.0;
                
                for _ in 0..3 {
                    let nx = wx * scale * frequency;
                    let nz = wz * scale * frequency;
                    terrain_height += perlin.get([nx, nz]) * amplitude;
                    amplitude *= 0.5;
                    frequency *= 2.0;
                }
                // Normalize and scale height (e.g. base 32 +/- 16)
                // Assuming noise is roughly -1 to 1
                terrain_height = terrain_height * 20.0 + 32.0;

                // 3D Noise for Caves
                // Use different seed or offset for 3D noise to avoid correlation with terrain
                // We use same perlin but different coords scale/offset
                let nx = wx * noise_scale + 100.0;
                let ny = wy * noise_scale + 100.0;
                let nz = wz * noise_scale + 100.0;
                let cave_noise_val = perlin.get([nx, ny, nz]);

                // Determine Voxel
                let mut id = 0; // Air

                // 1. Basic Terrain Shape
                if wy < terrain_height {
                     id = 1; // Stone
                }

                // 2. Cave Carving
                // If we are solid, check if we are in a cave
                if id != 0 {
                    // Standard Perlin is -1 to 1. 
                    // Caves usually around 0.5? Or ridge noise?
                    // Let's say if noise > threshold (e.g. 0.6), it's a cave.
                    if cave_noise_val > threshold {
                        id = 0; // Cave Air
                    }
                }

                // 3. Bedrock at y=0 (Global 0)
                if wy == 0.0 {
                    id = 5; // Bedrock (assumed ID)
                }

                voxels.push(id);
            }
        }
    }

    voxels
}

