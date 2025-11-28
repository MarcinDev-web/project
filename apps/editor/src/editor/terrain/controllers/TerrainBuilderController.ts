/**
 * TerrainBuilderController - Controller for terrain editing tools
 *
 * Handles input (mouse, keyboard) and coordinates terrain editing operations.
 */

import type { Scene } from '@engine/world';
import type { OrbitControls, CameraDirector } from '@engine/camera';
import type { EditorState } from '../../core/state';
import type { Entity } from '@engine/world';
import { TerrainComponent } from '@engine/world/components/TerrainComponent';
import { CameraComponent } from '@engine/world/components/CameraComponent';
import { Raycaster, type RaycastHit } from '@engine/world';
import { TerrainSculptTool, type SculptOperationConfig } from '../tools/TerrainSculptTool';
import { HeightmapTerrainTool } from '../tools/HeightmapTerrainTool';
import type { BrushOperation } from '../tools/TerrainBrush';
import type { Vec3, Mat4 } from '@engine/core/math';
import { Logger } from '../../../utils/logger';

export interface TerrainBuilderControllerConfig {
  canvas: HTMLCanvasElement;
  scene: Scene;
  controls: OrbitControls;
  cameraDirector?: CameraDirector;
  state: EditorState;
  onStatusMessage?: (message: string, duration?: number) => void;
  onTerrainChanged?: (entity: Entity) => void;
}

/**
 * TerrainBuilderController - Manages terrain editing interactions
 */
export class TerrainBuilderController {
  private config: TerrainBuilderControllerConfig;
  private sculptTool: TerrainSculptTool;
  private heightmapTool: HeightmapTerrainTool;
  private raycaster: Raycaster;
  private abortController: AbortController | null = null;
  private isActive = false;
  private currentOperation: BrushOperation = 'raise';
  private isSculpting = false;
  private cachedTerrainEntity: Entity | null = null;
  private terrainEntityCacheDirty = true;
  private readonly scratchViewMatrix: Mat4 = new Float32Array(16) as Mat4;
  private readonly scratchProjectionMatrix: Mat4 = new Float32Array(16) as Mat4;

  constructor(config: TerrainBuilderControllerConfig) {
    this.config = config;
    this.heightmapTool = new HeightmapTerrainTool(config.scene);
    this.sculptTool = new TerrainSculptTool(undefined, this.heightmapTool);
    this.raycaster = new Raycaster();
    
    // Invalidate cache when scene changes
    if (config.scene) {
      // Note: Scene doesn't have direct event for entity changes,
      // so we'll invalidate cache on each raycast if needed
    }
  }

  /**
   * Initializes the controller
   */
  initialize(): () => void {
    this.abortController = new AbortController();
    this.setupInputHandlers();

    return () => {
      this.dispose();
    };
  }

  /**
   * Activates terrain editing mode
   */
  activate(entity?: Entity): void {
    if (entity) {
      if (!entity.hasComponent(TerrainComponent)) {
        Logger.warn('[TerrainBuilderController] Entity does not have TerrainComponent');
        this.config.onStatusMessage?.('Invalid terrain entity', 2000);
        this.isActive = false;
        return;
      }
      this.sculptTool.setTerrainEntity(entity);
      this.sculptTool.activate();
      this.cachedTerrainEntity = entity;
      this.terrainEntityCacheDirty = false;
    } else {
      // Try to find terrain entity
      const terrainEntity = this.getTerrainEntity();
      if (terrainEntity) {
        this.sculptTool.setTerrainEntity(terrainEntity);
        this.sculptTool.activate();
      } else {
        Logger.warn('[TerrainBuilderController] No terrain entity found in scene');
        this.config.onStatusMessage?.('No terrain found in scene', 2000);
        this.isActive = false;
        return;
      }
    }

    this.isActive = true;
    this.config.onStatusMessage?.('Terrain editing mode active', 2000);
  }

  /**
   * Deactivates terrain editing mode
   */
  deactivate(): void {
    this.isActive = false;
    this.isSculpting = false;
    this.sculptTool.deactivate();
    this.terrainEntityCacheDirty = true; // Invalidate cache on deactivate
    this.config.onStatusMessage?.('Terrain editing mode deactivated', 2000);
  }

