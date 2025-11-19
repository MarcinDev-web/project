import { Component } from './Component.js';
import { registerComponent } from './registry.js';

/**
 * Terrain data type
 */
export type TerrainType = 'heightmap' | 'voxel' | 'hybrid';

/**
 * Heightmap terrain data
 */
export interface HeightmapTerrainData {
  resolution: number; // vertices per side
  size: number; // world size in units
  heights: Float32Array;
  minHeight?: number;
  maxHeight?: number;
}

/**
 * Serialized Heightmap terrain data
 */
export interface SerializedHeightmapData {
  resolution: number;
  size: number;
  heights: number[];
  minHeight?: number;
  maxHeight?: number;
}

/**
 * Voxel terrain data (chunks)
 */
export interface VoxelTerrainData {
  chunkSize: number; // voxels per chunk side (typically 16)
  chunks: Map<string, Uint8Array>; // chunk key -> voxel data
}

/**
 * Serialized Voxel terrain data
 */
export interface SerializedVoxelTerrainData {
  chunkSize: number;
  chunks: Array<[string, number[]]>;
}

/**
 * Texture layer for terrain splatting
 */
export interface TextureLayer {
  textureId: string;
  scale: number;
  blendFactor?: Float32Array; // per-vertex blend factor
}

/**
 * Serialized Texture layer
 */
export interface SerializedTextureLayer {
  textureId: string;
  scale: number;
  blendFactor?: number[];
}

/**
 * Terrain component data
 */
export interface TerrainData {
  type: TerrainType;
  heightmap?: HeightmapTerrainData;
  voxels?: VoxelTerrainData;
  textureLayers?: TextureLayer[];
  metadata?: {
    version: string;
    createdAt: number;
  };
}

/**
 * Serialized Terrain component data
 */
export interface SerializedTerrainData {
  type: TerrainType;
  heightmap?: SerializedHeightmapData;
  voxels?: SerializedVoxelTerrainData;
  textureLayers?: SerializedTextureLayer[];
  metadata?: {
    version: string;
    createdAt: number;
  };
}

/**
 * TerrainComponent - Stores terrain data (heightmap, voxels, or hybrid)
 */
export class TerrainComponent extends Component {
  static readonly type = 'Terrain';

  terrainData: TerrainData;

  constructor(terrainData?: TerrainData) {
    super();
    this.terrainData = terrainData ?? {
      type: 'heightmap',
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
      },
    };
  }

  getType(): string {
    return TerrainComponent.type;
  }

  clone(): TerrainComponent {
    const clone = new TerrainComponent();

    // Deep clone heightmap data
    if (this.terrainData.heightmap) {
      const heightmap: HeightmapTerrainData = {
        resolution: this.terrainData.heightmap.resolution,
        size: this.terrainData.heightmap.size,
        heights: new Float32Array(this.terrainData.heightmap.heights),
      };
      if (this.terrainData.heightmap.minHeight !== undefined) {
        heightmap.minHeight = this.terrainData.heightmap.minHeight;
      }
      if (this.terrainData.heightmap.maxHeight !== undefined) {
        heightmap.maxHeight = this.terrainData.heightmap.maxHeight;
      }
      clone.terrainData.heightmap = heightmap;
    }

    // Deep clone voxel data
    if (this.terrainData.voxels) {
      const chunks = new Map<string, Uint8Array>();
      for (const [key, data] of this.terrainData.voxels.chunks) {
        chunks.set(key, new Uint8Array(data));
      }
      clone.terrainData.voxels = {
        chunkSize: this.terrainData.voxels.chunkSize,
        chunks,
      };
    }

    // Shallow clone texture layers
    if (this.terrainData.textureLayers) {
      clone.terrainData.textureLayers = this.terrainData.textureLayers.map((layer) => {
        const clonedLayer: TextureLayer = {
          textureId: layer.textureId,
          scale: layer.scale,
        };
        if (layer.blendFactor) {
          clonedLayer.blendFactor = new Float32Array(layer.blendFactor);
        }
        return clonedLayer;
      });
    }

    clone.terrainData.type = this.terrainData.type;
    if (this.terrainData.metadata) {
      clone.terrainData.metadata = {
        version: this.terrainData.metadata.version,
        createdAt: Date.now(),
      };
    }

    return clone;
  }

  toJSON(): SerializedTerrainData {
    const json: SerializedTerrainData = {
      type: this.terrainData.type,
      ...(this.terrainData.metadata ? { metadata: { ...this.terrainData.metadata } } : {}),
    };

    if (this.terrainData.heightmap) {
      json.heightmap = {
        ...this.terrainData.heightmap,
        heights: Array.from(this.terrainData.heightmap.heights),
      };
    }

    if (this.terrainData.voxels) {
      const chunks: Array<[string, number[]]> = [];
      for (const [key, data] of this.terrainData.voxels.chunks) {
        chunks.push([key, Array.from(data)]);
      }
      json.voxels = {
        chunkSize: this.terrainData.voxels.chunkSize,
        chunks,
      };
    }

    if (this.terrainData.textureLayers) {
      json.textureLayers = this.terrainData.textureLayers.map((layer) => {
        const serializedLayer: SerializedTextureLayer = {
          textureId: layer.textureId,
          scale: layer.scale,
        };
        if (layer.blendFactor) {
          serializedLayer.blendFactor = Array.from(layer.blendFactor);
        }
        return serializedLayer;
      });
    }

    return json;
  }

  fromJSON(data: Partial<SerializedTerrainData>): void {
    if (data.type) {
      this.terrainData.type = data.type;
    }

    if (data.heightmap) {
      // Validation
      const expectedLength = data.heightmap.resolution * data.heightmap.resolution;
      if (data.heightmap.heights.length !== expectedLength) {
        throw new Error(
          `Invalid heightmap data: expected ${expectedLength} heights for resolution ${data.heightmap.resolution}, got ${data.heightmap.heights.length}`
        );
      }

      this.terrainData.heightmap = {
        ...data.heightmap,
        heights: new Float32Array(data.heightmap.heights),
      };
    }

    if (data.voxels) {
      const chunks = new Map<string, Uint8Array>();
      for (const [key, dataArray] of data.voxels.chunks) {
        chunks.set(key, new Uint8Array(dataArray));
      }
      this.terrainData.voxels = {
        chunkSize: data.voxels.chunkSize,
        chunks,
      };
    }

    if (data.textureLayers) {
      this.terrainData.textureLayers = data.textureLayers.map((layer) => {
        const deserializedLayer: TextureLayer = {
          textureId: layer.textureId,
          scale: layer.scale,
        };
        if (layer.blendFactor) {
          deserializedLayer.blendFactor = new Float32Array(layer.blendFactor);
        }
        return deserializedLayer;
      });
    }

    if (data.metadata) {
      this.terrainData.metadata = data.metadata;
    }
  }
}

registerComponent(TerrainComponent.type, TerrainComponent);
