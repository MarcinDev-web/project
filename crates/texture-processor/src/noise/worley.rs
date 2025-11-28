//! Worley (Cellular) Noise Implementation
//!
//! Also known as cellular noise or Voronoi noise.
//! Creates patterns based on distance to randomly placed feature points.

use wasm_bindgen::prelude::*;

/// Distance metric types
#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub enum DistanceMetric {
    Euclidean = 0,
    Manhattan = 1,
    Chebyshev = 2,
}

impl From<u32> for DistanceMetric {
    fn from(v: u32) -> Self {
        match v {
            1 => DistanceMetric::Manhattan,
            2 => DistanceMetric::Chebyshev,
            _ => DistanceMetric::Euclidean,
        }
    }
}

/// Simple hash function for feature point generation
#[inline]
fn hash2(x: i32, y: i32, seed: u32) -> u32 {
    let h = (x as u32)
        .wrapping_mul(374761393)
        .wrapping_add((y as u32).wrapping_mul(668265263))
        .wrapping_add(seed);
    let h = h ^ (h >> 13);
    let h = h.wrapping_mul(1274126177);
    h ^ (h >> 16)
}

/// Get feature point position within cell
#[inline]
fn get_feature_point(cell_x: i32, cell_y: i32, seed: u32) -> (f32, f32) {
    let hash = hash2(cell_x, cell_y, seed);
    let fx = cell_x as f32 + (hash & 0xFFFF) as f32 / 65535.0;
    let fy = cell_y as f32 + ((hash >> 16) & 0xFFFF) as f32 / 65535.0;
    (fx, fy)
}

/// Calculate distance based on metric
#[inline]
fn calculate_distance(dx: f32, dy: f32, metric: DistanceMetric) -> f32 {
    match metric {
        DistanceMetric::Euclidean => (dx * dx + dy * dy).sqrt(),
        DistanceMetric::Manhattan => dx.abs() + dy.abs(),
        DistanceMetric::Chebyshev => dx.abs().max(dy.abs()),
    }
}

/// 2D Worley noise at point (x, y)
///
/// Returns distance to nearest feature point, normalized to approximately [0, 1]
#[wasm_bindgen]
pub fn worley_2d(x: f32, y: f32, seed: u32) -> f32 {
    worley_2d_ex(x, y, seed, DistanceMetric::Euclidean)
}

/// 2D Worley noise with configurable distance metric
pub fn worley_2d_ex(x: f32, y: f32, seed: u32, metric: DistanceMetric) -> f32 {
    let cell_x = x.floor() as i32;
    let cell_y = y.floor() as i32;

    let mut min_dist = f32::MAX;

    // Check 3x3 neighborhood
    for dy in -1..=1 {
        for dx in -1..=1 {
            let nx = cell_x + dx;
            let ny = cell_y + dy;

            let (fx, fy) = get_feature_point(nx, ny, seed);
            let dist = calculate_distance(x - fx, y - fy, metric);

            if dist < min_dist {
                min_dist = dist;
            }
        }
    }

    // Normalize (roughly to 0-1 range)
    min_dist.min(1.0)
}

/// Generate 2D Worley noise for entire image
///
/// # Arguments
/// * `output` - Output buffer (width * height floats)
/// * `width` - Image width
/// * `height` - Image height
/// * `scale` - Noise scale (smaller = larger cells)
/// * `seed` - Random seed
#[wasm_bindgen]
pub fn worley_2d_batch(output: &mut [f32], width: u32, height: u32, scale: f32, seed: u32) {
    worley_2d_batch_ex(output, width, height, scale, seed, DistanceMetric::Euclidean);
}

/// Generate 2D Worley noise with configurable metric
pub fn worley_2d_batch_ex(
    output: &mut [f32],
    width: u32,
    height: u32,
    scale: f32,
    seed: u32,
    metric: DistanceMetric,
) {
    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) as usize;
            let nx = x as f32 * scale;
            let ny = y as f32 * scale;
            output[idx] = worley_2d_ex(nx, ny, seed, metric);
        }
    }
}

/// F1-F2 Worley noise (second nearest minus nearest)
///
/// Creates more interesting patterns with ridges
#[wasm_bindgen]
pub fn worley_f1f2(x: f32, y: f32, seed: u32) -> f32 {
    let cell_x = x.floor() as i32;
    let cell_y = y.floor() as i32;

    let mut min_dist1 = f32::MAX;
    let mut min_dist2 = f32::MAX;

    // Check 3x3 neighborhood
    for dy in -1..=1 {
        for dx in -1..=1 {
            let nx = cell_x + dx;
            let ny = cell_y + dy;

            let (fx, fy) = get_feature_point(nx, ny, seed);
            let dist = ((x - fx) * (x - fx) + (y - fy) * (y - fy)).sqrt();

            if dist < min_dist1 {
                min_dist2 = min_dist1;
                min_dist1 = dist;
            } else if dist < min_dist2 {
                min_dist2 = dist;
            }
        }
    }

    (min_dist2 - min_dist1).min(1.0)
}

/// Inverted Worley noise (1 - distance)
///
/// Creates bright spots at cell centers
#[wasm_bindgen]
pub fn worley_inverted(x: f32, y: f32, seed: u32) -> f32 {
    1.0 - worley_2d(x, y, seed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_worley_2d_range() {
        for i in 0..100 {
            let x = i as f32 * 0.1;
            let y = i as f32 * 0.15;
            let v = worley_2d(x, y, 12345);
            assert!(v >= 0.0 && v <= 1.5, "Value {} out of expected range", v);
        }
    }

    #[test]
    fn test_worley_2d_deterministic() {
        let v1 = worley_2d(1.5, 2.5, 12345);
        let v2 = worley_2d(1.5, 2.5, 12345);
        assert_eq!(v1, v2);
    }

    #[test]
    fn test_worley_f1f2() {
        let v = worley_f1f2(0.5, 0.5, 12345);
        assert!(v >= 0.0 && v <= 1.0);
    }
}

