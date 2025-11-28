//! Atlas Builder
//!
//! Assembles texture data into a final atlas texture.

use wasm_bindgen::prelude::*;

/// Build atlas texture from packed textures
///
/// # Arguments
/// * `textures` - Concatenated RGBA data of all textures
/// * `tex_sizes` - Sizes array [w0, h0, w1, h1, ...]
/// * `atlas_width` - Atlas texture width
/// * `atlas_height` - Atlas texture height
/// * `positions` - Packed positions [x0, y0, x1, y1, ...] from pack_rectangles
///
/// # Returns
/// Final atlas RGBA data
#[wasm_bindgen]
pub fn build_atlas(
    textures: &[u8],
    tex_sizes: &[u32],
    atlas_width: u32,
    atlas_height: u32,
    positions: &[u32],
) -> Vec<u8> {
    let tex_count = tex_sizes.len() / 2;
    let atlas_size = (atlas_width * atlas_height * 4) as usize;
    
    // Initialize atlas with transparent black
    let mut atlas = vec![0u8; atlas_size];
    
    // Copy each texture to its position
    let mut tex_offset = 0usize;
    
    for i in 0..tex_count {
        let tex_w = tex_sizes[i * 2] as usize;
        let tex_h = tex_sizes[i * 2 + 1] as usize;
        let tex_pixels = tex_w * tex_h;
        let tex_bytes = tex_pixels * 4;
        
        if i * 2 + 1 >= positions.len() {
            tex_offset += tex_bytes;
            continue;
        }
        
        let pos_x = positions[i * 2] as usize;
        let pos_y = positions[i * 2 + 1] as usize;
        
        // Copy texture data
        for y in 0..tex_h {
            for x in 0..tex_w {
                let src_idx = tex_offset + (y * tex_w + x) * 4;
                let dst_x = pos_x + x;
                let dst_y = pos_y + y;
                
                if dst_x < atlas_width as usize && dst_y < atlas_height as usize {
                    let dst_idx = (dst_y * atlas_width as usize + dst_x) * 4;
                    
                    if src_idx + 3 < textures.len() && dst_idx + 3 < atlas.len() {
                        atlas[dst_idx] = textures[src_idx];
                        atlas[dst_idx + 1] = textures[src_idx + 1];
                        atlas[dst_idx + 2] = textures[src_idx + 2];
                        atlas[dst_idx + 3] = textures[src_idx + 3];
                    }
                }
            }
        }
        
        tex_offset += tex_bytes;
    }
    
    atlas
}

/// Build atlas with automatic padding (copies edge pixels)
#[wasm_bindgen]
pub fn build_atlas_with_padding(
    textures: &[u8],
    tex_sizes: &[u32],
    atlas_width: u32,
    atlas_height: u32,
    positions: &[u32],
    padding: u32,
) -> Vec<u8> {
    let tex_count = tex_sizes.len() / 2;
    let atlas_size = (atlas_width * atlas_height * 4) as usize;
    
    // Initialize atlas with transparent black
    let mut atlas = vec![0u8; atlas_size];
    
    // Copy each texture with padding
    let mut tex_offset = 0usize;
    
    for i in 0..tex_count {
        let tex_w = tex_sizes[i * 2] as usize;
        let tex_h = tex_sizes[i * 2 + 1] as usize;
        let tex_bytes = tex_w * tex_h * 4;
        
        if i * 2 + 1 >= positions.len() {
            tex_offset += tex_bytes;
            continue;
        }
        
        let pos_x = positions[i * 2] as i32;
        let pos_y = positions[i * 2 + 1] as i32;
        let pad = padding as i32;
        
        // Copy with padding (extend edge pixels)
        for dy in -pad..(tex_h as i32 + pad) {
            for dx in -pad..(tex_w as i32 + pad) {
                let dst_x = pos_x + dx;
                let dst_y = pos_y + dy;
                
                if dst_x < 0
                    || dst_y < 0
                    || dst_x >= atlas_width as i32
                    || dst_y >= atlas_height as i32
                {
                    continue;
                }
                
                // Clamp source coordinates to texture bounds
                let src_x = dx.clamp(0, tex_w as i32 - 1) as usize;
                let src_y = dy.clamp(0, tex_h as i32 - 1) as usize;
                
                let src_idx = tex_offset + (src_y * tex_w + src_x) * 4;
                let dst_idx = (dst_y as usize * atlas_width as usize + dst_x as usize) * 4;
                
                if src_idx + 3 < textures.len() && dst_idx + 3 < atlas.len() {
                    atlas[dst_idx] = textures[src_idx];
                    atlas[dst_idx + 1] = textures[src_idx + 1];
                    atlas[dst_idx + 2] = textures[src_idx + 2];
                    atlas[dst_idx + 3] = textures[src_idx + 3];
                }
            }
        }
        
        tex_offset += tex_bytes;
    }
    
    atlas
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_atlas_single() {
        // Single 2x2 red texture
        let textures: Vec<u8> = vec![
            255, 0, 0, 255,  255, 0, 0, 255,
            255, 0, 0, 255,  255, 0, 0, 255,
        ];
        let tex_sizes = vec![2, 2];
        let positions = vec![0, 0];
        
        let atlas = build_atlas(&textures, &tex_sizes, 4, 4, &positions);
        
        assert_eq!(atlas.len(), 4 * 4 * 4);
        // Check top-left pixel is red
        assert_eq!(atlas[0], 255); // R
        assert_eq!(atlas[1], 0);   // G
        assert_eq!(atlas[2], 0);   // B
        assert_eq!(atlas[3], 255); // A
    }

    #[test]
    fn test_build_atlas_multiple() {
        // Two 2x2 textures: red and green
        let textures: Vec<u8> = vec![
            // Red texture
            255, 0, 0, 255,  255, 0, 0, 255,
            255, 0, 0, 255,  255, 0, 0, 255,
            // Green texture
            0, 255, 0, 255,  0, 255, 0, 255,
            0, 255, 0, 255,  0, 255, 0, 255,
        ];
        let tex_sizes = vec![2, 2, 2, 2];
        let positions = vec![0, 0, 2, 0]; // Red at (0,0), Green at (2,0)
        
        let atlas = build_atlas(&textures, &tex_sizes, 4, 4, &positions);
        
        // Check red at (0,0)
        assert_eq!(atlas[0], 255);
        assert_eq!(atlas[1], 0);
        
        // Check green at (2,0)
        let green_idx = 2 * 4; // x=2, y=0
        assert_eq!(atlas[green_idx], 0);
        assert_eq!(atlas[green_idx + 1], 255);
    }
}

