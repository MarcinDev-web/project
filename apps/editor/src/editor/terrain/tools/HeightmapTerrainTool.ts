/**
 * HeightmapTerrainTool - Tool for heightmap terrain creation and editing
 *
 * Provides heightmap generation, import/export, and basic editing operations.
 */

import type { Scene, Entity } from '@engine/world';
import { TerrainComponent } from '@engine/world/components/TerrainComponent';
import { HeightmapTerrain, type HeightmapTerrainConfig } from '@engine/voxel/terrain';
import { TerrainMeshGenerator } from '@engine/voxel/terrain';
import { MeshComponent } from '@engine/world/components/MeshComponent';
import { Logger } from '../../../utils/logger';

/**
 * HeightmapTerrainTool - Manages heightmap terrain operations
 */
export class HeightmapTerrainTool {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Creates a new heightmap terrain entity
   */
  createTerrain(config: HeightmapTerrainConfig): Entity {
    const terrain = new HeightmapTerrain(config);

    // Generate initial flat terrain
    const { resolution } = config;
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        terrain.setHeightAtGrid(x, z, config.minHeight ?? 0);
      }
    }

    // Create entity
    const entity = this.scene.createEntity('Terrain');

    // Add TerrainComponent
    const terrainComponent = entity.addComponent(new TerrainComponent());
    terrainComponent.terrainData = {
      type: 'heightmap',
      heightmap: terrain.exportData(),
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
      },
    };

    // Generate mesh and add MeshComponent
    this.updateTerrainMesh(entity, terrain);

    return entity;
  }

  /**
   * Updates terrain mesh from heightmap data
   */
  updateTerrainMesh(entity: Entity, terrain?: HeightmapTerrain): void {
    const terrainComp = entity.getComponent(TerrainComponent);
    if (!terrainComp || !terrainComp.terrainData.heightmap) {
      Logger.warn('[HeightmapTerrainTool] Entity does not have heightmap terrain data');
      return;
    }

    const heightmapData = terrainComp.terrainData.heightmap;

    // Use provided terrain or create from component data
    let heightmapTerrain = terrain;
    if (!heightmapTerrain) {
      const config: HeightmapTerrainConfig = {
        resolution: heightmapData.resolution,
        size: heightmapData.size,
      };
      if (heightmapData.minHeight !== undefined) {
        config.minHeight = heightmapData.minHeight;
      }
      if (heightmapData.maxHeight !== undefined) {
        config.maxHeight = heightmapData.maxHeight;
      }
      heightmapTerrain = new HeightmapTerrain(config);
      heightmapTerrain.importData(heightmapData);
    }

    // Generate mesh
    const meshData = TerrainMeshGenerator.generate(heightmapData, {
      generateNormals: true,
      generateUVs: true,
    });

    // Add or update MeshComponent
    let meshComponent = entity.getComponent(MeshComponent);
    if (!meshComponent) {
      meshComponent = entity.addComponent(new MeshComponent());
    }

    meshComponent.meshType = 'terrain';
    meshComponent.meshData = {
      vertices: meshData.vertices,
      indices: meshData.indices,
      // Note: normals and uvs could be added to CustomMeshData interface if needed
    };

    // Mark terrain as clean
    heightmapTerrain.markClean();
  }

  /**
   * Generates terrain from heightmap image
   */
  async generateFromImage(imageUrl: string, config: Partial<HeightmapTerrainConfig>): Promise<Entity> {
    // Load image
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Create canvas to read pixel data
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Use image dimensions or config resolution (whichever is valid power of 2 + 1)
    const imageResolution = Math.min(image.width, image.height);
    const isValidResolution = (n: number): boolean => {
      return n > 1 && ((n - 1) & ((n - 1) - 1)) === 0;
    };

    let resolution = config.resolution ?? imageResolution;
    if (!isValidResolution(resolution)) {
      // Find nearest valid resolution
      resolution = Math.pow(2, Math.floor(Math.log2(resolution))) + 1;
    }

    const size = config.size ?? 100;

    // Create terrain
    const terrainConfig: HeightmapTerrainConfig = {
      resolution,
      size,
      minHeight: config.minHeight ?? 0,
      maxHeight: config.maxHeight ?? 100,
    };

    const terrain = new HeightmapTerrain(terrainConfig);

    // Sample image data and set heights
    const scaleX = image.width / resolution;
    const scaleY = image.height / resolution;
    const { minHeight = 0, maxHeight = 100 } = terrainConfig;
    const heightRange = maxHeight - minHeight;

    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const imgX = Math.floor(x * scaleX);
        const imgY = Math.floor(z * scaleY);
        const pixelIndex = (imgY * image.width + imgX) * 4;

        // Use red channel as height (or average of RGB)
        const r = imageData.data[pixelIndex]!;
        const g = imageData.data[pixelIndex + 1]!;
        const b = imageData.data[pixelIndex + 2]!;
        const gray = (r + g + b) / 3;

        // Normalize to height range
        const normalized = gray / 255;
        const height = minHeight + normalized * heightRange;

        terrain.setHeightAtGrid(x, z, height);
      }
    }

    // Create entity with terrain
    const entity = this.scene.createEntity('Terrain');
    const terrainComponent = entity.addComponent(new TerrainComponent());
    terrainComponent.terrainData = {
      type: 'heightmap',
      heightmap: terrain.exportData(),
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
      },
    };

    this.updateTerrainMesh(entity, terrain);

    return entity;
  }

  /**
   * Exports heightmap as image (PNG)
   */
  async exportToImage(entity: Entity): Promise<string> {
    const terrainComp = entity.getComponent(TerrainComponent);
    if (!terrainComp || !terrainComp.terrainData.heightmap) {
      throw new Error('Entity does not have heightmap terrain data');
    }

    const { resolution, heights, minHeight = 0, maxHeight = 100 } = terrainComp.terrainData.heightmap;
    const heightRange = maxHeight - minHeight;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Create image data
    const imageData = ctx.createImageData(resolution, resolution);

    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const height = heights[z * resolution + x]!;
        const normalized = heightRange > 0 ? (height - minHeight) / heightRange : 0;
        const gray = Math.floor(normalized * 255);

        const pixelIndex = (z * resolution + x) * 4;
        imageData.data[pixelIndex] = gray; // R
        imageData.data[pixelIndex + 1] = gray; // G
        imageData.data[pixelIndex + 2] = gray; // B
        imageData.data[pixelIndex + 3] = 255; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert to data URL
    return canvas.toDataURL('image/png');
  }

  /**
   * Applies noise to terrain
   */
  applyNoise(entity: Entity, scale: number, amplitude: number): void {
    const terrainComp = entity.getComponent(TerrainComponent);
    if (!terrainComp || !terrainComp.terrainData.heightmap) {
      return;
    }

    const config: HeightmapTerrainConfig = {
      resolution: terrainComp.terrainData.heightmap.resolution,
      size: terrainComp.terrainData.heightmap.size,
    };
    if (terrainComp.terrainData.heightmap.minHeight !== undefined) {
      config.minHeight = terrainComp.terrainData.heightmap.minHeight;
    }
    if (terrainComp.terrainData.heightmap.maxHeight !== undefined) {
      config.maxHeight = terrainComp.terrainData.heightmap.maxHeight;
    }
    const terrain = new HeightmapTerrain(config);
    terrain.importData(terrainComp.terrainData.heightmap);
    terrain.generateNoise(scale, amplitude);

    // Update component
    terrainComp.terrainData.heightmap = terrain.exportData();
    this.updateTerrainMesh(entity, terrain);
  }

  /**
   * Applies smooth to terrain
   */
  applySmooth(entity: Entity, iterations: number): void {
    const terrainComp = entity.getComponent(TerrainComponent);
    if (!terrainComp || !terrainComp.terrainData.heightmap) {
      return;
    }

    const config: HeightmapTerrainConfig = {
      resolution: terrainComp.terrainData.heightmap.resolution,
      size: terrainComp.terrainData.heightmap.size,
    };
    if (terrainComp.terrainData.heightmap.minHeight !== undefined) {
      config.minHeight = terrainComp.terrainData.heightmap.minHeight;
    }
    if (terrainComp.terrainData.heightmap.maxHeight !== undefined) {
      config.maxHeight = terrainComp.terrainData.heightmap.maxHeight;
    }
    const terrain = new HeightmapTerrain(config);
    terrain.importData(terrainComp.terrainData.heightmap);
    terrain.smooth(iterations);

    // Update component
    terrainComp.terrainData.heightmap = terrain.exportData();
    this.updateTerrainMesh(entity, terrain);
  }

  /**
   * Disposes the tool
   */
  dispose(): void {
    // No cleanup needed
  }
}

