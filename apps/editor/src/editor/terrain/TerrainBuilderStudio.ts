/**
 * TerrainBuilderStudio - Main orchestrator for terrain editing
 *
 * Coordinates all terrain tools, controllers, and UI.
 */

import type { Scene } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import type { EditorState } from '../core/state';
import { TerrainBuilderController } from './controllers/TerrainBuilderController';
import type { HeightmapTerrainConfig } from '@engine/voxel/terrain';
import type { Entity } from '@engine/world';
// HTMLCanvasElement is available in DOM types

export interface TerrainBuilderStudioConfig {
  canvas: HTMLCanvasElement;
  scene: Scene;
  controls: OrbitControls;
  state: EditorState;
  onStatusMessage?: (message: string, duration?: number) => void;
  onTerrainChanged?: (entity: Entity) => void;
}

/**
 * TerrainBuilderStudio - Main terrain editing orchestrator
 */
export class TerrainBuilderStudio {
  private config: TerrainBuilderStudioConfig;
  private controller: TerrainBuilderController;
  private cleanup: (() => void) | null = null;
  private activeMode: 'heightmap' | 'sculpt' | null = null;

  constructor(config: TerrainBuilderStudioConfig) {
    this.config = config;
    this.controller = new TerrainBuilderController({
      ...config,
      onTerrainChanged: (entity) => {
        config.onTerrainChanged?.(entity);
      },
    });
  }

  /**
   * Initializes the terrain builder studio
   */
  initialize(): void {
    this.cleanup = this.controller.initialize();
  }

  /**
   * Creates a new heightmap terrain
   */
  createHeightmapTerrain(config: HeightmapTerrainConfig): Entity {
    const heightmapTool = this.controller.getHeightmapTool();
    const entity = heightmapTool.createTerrain(config);
    this.config.onStatusMessage?.('Heightmap terrain created', 2000);
    return entity;
  }

  /**
   * Generates terrain from image
   */
  async generateFromImage(imageUrl: string, config: Partial<HeightmapTerrainConfig>): Promise<Entity> {
    const heightmapTool = this.controller.getHeightmapTool();
    const entity = await heightmapTool.generateFromImage(imageUrl, config);
    this.config.onStatusMessage?.('Terrain generated from image', 2000);
    return entity;
  }

  /**
   * Activates sculpting mode
   */
  activateSculptMode(entity?: Entity): void {
    this.activeMode = 'sculpt';
    this.controller.activate(entity);
  }

  /**
   * Deactivates sculpting mode
   */
  deactivateSculptMode(): void {
    this.activeMode = null;
    this.controller.deactivate();
  }

  /**
   * Checks if sculpting mode is active
   */
  isSculptModeActive(): boolean {
    return this.activeMode === 'sculpt';
  }

  /**
   * Sets brush operation
   */
  setBrushOperation(operation: 'raise' | 'lower' | 'smooth' | 'flatten' | 'pinch'): void {
    this.controller.setOperation(operation);
  }

  /**
   * Updates brush configuration
   */
  updateBrushConfig(config: {
    size?: number;
    intensity?: number;
    falloff?: 'linear' | 'smooth' | 'spherical';
  }): void {
    this.controller.updateBrushConfig(config);
  }

  /**
   * Gets the controller (for advanced operations)
   */
  getController(): TerrainBuilderController {
    return this.controller;
  }

  /**
   * Exports terrain as image
   */
  async exportToImage(entity: Entity): Promise<string> {
    const heightmapTool = this.controller.getHeightmapTool();
    return await heightmapTool.exportToImage(entity);
  }

  /**
   * Applies noise to terrain
   */
  applyNoise(entity: Entity, scale: number, amplitude: number): void {
    const heightmapTool = this.controller.getHeightmapTool();
    heightmapTool.applyNoise(entity, scale, amplitude);
    this.config.onTerrainChanged?.(entity);
  }

  /**
   * Applies smooth to terrain
   */
  applySmooth(entity: Entity, iterations: number): void {
    const heightmapTool = this.controller.getHeightmapTool();
    heightmapTool.applySmooth(entity, iterations);
    this.config.onTerrainChanged?.(entity);
  }

  /**
   * Disposes the studio
   */
  dispose(): void {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
    this.controller.dispose();
    this.activeMode = null;
  }
}

