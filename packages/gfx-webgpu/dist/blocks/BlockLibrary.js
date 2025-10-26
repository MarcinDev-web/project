/**
 * Block Library - Kogama/Roblox/Minecraft style blocks
 *
 * Design principles:
 * - Simple, colorful aesthetic (Kogama/Roblox)
 * - Block-based voxel style (Minecraft)
 * - Support for both procedural and real textures
 * - Material-based rendering
 */
/**
 * Built-in block library with Kogama/Roblox/Minecraft inspired blocks
 * Reduced to 10 essential blocks across 3 categories
 */
export const BLOCK_LIBRARY = {
    // ===== BASIC BLOCKS (5) - Colorful building blocks =====
    plastic_red: {
        id: 'plastic_red',
        name: 'Red Block',
        category: 'basic',
        material: 'plastic',
        textures: {
            top: { color: [0.9, 0.15, 0.15, 1], pattern: 'smooth', brightness: 1.1 },
            bottom: { color: [0.9, 0.15, 0.15, 1], pattern: 'smooth', brightness: 0.7 },
            sides: { color: [0.9, 0.15, 0.15, 1], pattern: 'smooth', brightness: 0.9 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 0,
            roughness: 0.3,
            metallic: 0,
        },
    },
    plastic_blue: {
        id: 'plastic_blue',
        name: 'Blue Block',
        category: 'basic',
        material: 'plastic',
        textures: {
            top: { color: [0.15, 0.45, 0.95, 1], pattern: 'smooth', brightness: 1.1 },
            bottom: { color: [0.15, 0.45, 0.95, 1], pattern: 'smooth', brightness: 0.7 },
            sides: { color: [0.15, 0.45, 0.95, 1], pattern: 'smooth', brightness: 0.9 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 0,
            roughness: 0.3,
            metallic: 0,
        },
    },
    plastic_green: {
        id: 'plastic_green',
        name: 'Green Block',
        category: 'basic',
        material: 'plastic',
        textures: {
            top: { color: [0.15, 0.85, 0.25, 1], pattern: 'smooth', brightness: 1.1 },
            bottom: { color: [0.15, 0.85, 0.25, 1], pattern: 'smooth', brightness: 0.7 },
            sides: { color: [0.15, 0.85, 0.25, 1], pattern: 'smooth', brightness: 0.9 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 0,
            roughness: 0.3,
            metallic: 0,
        },
    },
    plastic_yellow: {
        id: 'plastic_yellow',
        name: 'Yellow Block',
        category: 'basic',
        material: 'plastic',
        textures: {
            top: { color: [0.95, 0.85, 0.15, 1], pattern: 'smooth', brightness: 1.1 },
            bottom: { color: [0.95, 0.85, 0.15, 1], pattern: 'smooth', brightness: 0.7 },
            sides: { color: [0.95, 0.85, 0.15, 1], pattern: 'smooth', brightness: 0.9 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 0,
            roughness: 0.3,
            metallic: 0,
        },
    },
    concrete_white: {
        id: 'concrete_white',
        name: 'White Concrete',
        category: 'basic',
        material: 'stone',
        textures: {
            top: { color: [0.9, 0.9, 0.9, 1], pattern: 'smooth', brightness: 1.0 },
            bottom: { color: [0.9, 0.9, 0.9, 1], pattern: 'smooth', brightness: 0.8 },
            sides: { color: [0.9, 0.9, 0.9, 1], pattern: 'smooth', brightness: 0.9 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 0,
            roughness: 0.4,
            metallic: 0,
        },
    },
    // ===== NATURAL BLOCKS (3) - Terrain blocks =====
    grass: {
        id: 'grass',
        name: 'Grass Block',
        category: 'natural',
        material: 'stone',
        textures: {
            top: { color: [0.35, 0.7, 0.25, 1], pattern: 'noise', brightness: 1.0 },
            bottom: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.8 },
            sides: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.9 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 0,
            roughness: 0.9,
            metallic: 0,
        },
    },
    dirt: {
        id: 'dirt',
        name: 'Dirt Block',
        category: 'natural',
        material: 'stone',
        textures: {
            top: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 1.0 },
            bottom: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.8 },
            sides: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.9 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 0,
            roughness: 0.95,
            metallic: 0,
        },
    },
    stone: {
        id: 'stone',
        name: 'Stone Block',
        category: 'natural',
        material: 'stone',
        textures: {
            top: { color: [0.5, 0.5, 0.5, 1], pattern: 'cobble', brightness: 1.0 },
            bottom: { color: [0.5, 0.5, 0.5, 1], pattern: 'cobble', brightness: 0.8 },
            sides: { color: [0.5, 0.5, 0.5, 1], pattern: 'cobble', brightness: 0.9 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 0,
            roughness: 0.85,
            metallic: 0,
        },
    },
    // ===== GAMEPLAY BLOCKS (2) - Interactive/special blocks =====
    light_white: {
        id: 'light_white',
        name: 'White Light',
        category: 'gameplay',
        material: 'emissive',
        textures: {
            top: { color: [1.0, 1.0, 1.0, 1], pattern: 'smooth', brightness: 2.0 },
            bottom: { color: [1.0, 1.0, 1.0, 1], pattern: 'smooth', brightness: 2.0 },
            sides: { color: [1.0, 1.0, 1.0, 1], pattern: 'smooth', brightness: 2.0 },
        },
        properties: {
            solid: true,
            transparent: false,
            emissive: 1.0,
            roughness: 0.5,
            metallic: 0,
        },
    },
    glass_clear: {
        id: 'glass_clear',
        name: 'Clear Glass',
        category: 'gameplay',
        material: 'glass',
        textures: {
            top: { color: [0.85, 0.95, 1.0, 0.3], pattern: 'smooth', brightness: 1.2 },
            bottom: { color: [0.85, 0.95, 1.0, 0.3], pattern: 'smooth', brightness: 1.0 },
            sides: { color: [0.85, 0.95, 1.0, 0.3], pattern: 'smooth', brightness: 1.1 },
        },
        properties: {
            solid: true,
            transparent: true,
            emissive: 0,
            roughness: 0.1,
            metallic: 0.2,
        },
        ctm: {
            pattern: 'cross',
            matchSameType: true,
            matchCategory: false,
        },
    },
};
/**
 * Get all blocks in a category
 */
export function getBlocksByCategory(category) {
    return Object.values(BLOCK_LIBRARY).filter((block) => block.category === category);
}
/**
 * Get block by ID
 */
export function getBlock(id) {
    return BLOCK_LIBRARY[id];
}
/**
 * Get all block categories
 */
export function getAllCategories() {
    return ['basic', 'natural', 'gameplay'];
}
//# sourceMappingURL=BlockLibrary.js.map