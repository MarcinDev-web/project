//! Mipmap Generation
//!
//! Generates mipmap chains for texture filtering.
//! Supports both fast box filtering and high-quality Lanczos filtering.

use wasm_bindgen::prelude::*;

/// Generate mipmaps using box filter (fast, 2x2 averaging)
///
/// # Arguments
/// * `base_data` - Base level RGBA data
/// * `width` - Base level width
/// * `height` - Base level height
///
/// # Returns
/// All mipmap levels concatenated (including base level)
#[wasm_bindgen]
pub fn generate_mipmaps_box(base_data: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mip_count = calculate_mip_count(width, height);
    let total_size = calculate_total_mip_size(width, height);
    
    let mut result = Vec::with_capacity(total_size);
    
    // Copy base level
    result.extend_from_slice(base_data);
    
    // Generate subsequent levels
    let mut current_width = width;
    let mut current_height = height;
    
    for _ in 1..mip_count {
        let prev_width = current_width;
        let prev_height = current_height;
        
        current_width = (current_width / 2).max(1);
        current_height = (current_height / 2).max(1);
        
        // Copy previous level to temporary buffer to avoid borrow conflict
        let prev_size = (prev_width * prev_height * 4) as usize;
        let prev_start = result.len() - prev_size;
        let prev_data: Vec<u8> = result[prev_start..].to_vec();
        
        // Reserve space for this level
        let level_size = (current_width * current_height * 4) as usize;
        let prev_len = result.len();
        result.resize(prev_len + level_size, 0);
        
        // Generate this level from previous
        let current_offset = prev_len;
        downsample_box(
            &prev_data,
            prev_width,
            prev_height,
            &mut result[current_offset..current_offset + level_size],
            current_width,
            current_height,
        );
    }
    
    result
}

/// Downsample using 2x2 box filter
fn downsample_box(
    src: &[u8],
    src_width: u32,
    src_height: u32,
    dst: &mut [u8],
    dst_width: u32,
    dst_height: u32,
) {
    #[cfg(all(feature = "simd", target_arch = "wasm32"))]
    {
        downsample_box_simd(src, src_width, src_height, dst, dst_width, dst_height);
    }
    
    #[cfg(not(all(feature = "simd", target_arch = "wasm32")))]
    {
        downsample_box_scalar(src, src_width, src_height, dst, dst_width, dst_height);
    }
}

/// Scalar box filter implementation
fn downsample_box_scalar(
    src: &[u8],
    src_width: u32,
    _src_height: u32,
    dst: &mut [u8],
    dst_width: u32,
    dst_height: u32,
) {
    for y in 0..dst_height {
        for x in 0..dst_width {
            let dst_idx = ((y * dst_width + x) * 4) as usize;
            
            // Source coordinates (2x2 block)
            let sx = x * 2;
            let sy = y * 2;
            
            // Sample 4 source pixels
            let mut r = 0u32;
            let mut g = 0u32;
            let mut b = 0u32;
            let mut a = 0u32;
            
            for dy in 0..2 {
                for dx in 0..2 {
                    let src_idx = (((sy + dy) * src_width + (sx + dx)) * 4) as usize;
                    if src_idx + 3 < src.len() {
                        r += src[src_idx] as u32;
                        g += src[src_idx + 1] as u32;
                        b += src[src_idx + 2] as u32;
                        a += src[src_idx + 3] as u32;
                    }
                }
            }
            
            // Average
            dst[dst_idx] = (r / 4) as u8;
            dst[dst_idx + 1] = (g / 4) as u8;
            dst[dst_idx + 2] = (b / 4) as u8;
            dst[dst_idx + 3] = (a / 4) as u8;
        }
    }
}

