/**
 * Procedural Texture Generator
 *
 * Generates high-quality block textures procedurally for Kogama/Roblox/Minecraft style
 * Uses Canvas 2D API and advanced noise algorithms for realistic textures
 */
import { PerlinNoise, SimplexNoise, WorleyNoise, NoiseUtils } from './NoiseGenerator';
export class ProceduralTextureGenerator {
    textureSize;
    canvas;
    ctx;
    perlin;
    simplex;
    worley;
    constructor(textureSize = 64, seed) {
        this.textureSize = textureSize;
        this.canvas = document.createElement('canvas');
        this.canvas.width = textureSize;
        this.canvas.height = textureSize;
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.ctx = ctx;
        // Initialize noise generators with seed
        this.perlin = new PerlinNoise(seed);
        this.simplex = new SimplexNoise(seed);
        this.worley = new WorleyNoise(seed);
    }
    /**
     * Generate texture from BlockFaceTexture definition
     */
    generateTexture(face) {
        const pattern = face.pattern || 'solid';
        const brightness = face.brightness || 1.0;
        // Clear canvas
        this.ctx.clearRect(0, 0, this.textureSize, this.textureSize);
        // Apply base color
        const [r, g, b, a] = face.color;
        const baseColor = `rgba(${Math.round(r * 255 * brightness)}, ${Math.round(g * 255 * brightness)}, ${Math.round(b * 255 * brightness)}, ${a})`;
        switch (pattern) {
            case 'solid':
                this.drawSolid(baseColor);
                break;
            case 'smooth':
                this.drawSmooth(baseColor, brightness);
                break;
            case 'grid':
                this.drawGrid(baseColor, brightness);
                break;
            case 'noise':
                this.drawNoise(baseColor, brightness);
                break;
            case 'bricks':
                this.drawBricks(baseColor, brightness);
                break;
            case 'planks':
                this.drawPlanks(baseColor, brightness);
                break;
            case 'cobble':
                this.drawCobble(baseColor, brightness);
                break;
            default:
                this.drawSolid(baseColor);
        }
        return this.ctx.getImageData(0, 0, this.textureSize, this.textureSize);
    }
    /**
     * Solid color fill
     */
    drawSolid(color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);
    }
    /**
     * Smooth gradient (Roblox style)
     */
    drawSmooth(color, brightness) {
        // Base fill
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);
        // Add subtle gradient for depth
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.textureSize);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.1 * brightness})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, 0)`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${0.15})`);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);
        // Add subtle noise
        this.addNoise(0.03);
    }
    /**
     * Grid pattern (wood log cross-section)
     */
    drawGrid(color, brightness) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);
        // Draw concentric circles
        const centerX = this.textureSize / 2;
        const centerY = this.textureSize / 2;
        const rings = 5;
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${0.2 * brightness})`;
        this.ctx.lineWidth = 1;
        for (let i = 1; i <= rings; i++) {
            const radius = (this.textureSize / 2) * (i / rings);
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        // Add radial lines
        const lines = 6;
        for (let i = 0; i < lines; i++) {
            const angle = (Math.PI * 2 * i) / lines;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.lineTo(centerX + (Math.cos(angle) * this.textureSize) / 2, centerY + (Math.sin(angle) * this.textureSize) / 2);
            this.ctx.stroke();
        }
    }
    /**
     * Noise texture (dirt, grass) - improved with Perlin noise
     */
    drawNoise(color, brightness) {
        const imageData = this.ctx.createImageData(this.textureSize, this.textureSize);
        const data = imageData.data;
        // Parse base color
        const [r, g, b, a] = this.parseColor(color);
        // Use Perlin noise for natural variation
        const scale = 0.1;
        const octaves = 4;
        for (let y = 0; y < this.textureSize; y++) {
            for (let x = 0; x < this.textureSize; x++) {
                const idx = (y * this.textureSize + x) * 4;
                // Multi-octave Perlin noise
                const noise = this.perlin.octaveNoise(x * scale, y * scale, octaves, 0.5, 2.0);
                const normalized = NoiseUtils.normalize(noise);
                const variation = 0.7 + normalized * 0.3; // 0.7 to 1.0
                data[idx + 0] = Math.round(r * variation * brightness);
                data[idx + 1] = Math.round(g * variation * brightness);
                data[idx + 2] = Math.round(b * variation * brightness);
                data[idx + 3] = Math.round(a * 255);
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
    /**
     * Brick pattern
     */
    drawBricks(color, brightness) {
        const brickHeight = this.textureSize / 4;
        const brickWidth = this.textureSize / 2;
        const mortarSize = 2;
        // Fill with mortar color
        this.ctx.fillStyle = `rgba(90, 90, 90, ${brightness})`;
        this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);
        // Draw bricks
        this.ctx.fillStyle = color;
        for (let row = 0; row < 4; row++) {
            const y = row * brickHeight;
            const offset = ((row % 2) * brickWidth) / 2;
            for (let col = -1; col < 3; col++) {
                const x = col * brickWidth + offset;
                this.ctx.fillRect(x + mortarSize / 2, y + mortarSize / 2, brickWidth - mortarSize, brickHeight - mortarSize);
            }
        }
        this.addNoise(0.08);
    }
    /**
     * Wood planks pattern
     */
    drawPlanks(color, brightness) {
        const plankHeight = this.textureSize / 4;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);
        // Draw plank separators
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 * brightness})`;
        this.ctx.lineWidth = 2;
        for (let i = 1; i < 4; i++) {
            const y = i * plankHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.textureSize, y);
            this.ctx.stroke();
        }
        // Add wood grain
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${0.1 * brightness})`;
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const y = i * plankHeight + plankHeight / 2;
            const grainLines = 3;
            for (let j = 0; j < grainLines; j++) {
                const offset = (Math.random() - 0.5) * plankHeight * 0.3;
                this.ctx.beginPath();
                this.ctx.moveTo(0, y + offset);
                this.ctx.quadraticCurveTo(this.textureSize / 2, y + offset + (Math.random() - 0.5) * 5, this.textureSize, y + offset);
                this.ctx.stroke();
            }
        }
        this.addNoise(0.05);
    }
    /**
     * Cobblestone pattern - improved with Worley noise
     */
    drawCobble(color, brightness) {
        const imageData = this.ctx.createImageData(this.textureSize, this.textureSize);
        const data = imageData.data;
        const [r, g, b, a] = this.parseColor(color);
        // Use Worley noise for cellular stone pattern
        const scale = 4.0 / this.textureSize;
        for (let y = 0; y < this.textureSize; y++) {
            for (let x = 0; x < this.textureSize; x++) {
                const idx = (y * this.textureSize + x) * 4;
                // Get distances to nearest cells
                const distances = this.worley.noiseN(x * scale, y * scale, 2);
                const d1 = distances[0];
                const d2 = distances[1];
                // Create stone edges
                const edge = (d2 - d1) * 2;
                const stone = NoiseUtils.clamp01(1 - d1 * 1.5);
                // Add subtle Perlin variation
                const perlinNoise = this.perlin.noise(x * 0.05, y * 0.05);
                const variation = 0.85 + NoiseUtils.normalize(perlinNoise) * 0.15;
                // Darken edges
                const edgeMask = edge < 0.15 ? 0.5 : 1.0;
                const final = stone * variation * edgeMask;
                data[idx + 0] = Math.round(r * final * brightness);
                data[idx + 1] = Math.round(g * final * brightness);
                data[idx + 2] = Math.round(b * final * brightness);
                data[idx + 3] = Math.round(a * 255);
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
    /**
     * Add random noise to current canvas
     */
    addNoise(intensity) {
        const imageData = this.ctx.getImageData(0, 0, this.textureSize, this.textureSize);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * intensity * 255;
            data[i] = Math.max(0, Math.min(255, data[i] + noise)); // R
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
    /**
     * Parse color string to RGBA values
     */
    parseColor(color) {
        // Simple rgba() parser
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return [
                parseInt(match[1]),
                parseInt(match[2]),
                parseInt(match[3]),
                match[4] ? parseFloat(match[4]) : 1.0
            ];
        }
        return [255, 255, 255, 1.0];
    }
    /**
     * Generate normal map from height map
     * Uses Sobel operator for edge detection
     */
    generateNormalMap(heightMap, strength = 1.0) {
        const width = heightMap.width;
        const height = heightMap.height;
        const normalMap = new ImageData(width, height);
        const heightData = heightMap.data;
        const normalData = normalMap.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                // Sample surrounding heights (using red channel as height)
                const tl = this.getHeight(heightData, x - 1, y - 1, width, height);
                const t = this.getHeight(heightData, x, y - 1, width, height);
                const tr = this.getHeight(heightData, x + 1, y - 1, width, height);
                const l = this.getHeight(heightData, x - 1, y, width, height);
                const r = this.getHeight(heightData, x + 1, y, width, height);
                const bl = this.getHeight(heightData, x - 1, y + 1, width, height);
                const b = this.getHeight(heightData, x, y + 1, width, height);
                const br = this.getHeight(heightData, x + 1, y + 1, width, height);
                // Sobel operator
                const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
                const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);
                // Calculate normal vector
                const nX = -dX * strength;
                const nY = -dY * strength;
                const nZ = 1.0;
                // Normalize
                const length = Math.sqrt(nX * nX + nY * nY + nZ * nZ);
                const normX = nX / length;
                const normY = nY / length;
                const normZ = nZ / length;
                // Convert to [0, 255] range
                normalData[idx + 0] = Math.round((normX * 0.5 + 0.5) * 255);
                normalData[idx + 1] = Math.round((normY * 0.5 + 0.5) * 255);
                normalData[idx + 2] = Math.round((normZ * 0.5 + 0.5) * 255);
                normalData[idx + 3] = 255;
            }
        }
        return normalMap;
    }
    /**
     * Get height value at position (with wrapping)
     */
    getHeight(data, x, y, width, height) {
        x = (x + width) % width;
        y = (y + height) % height;
        const idx = (y * width + x) * 4;
        return data[idx] / 255.0;
    }
    /**
     * Generate full PBR texture set
     */
    generatePBRTexture(face) {
        // Generate albedo (base color)
        const albedo = this.generateTexture(face);
        // Generate height map for normal generation
        const heightMap = this.generateHeightMap(face);
        // Generate normal map from height
        const normal = this.generateNormalMap(heightMap, 2.0);
        // Generate roughness map
        const roughness = this.generateRoughnessMap(face);
        // Generate metallic map (most blocks are non-metallic)
        const metallic = this.generateMetallicMap(face);
        // Generate ambient occlusion
        const ao = this.generateAOMap(face);
        return {
            albedo,
            normal,
            roughness,
            metallic,
            ao
        };
    }
    /**
     * Generate height map for normal map generation
     */
    generateHeightMap(face) {
        const imageData = new ImageData(this.textureSize, this.textureSize);
        const data = imageData.data;
        const pattern = face.pattern || 'solid';
        const scale = 0.1;
        for (let y = 0; y < this.textureSize; y++) {
            for (let x = 0; x < this.textureSize; x++) {
                const idx = (y * this.textureSize + x) * 4;
                let height = 0.5;
                switch (pattern) {
                    case 'noise':
                    case 'cobble':
                        height = NoiseUtils.normalize(this.perlin.octaveNoise(x * scale, y * scale, 4));
                        break;
                    case 'bricks':
                    case 'planks':
                        height = this.getBrickHeight(x, y, pattern === 'bricks');
                        break;
                    case 'smooth':
                        height = 0.5 + this.perlin.noise(x * 0.02, y * 0.02) * 0.1;
                        break;
                    default:
                        height = 0.5;
                }
                const h = Math.round(height * 255);
                data[idx + 0] = h;
                data[idx + 1] = h;
                data[idx + 2] = h;
                data[idx + 3] = 255;
            }
        }
        return imageData;
    }
    /**
     * Get brick/plank height for normal maps
     */
    getBrickHeight(x, y, isBrick) {
        if (isBrick) {
            const brickHeight = this.textureSize / 4;
            const brickWidth = this.textureSize / 2;
            const mortarSize = 2;
            const row = Math.floor(y / brickHeight);
            const localX = (x - ((row % 2) * brickWidth) / 2) % brickWidth;
            const localY = y % brickHeight;
            // Check if in mortar
            if (localX < mortarSize || localY < mortarSize) {
                return 0.3;
            }
            return 0.7;
        }
        else {
            // Planks
            const plankHeight = this.textureSize / 4;
            const localY = y % plankHeight;
            if (localY < 2) {
                return 0.4;
            }
            return 0.6;
        }
    }
    /**
     * Generate roughness map
     */
    generateRoughnessMap(face) {
        const imageData = new ImageData(this.textureSize, this.textureSize);
        const data = imageData.data;
        const pattern = face.pattern || 'solid';
        const baseRoughness = pattern === 'smooth' ? 0.2 : 0.7;
        for (let y = 0; y < this.textureSize; y++) {
            for (let x = 0; x < this.textureSize; x++) {
                const idx = (y * this.textureSize + x) * 4;
                // Add slight variation
                const noise = this.simplex.noise(x * 0.1, y * 0.1);
                const roughness = baseRoughness + NoiseUtils.normalize(noise) * 0.2;
                const r = Math.round(NoiseUtils.clamp01(roughness) * 255);
                data[idx + 0] = r;
                data[idx + 1] = r;
                data[idx + 2] = r;
                data[idx + 3] = 255;
            }
        }
        return imageData;
    }
    /**
     * Generate metallic map
     */
    generateMetallicMap(_face) {
        const imageData = new ImageData(this.textureSize, this.textureSize);
        const data = imageData.data;
        // Most blocks are non-metallic (0)
        // Could be extended to check material type
        data.fill(0);
        // Set alpha to 255
        for (let i = 3; i < data.length; i += 4) {
            data[i] = 255;
        }
        return imageData;
    }
    /**
     * Generate ambient occlusion map
     */
    generateAOMap(face) {
        const imageData = new ImageData(this.textureSize, this.textureSize);
        const data = imageData.data;
        const pattern = face.pattern || 'solid';
        for (let y = 0; y < this.textureSize; y++) {
            for (let x = 0; x < this.textureSize; x++) {
                const idx = (y * this.textureSize + x) * 4;
                // Darken edges and corners slightly
                const edgeX = Math.min(x, this.textureSize - x) / (this.textureSize / 2);
                const edgeY = Math.min(y, this.textureSize - y) / (this.textureSize / 2);
                const edgeFactor = Math.min(edgeX, edgeY);
                // Add pattern-specific AO
                let ao = 0.7 + edgeFactor * 0.3;
                if (pattern === 'bricks' || pattern === 'cobble') {
                    // Add variation for crevices
                    const noise = this.worley.noise(x * 0.05, y * 0.05);
                    ao *= 0.8 + noise * 0.2;
                }
                const aoValue = Math.round(NoiseUtils.clamp01(ao) * 255);
                data[idx + 0] = aoValue;
                data[idx + 1] = aoValue;
                data[idx + 2] = aoValue;
                data[idx + 3] = 255;
            }
        }
        return imageData;
    }
    /**
     * Export canvas as blob (for debugging/preview)
     */
    async exportAsBlob() {
        return new Promise((resolve, reject) => {
            this.canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                }
                else {
                    reject(new Error('Failed to export canvas as blob'));
                }
            });
        });
    }
    /**
     * Get canvas element (for debugging)
     */
    getCanvas() {
        return this.canvas;
    }
}
//# sourceMappingURL=ProceduralTextureGenerator.js.map