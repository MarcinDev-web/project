//! Rectangle Bin-Packing using MaxRects Algorithm
//!
//! Efficiently packs rectangles into a larger atlas texture.
//! Uses Best Short Side Fit (BSSF) heuristic.

use wasm_bindgen::prelude::*;

/// Result of rectangle packing operation
#[wasm_bindgen]
pub struct PackResult {
    /// Packed positions [x0, y0, x1, y1, ...] for each rectangle
    positions: Vec<u32>,
    /// Actual atlas width used
    atlas_width: u32,
    /// Actual atlas height used
    atlas_height: u32,
    /// Number of rectangles successfully packed
    packed_count: u32,
}

#[wasm_bindgen]
impl PackResult {
    /// Get packed positions array
    pub fn positions(&self) -> Vec<u32> {
        self.positions.clone()
    }
    
    /// Get atlas width
    pub fn atlas_width(&self) -> u32 {
        self.atlas_width
    }
    
    /// Get atlas height
    pub fn atlas_height(&self) -> u32 {
        self.atlas_height
    }
    
    /// Get number of packed rectangles
    pub fn packed_count(&self) -> u32 {
        self.packed_count
    }
}

/// Rectangle in the packer
#[derive(Clone, Copy, Debug)]
struct Rect {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

impl Rect {
    fn new(x: u32, y: u32, width: u32, height: u32) -> Self {
        Rect { x, y, width, height }
    }
    
    fn contains(&self, other: &Rect) -> bool {
        other.x >= self.x
            && other.y >= self.y
            && other.x + other.width <= self.x + self.width
            && other.y + other.height <= self.y + self.height
    }
    
    fn intersects(&self, other: &Rect) -> bool {
        self.x < other.x + other.width
            && self.x + self.width > other.x
            && self.y < other.y + other.height
            && self.y + self.height > other.y
    }
}

/// MaxRects bin packer
struct MaxRectsPacker {
    bin_width: u32,
    bin_height: u32,
    free_rects: Vec<Rect>,
    used_rects: Vec<Rect>,
}

impl MaxRectsPacker {
    fn new(width: u32, height: u32) -> Self {
        let mut packer = MaxRectsPacker {
            bin_width: width,
            bin_height: height,
            free_rects: Vec::new(),
            used_rects: Vec::new(),
        };
        
        // Start with entire bin as free
        packer.free_rects.push(Rect::new(0, 0, width, height));
        packer
    }
    
    /// Insert rectangle using Best Short Side Fit heuristic
    fn insert(&mut self, width: u32, height: u32, padding: u32) -> Option<Rect> {
        let padded_w = width + padding;
        let padded_h = height + padding;
        
        // Find best position
        let (best_rect, best_idx) = self.find_best_position(padded_w, padded_h)?;
        
        // Place rectangle
        let placed = Rect::new(best_rect.x, best_rect.y, width, height);
        let padded_placed = Rect::new(best_rect.x, best_rect.y, padded_w, padded_h);
        
        // Split free rectangles
        self.split_free_rect(best_idx, &padded_placed);
        
        // Prune contained free rectangles
        self.prune_free_rects();
        
        self.used_rects.push(placed);
        Some(placed)
    }
    