/// SIMD box filter implementation
#[cfg(all(feature = "simd", target_arch = "wasm32"))]
fn downsample_box_simd(
    src: &[u8],
    src_width: u32,
    _src_height: u32,
    dst: &mut [u8],
    dst_width: u32,
    dst_height: u32,
) {
    // For now, use scalar implementation
    // Full SIMD would process multiple output pixels at once
    downsample_box_scalar(src, src_width, _src_height, dst, dst_width, dst_height);
}

/// Generate mipmaps using Lanczos filter (high quality)
///
/// # Arguments
/// * `base_data` - Base level RGBA data
/// * `width` - Base level width
/// * `height` - Base level height
/// * `radius` - Lanczos filter radius (2 or 3 recommended)
///
/// # Returns
/// All mipmap levels concatenated
#[wasm_bindgen]
pub fn generate_mipmaps_lanczos(
    base_data: &[u8],
    width: u32,
    height: u32,
    radius: u32,
) -> Vec<u8> {
    let mip_count = calculate_mip_count(width, height);
    let total_size = calculate_total_mip_size(width, height);
    
    let mut result = Vec::with_capacity(total_size);
    
    // Copy base level
    result.extend_from_slice(base_data);
    
    // Generate subsequent levels
    let mut current_width = width;
    let mut current_height = height;
    
    for _ in 1..mip_count {
        let prev_width = current_width;
        let prev_height = current_height;
        
        current_width = (current_width / 2).max(1);
        current_height = (current_height / 2).max(1);
        
        // Copy previous level to temporary buffer to avoid borrow conflict
        let prev_size = (prev_width * prev_height * 4) as usize;
        let prev_start = result.len() - prev_size;
        let prev_data: Vec<u8> = result[prev_start..].to_vec();
        
        // Reserve space for this level
        let level_size = (current_width * current_height * 4) as usize;
        let prev_len = result.len();
        result.resize(prev_len + level_size, 0);
        
        // Generate this level using Lanczos
        let current_offset = prev_len;
        downsample_lanczos(
            &prev_data,
            prev_width,
            prev_height,
            &mut result[current_offset..current_offset + level_size],
            current_width,
            current_height,
            radius,
        );
    }
    
    result
}

/// Lanczos filter kernel
#[inline]
fn lanczos_kernel(x: f32, radius: f32) -> f32 {
    if x.abs() < 0.0001 {
        return 1.0;
    }
    if x.abs() >= radius {
        return 0.0;
    }
    
    let pi_x = std::f32::consts::PI * x;
    let pi_x_r = pi_x / radius;
    
    (pi_x.sin() / pi_x) * (pi_x_r.sin() / pi_x_r)
}

/// Downsample using Lanczos filter
fn downsample_lanczos(
    src: &[u8],
    src_width: u32,
    src_height: u32,
    dst: &mut [u8],
    dst_width: u32,
    dst_height: u32,
    radius: u32,
) {
    let scale_x = src_width as f32 / dst_width as f32;
    let scale_y = src_height as f32 / dst_height as f32;
    let radius_f = radius as f32;
    
    for y in 0..dst_height {
        for x in 0..dst_width {
            let dst_idx = ((y * dst_width + x) * 4) as usize;
            
            // Center position in source
            let src_x = (x as f32 + 0.5) * scale_x - 0.5;
            let src_y = (y as f32 + 0.5) * scale_y - 0.5;
            
            let mut r = 0.0f32;
            let mut g = 0.0f32;
            let mut b = 0.0f32;
            let mut a = 0.0f32;
            let mut weight_sum = 0.0f32;
            
            // Sample window
            let x_start = (src_x - radius_f * scale_x).floor() as i32;
            let x_end = (src_x + radius_f * scale_x).ceil() as i32;
            let y_start = (src_y - radius_f * scale_y).floor() as i32;
            let y_end = (src_y + radius_f * scale_y).ceil() as i32;
            
            for sy in y_start..=y_end {
                for sx in x_start..=x_end {
                    // Clamp to source bounds
                    let csx = sx.clamp(0, src_width as i32 - 1) as u32;
                    let csy = sy.clamp(0, src_height as i32 - 1) as u32;
                    
                    let src_idx = ((csy * src_width + csx) * 4) as usize;
                    
                    // Calculate weight
                    let dx = (sx as f32 - src_x) / scale_x;
                    let dy = (sy as f32 - src_y) / scale_y;
                    let weight = lanczos_kernel(dx, radius_f) * lanczos_kernel(dy, radius_f);
                    
                    if src_idx + 3 < src.len() {
                        r += src[src_idx] as f32 * weight;
                        g += src[src_idx + 1] as f32 * weight;
                        b += src[src_idx + 2] as f32 * weight;
                        a += src[src_idx + 3] as f32 * weight;
                        weight_sum += weight;
                    }
                }
            }
            
            // Normalize and clamp
            if weight_sum > 0.0 {
                dst[dst_idx] = (r / weight_sum).clamp(0.0, 255.0) as u8;
                dst[dst_idx + 1] = (g / weight_sum).clamp(0.0, 255.0) as u8;
                dst[dst_idx + 2] = (b / weight_sum).clamp(0.0, 255.0) as u8;
                dst[dst_idx + 3] = (a / weight_sum).clamp(0.0, 255.0) as u8;
            }
        }
    }
}