  /**
   * Checks if terrain editing is active
   */
  isEditingActive(): boolean {
    return this.isActive;
  }

  /**
   * Sets the current brush operation
   */
  setOperation(operation: BrushOperation): void {
    this.currentOperation = operation;
    this.config.onStatusMessage?.(`Brush operation: ${operation}`, 1500);
  }

  /**
   * Updates brush configuration
   */
  updateBrushConfig(config: Partial<import('../tools/TerrainBrush').BrushConfig>): void {
    this.sculptTool.updateBrushConfig(config);
  }

  /**
   * Sets up input handlers
   */
  private setupInputHandlers(): void {
    if (!this.abortController) return;

    // Mouse down - start sculpting
    this.config.canvas.addEventListener(
      'mousedown',
      (event: MouseEvent) => {
        if (!this.isActive || event.button !== 0) return; // Only left mouse button

        const hit = this.raycastToTerrain(event);
        if (hit) {
          this.isSculpting = true;
          this.performSculptOperation(hit.position, event.shiftKey);
        }
      },
      { signal: this.abortController.signal }
    );

    // Mouse move - continue sculpting while dragging
    this.config.canvas.addEventListener(
      'mousemove',
      (event: MouseEvent) => {
        if (!this.isActive || !this.isSculpting) return;

        const hit = this.raycastToTerrain(event);
        if (hit) {
          this.performSculptOperation(hit.position, event.shiftKey);
        }
      },
      { signal: this.abortController.signal }
    );

    // Mouse up - stop sculpting
    this.config.canvas.addEventListener(
      'mouseup',
      () => {
        if (this.isSculpting) {
          this.isSculpting = false;
          this.sculptTool.commitChanges();
          // Notify that terrain changed
          const terrainEntity = this.getTerrainEntity();
          if (terrainEntity && this.config.onTerrainChanged) {
            this.config.onTerrainChanged(terrainEntity);
          }
        }
      },
      { signal: this.abortController.signal }
    );

    // Keyboard shortcuts
    window.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (!this.isActive) return;

        // Operation shortcuts
        if (event.key === 'r' || event.key === 'R') {
          this.setOperation('raise');
        } else if (event.key === 'l' || event.key === 'L') {
          this.setOperation('lower');
        } else if (event.key === 's' || event.key === 'S') {
          this.setOperation('smooth');
        } else if (event.key === 'f' || event.key === 'F') {
          this.setOperation('flatten');
        } else if (event.key === 'p' || event.key === 'P') {
          this.setOperation('pinch');
        } else if (event.key === 'Escape') {
          this.deactivate();
        }
      },
      { signal: this.abortController.signal }
    );
  }

  /**
   * Performs sculpting operation at position
   */
  private performSculptOperation(position: Vec3, invert: boolean): void {
    const strength = 1.0;

    let operation: BrushOperation = this.currentOperation;
    if (invert) {
      // Invert operation (shift key)
      if (operation === 'raise') operation = 'lower';
      else if (operation === 'lower') operation = 'raise';
    }

    const config: SculptOperationConfig = {
      operation,
      strength,
    };

    // For flatten, use current height at position as target
    if (operation === 'flatten') {
      const terrain = this.sculptTool.getHeightmapTerrain();
      if (terrain) {
        config.targetHeight = terrain.getHeightAt(position[0], position[2]);
      }
    }

    this.sculptTool.sculptAt(position, config);
  }

  /**
   * Raycasts to terrain surface using proper raycasting system
   */
  private raycastToTerrain(event: MouseEvent): { position: Vec3; entity: Entity } | null {
    const canvas = this.config.canvas;
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    // Validate canvas dimensions
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      Logger.warn('[TerrainBuilderController] Invalid canvas dimensions');
      return null;
    }

    // Get primary camera from scene
    const primaryCamera = this.config.scene.primaryCamera;
    if (!primaryCamera) {
      Logger.warn('[TerrainBuilderController] No primary camera found');
      return null;
    }

    const cameraComponent = primaryCamera.getComponent(CameraComponent);
    if (!cameraComponent) {
      Logger.warn('[TerrainBuilderController] Primary camera has no CameraComponent');
      return null;
    }

    // Get camera matrices
    const aspect = canvasWidth / canvasHeight;
    const viewMatrix = cameraComponent.getViewMatrix(primaryCamera, this.scratchViewMatrix);
    const projectionMatrix = cameraComponent.getProjectionMatrix(this.scratchProjectionMatrix, aspect);

    // Create ray from screen coordinates
    const ray = this.raycaster.createRayFromScreen(
      canvasX,
      canvasY,
      canvasWidth,
      canvasHeight,
      viewMatrix,
      projectionMatrix
    );

    try {
      // Get terrain entities (use cached if available and valid)
      const terrainEntities = this.getTerrainEntities();
      if (terrainEntities.length === 0) {
        this.raycaster.recycleRay(ray);
        return null;
      }

      // Raycast to find closest terrain hit
      const hit = this.raycaster.raycastClosest(ray, terrainEntities);
      this.raycaster.recycleRay(ray);

      if (!hit) {
        return null;
      }

      // Get actual terrain height at hit point
      const terrain = this.sculptTool.getHeightmapTerrain();
      if (terrain) {
        const height = terrain.getHeightAt(hit.point[0], hit.point[2]);
        const position: Vec3 = [hit.point[0], height, hit.point[2]];
        return { position, entity: hit.entity };
      }

      // Fallback: use hit point directly
      return { position: hit.point as Vec3, entity: hit.entity };
    } catch (error) {
      this.raycaster.recycleRay(ray);
      Logger.error('[TerrainBuilderController] Raycast error:', error);
      return null;
    }
  }

  /**
   * Gets the current terrain entity (with caching)
   * Searches through all entities in the scene to find one with TerrainComponent
   */
  private getTerrainEntity(): Entity | null {
    // Return cached entity if available and valid
    if (!this.terrainEntityCacheDirty && this.cachedTerrainEntity) {
      if (this.cachedTerrainEntity.hasComponent(TerrainComponent)) {
        return this.cachedTerrainEntity;
      }
      // Cache is stale, invalidate it
      this.terrainEntityCacheDirty = true;
    }

    const rootEntities = this.config.scene.rootEntities;
    
    // First, check root entities
    for (const entity of rootEntities) {
      if (entity.hasComponent(TerrainComponent)) {
        this.cachedTerrainEntity = entity;
        this.terrainEntityCacheDirty = false;
        return entity;
      }
    }
    
    // If not found in root entities, search recursively through children
    for (const rootEntity of rootEntities) {
      let foundEntity: Entity | null = null;
      
      rootEntity.traverse((entity) => {
        if (entity.hasComponent(TerrainComponent)) {
          foundEntity = entity;
          return false; // Stop traversal once found
        }
      });
      
      if (foundEntity) {
        this.cachedTerrainEntity = foundEntity;
        this.terrainEntityCacheDirty = false;
        return foundEntity;
      }
    }
    
    this.cachedTerrainEntity = null;
    return null;
  }

  /**
   * Gets all terrain entities in the scene
   */
  private getTerrainEntities(): Entity[] {
    const terrainEntities: Entity[] = [];
    const rootEntities = this.config.scene.rootEntities;
    
    // Check root entities
    for (const entity of rootEntities) {
      if (entity.hasComponent(TerrainComponent)) {
        terrainEntities.push(entity);
      }
    }
    
    // Search recursively through children
    for (const rootEntity of rootEntities) {
      rootEntity.traverse((entity) => {
        if (entity.hasComponent(TerrainComponent)) {
          terrainEntities.push(entity);
        }
      });
    }
    
    return terrainEntities;
  }

  /**
   * Invalidates the terrain entity cache
   * Call this when terrain entities are added/removed from the scene
   */
  invalidateTerrainCache(): void {
    this.terrainEntityCacheDirty = true;
    this.cachedTerrainEntity = null;
  }

  /**
   * Gets heightmap tool
   */
  getHeightmapTool(): HeightmapTerrainTool {
    return this.heightmapTool;
  }

  /**
   * Gets sculpt tool
   */
  getSculptTool(): TerrainSculptTool {
    return this.sculptTool;
  }

  /**
   * Disposes the controller
   */
  dispose(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.deactivate();
    this.sculptTool.dispose();
    this.heightmapTool.dispose();
    this.cachedTerrainEntity = null;
    this.terrainEntityCacheDirty = true;
  }
}