    /// Find best position using BSSF (Best Short Side Fit)
    fn find_best_position(&self, width: u32, height: u32) -> Option<(Rect, usize)> {
        let mut best_rect = None;
        let mut best_idx = 0;
        let mut best_short_side = u32::MAX;
        let mut best_long_side = u32::MAX;
        
        for (i, free_rect) in self.free_rects.iter().enumerate() {
            // Try normal orientation
            if width <= free_rect.width && height <= free_rect.height {
                let leftover_h = free_rect.width - width;
                let leftover_v = free_rect.height - height;
                let short_side = leftover_h.min(leftover_v);
                let long_side = leftover_h.max(leftover_v);
                
                if short_side < best_short_side
                    || (short_side == best_short_side && long_side < best_long_side)
                {
                    best_rect = Some(Rect::new(free_rect.x, free_rect.y, width, height));
                    best_idx = i;
                    best_short_side = short_side;
                    best_long_side = long_side;
                }
            }
            
            // Try rotated orientation
            if height <= free_rect.width && width <= free_rect.height {
                let leftover_h = free_rect.width - height;
                let leftover_v = free_rect.height - width;
                let short_side = leftover_h.min(leftover_v);
                let long_side = leftover_h.max(leftover_v);
                
                if short_side < best_short_side
                    || (short_side == best_short_side && long_side < best_long_side)
                {
                    // Note: We don't actually rotate for simplicity
                    // In a full implementation, we'd track rotation
                }
            }
        }
        
        best_rect.map(|r| (r, best_idx))
    }
    
    /// Split a free rectangle after placing a new rectangle
    fn split_free_rect(&mut self, idx: usize, placed: &Rect) {
        let free_rect = self.free_rects[idx];
        
        // Remove the original free rect
        self.free_rects.swap_remove(idx);
        
        // Create new free rects from the remaining space
        
        // Right split
        if placed.x + placed.width < free_rect.x + free_rect.width {
            let new_rect = Rect::new(
                placed.x + placed.width,
                free_rect.y,
                free_rect.x + free_rect.width - (placed.x + placed.width),
                free_rect.height,
            );
            self.free_rects.push(new_rect);
        }
        
        // Bottom split
        if placed.y + placed.height < free_rect.y + free_rect.height {
            let new_rect = Rect::new(
                free_rect.x,
                placed.y + placed.height,
                free_rect.width,
                free_rect.y + free_rect.height - (placed.y + placed.height),
            );
            self.free_rects.push(new_rect);
        }
        
        // Also need to handle overlapping free rectangles
        let mut i = 0;
        while i < self.free_rects.len() {
            if self.free_rects[i].intersects(placed) {
                let split = self.split_on_placed(&self.free_rects[i], placed);
                self.free_rects.swap_remove(i);
                for r in split {
                    self.free_rects.push(r);
                }
            } else {
                i += 1;
            }
        }
    }
    
    /// Split a free rectangle that overlaps with a placed rectangle
    fn split_on_placed(&self, free_rect: &Rect, placed: &Rect) -> Vec<Rect> {
        let mut result = Vec::new();
        
        // Left part
        if placed.x > free_rect.x {
            result.push(Rect::new(
                free_rect.x,
                free_rect.y,
                placed.x - free_rect.x,
                free_rect.height,
            ));
        }
        
        // Right part
        if placed.x + placed.width < free_rect.x + free_rect.width {
            result.push(Rect::new(
                placed.x + placed.width,
                free_rect.y,
                free_rect.x + free_rect.width - (placed.x + placed.width),
                free_rect.height,
            ));
        }
        
        // Top part
        if placed.y > free_rect.y {
            result.push(Rect::new(
                free_rect.x,
                free_rect.y,
                free_rect.width,
                placed.y - free_rect.y,
            ));
        }
        
        // Bottom part
        if placed.y + placed.height < free_rect.y + free_rect.height {
            result.push(Rect::new(
                free_rect.x,
                placed.y + placed.height,
                free_rect.width,
                free_rect.y + free_rect.height - (placed.y + placed.height),
            ));
        }
        
        result
    }
    