/// Calculate number of mip levels for given dimensions
#[wasm_bindgen]
pub fn calculate_mip_count(width: u32, height: u32) -> u32 {
    let max_dim = width.max(height);
    (max_dim as f32).log2().floor() as u32 + 1
}

/// Calculate total size of all mip levels
fn calculate_total_mip_size(width: u32, height: u32) -> usize {
    let mut total = 0usize;
    let mut w = width;
    let mut h = height;
    
    let mip_count = calculate_mip_count(width, height);
    
    for _ in 0..mip_count {
        total += (w * h * 4) as usize;
        w = (w / 2).max(1);
        h = (h / 2).max(1);
    }
    
    total
}

/// Get offset and size for specific mip level
#[wasm_bindgen]
pub fn get_mip_info(base_width: u32, base_height: u32, level: u32) -> Vec<u32> {
    let mut offset = 0u32;
    let mut w = base_width;
    let mut h = base_height;
    
    for _ in 0..level {
        offset += w * h * 4;
        w = (w / 2).max(1);
        h = (h / 2).max(1);
    }
    
    vec![offset, w, h]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mip_count() {
        assert_eq!(calculate_mip_count(128, 128), 8); // 128->64->32->16->8->4->2->1
        assert_eq!(calculate_mip_count(256, 256), 9);
        assert_eq!(calculate_mip_count(64, 32), 7);
    }

    #[test]
    fn test_generate_mipmaps_box() {
        // Create 4x4 test image
        let mut base = vec![0u8; 4 * 4 * 4];
        for i in 0..16 {
            base[i * 4] = 255;     // R
            base[i * 4 + 1] = 128; // G
            base[i * 4 + 2] = 64;  // B
            base[i * 4 + 3] = 255; // A
        }

        let result = generate_mipmaps_box(&base, 4, 4);
        
        // Should have 4x4 + 2x2 + 1x1 = 16 + 4 + 1 = 21 pixels
        assert_eq!(result.len(), 21 * 4);
        
        // Check 2x2 level (offset 64)
        assert_eq!(result[64], 255);     // R should be preserved
        assert_eq!(result[65], 128);     // G should be preserved
    }

    #[test]
    fn test_get_mip_info() {
        let info = get_mip_info(128, 128, 0);
        assert_eq!(info[0], 0);   // Offset
        assert_eq!(info[1], 128); // Width
        assert_eq!(info[2], 128); // Height

        let info = get_mip_info(128, 128, 1);
        assert_eq!(info[0], 128 * 128 * 4); // Offset after level 0
        assert_eq!(info[1], 64);
        assert_eq!(info[2], 64);
    }
}