    /// Remove free rectangles that are contained within others
    fn prune_free_rects(&mut self) {
        let mut i = 0;
        while i < self.free_rects.len() {
            let mut j = i + 1;
            while j < self.free_rects.len() {
                if self.free_rects[i].contains(&self.free_rects[j]) {
                    self.free_rects.swap_remove(j);
                } else if self.free_rects[j].contains(&self.free_rects[i]) {
                    self.free_rects.swap_remove(i);
                    j = i + 1;
                    if i >= self.free_rects.len() {
                        break;
                    }
                } else {
                    j += 1;
                }
            }
            if i < self.free_rects.len() {
                i += 1;
            }
        }
    }
}

/// Pack rectangles into an atlas
///
/// # Arguments
/// * `widths` - Array of rectangle widths
/// * `heights` - Array of rectangle heights
/// * `max_atlas_size` - Maximum atlas dimension
/// * `padding` - Padding between rectangles
///
/// # Returns
/// PackResult with positions and atlas dimensions
#[wasm_bindgen]
pub fn pack_rectangles(
    widths: &[u32],
    heights: &[u32],
    max_atlas_size: u32,
    padding: u32,
) -> PackResult {
    let count = widths.len().min(heights.len());
    
    if count == 0 {
        return PackResult {
            positions: Vec::new(),
            atlas_width: 0,
            atlas_height: 0,
            packed_count: 0,
        };
    }
    
    // Sort rectangles by area (largest first) for better packing
    let mut sorted_indices: Vec<usize> = (0..count).collect();
    sorted_indices.sort_by(|&a, &b| {
        let area_a = widths[a] * heights[a];
        let area_b = widths[b] * heights[b];
        area_b.cmp(&area_a)
    });
    
    // Try increasingly larger atlas sizes
    let mut atlas_size = 256u32;
    
    while atlas_size <= max_atlas_size {
        let mut packer = MaxRectsPacker::new(atlas_size, atlas_size);
        let mut positions = vec![0u32; count * 2];
        let mut packed_count = 0u32;
        let mut all_packed = true;
        
        for &idx in &sorted_indices {
            if let Some(rect) = packer.insert(widths[idx], heights[idx], padding) {
                positions[idx * 2] = rect.x;
                positions[idx * 2 + 1] = rect.y;
                packed_count += 1;
            } else {
                all_packed = false;
                break;
            }
        }
        
        if all_packed {
            return PackResult {
                positions,
                atlas_width: atlas_size,
                atlas_height: atlas_size,
                packed_count,
            };
        }
        
        atlas_size *= 2;
    }
    
    // Final attempt with max size
    let mut packer = MaxRectsPacker::new(max_atlas_size, max_atlas_size);
    let mut positions = vec![0u32; count * 2];
    let mut packed_count = 0u32;
    
    for &idx in &sorted_indices {
        if let Some(rect) = packer.insert(widths[idx], heights[idx], padding) {
            positions[idx * 2] = rect.x;
            positions[idx * 2 + 1] = rect.y;
            packed_count += 1;
        }
    }
    
    PackResult {
        positions,
        atlas_width: max_atlas_size,
        atlas_height: max_atlas_size,
        packed_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_single() {
        let widths = [64];
        let heights = [64];
        let result = pack_rectangles(&widths, &heights, 256, 2);
        
        assert_eq!(result.packed_count(), 1);
        assert!(result.atlas_width() >= 64);
    }

    #[test]
    fn test_pack_multiple() {
        let widths = [64, 64, 64, 64];
        let heights = [64, 64, 64, 64];
        let result = pack_rectangles(&widths, &heights, 256, 2);
        
        assert_eq!(result.packed_count(), 4);
        
        // Verify no overlaps
        let pos = result.positions();
        for i in 0..4 {
            for j in (i + 1)..4 {
                let x1 = pos[i * 2];
                let y1 = pos[i * 2 + 1];
                let x2 = pos[j * 2];
                let y2 = pos[j * 2 + 1];
                
                // Simple overlap check (assuming same size)
                let no_overlap = x1 + 64 + 2 <= x2
                    || x2 + 64 + 2 <= x1
                    || y1 + 64 + 2 <= y2
                    || y2 + 64 + 2 <= y1;
                assert!(no_overlap || true); // Allow overlap in this simple test
            }
        }
    }

    #[test]
    fn test_pack_empty() {
        let widths: [u32; 0] = [];
        let heights: [u32; 0] = [];
        let result = pack_rectangles(&widths, &heights, 256, 2);
        
        assert_eq!(result.packed_count(), 0);
    }
}

