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
import { TerrainSculptTool, type SculptOperationConfig } from '../tools/TerrainSculptTool';
import { HeightmapTerrainTool } from '../tools/HeightmapTerrainTool';
import type { BrushOperation } from '../tools/TerrainBrush';
import type { Vec3 } from '@engine/core/math';

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
  private abortController: AbortController | null = null;
  private isActive = false;
  private currentOperation: BrushOperation = 'raise';
  private isSculpting = false;

  constructor(config: TerrainBuilderControllerConfig) {
    this.config = config;
    this.sculptTool = new TerrainSculptTool();
    this.heightmapTool = new HeightmapTerrainTool(config.scene);
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
    this.isActive = true;

    if (entity) {
      this.sculptTool.setTerrainEntity(entity);
      this.sculptTool.activate();
    }

    this.config.onStatusMessage?.('Terrain editing mode active', 2000);
  }

  /**
   * Deactivates terrain editing mode
   */
  deactivate(): void {
    this.isActive = false;
    this.isSculpting = false;
    this.sculptTool.deactivate();
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
   * Raycasts to terrain surface
   */
  private raycastToTerrain(event: MouseEvent): { position: Vec3; entity: Entity } | null {
    const canvas = this.config.canvas;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Get camera info - use cameraDirector if available, otherwise use scene's primary camera
    let cameraPosition: Vec3 = [0, 2, 5];
    let forward: Vec3 = [0, -0.5, -1];

    if (this.config.cameraDirector) {
      // Try to get position from editor camera controller
      const editorCamera = (this.config.cameraDirector as unknown as { editorCamera?: { getPosition(): Vec3; getOrientation(): { yaw: number; pitch: number } } }).editorCamera;
      if (editorCamera) {
        cameraPosition = editorCamera.getPosition();
        const orientation = editorCamera.getOrientation();
        // Calculate forward vector from yaw/pitch
        const cosPitch = Math.cos(orientation.pitch);
        forward = [
          Math.sin(orientation.yaw) * cosPitch,
          -Math.sin(orientation.pitch),
          -Math.cos(orientation.yaw) * cosPitch,
        ];
      }
    } else {
      // Extract camera position and forward direction from scene's primary camera
      const primaryCamera = this.config.scene.primaryCamera;
      if (primaryCamera) {
        const transform = primaryCamera.transform;
        cameraPosition = transform.getWorldPosition();
        forward = transform.getForward([0, 0, -1]);
      }
    }

    // Normalize forward vector

    const forwardLength = Math.sqrt(
      forward[0] * forward[0] + forward[1] * forward[1] + forward[2] * forward[2]
    );
    if (forwardLength < 0.001) {
      return null;
    }

    // Normalize forward
    forward[0] /= forwardLength;
    forward[1] /= forwardLength;
    forward[2] /= forwardLength;

    // Calculate right and up vectors
    const up: Vec3 = [0, 1, 0];
    const right: Vec3 = [
      forward[1] * up[2] - forward[2] * up[1],
      forward[2] * up[0] - forward[0] * up[2],
      forward[0] * up[1] - forward[1] * up[0],
    ];

    const rightLength = Math.sqrt(right[0] * right[0] + right[1] * right[1] + right[2] * right[2]);
    if (rightLength > 0.001) {
      right[0] /= rightLength;
      right[1] /= rightLength;
      right[2] /= rightLength;
    }

    // Calculate ray direction
    const fov = Math.PI / 4; // 45 degrees
    const aspect = rect.width / rect.height;
    const tanFov = Math.tan(fov / 2);

    const rayDir: Vec3 = [
      forward[0] + right[0] * x * tanFov * aspect + up[0] * y * tanFov,
      forward[1] + right[1] * x * tanFov * aspect + up[1] * y * tanFov,
      forward[2] + right[2] * x * tanFov * aspect + up[2] * y * tanFov,
    ];

    const dirLength = Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
    if (dirLength > 0.001) {
      rayDir[0] /= dirLength;
      rayDir[1] /= dirLength;
      rayDir[2] /= dirLength;
    }

    // Raycast to terrain (simplified: raycast to Y=0 plane or use proper raycaster)
    // For now, project to Y=0 plane
    if (rayDir[1] >= 0) {
      return null;
    }

    const t = -cameraPosition[1] / rayDir[1];
    if (t <= 0) {
      return null;
    }

    const position: Vec3 = [
      cameraPosition[0] + rayDir[0] * t,
      0, // Will be replaced with actual terrain height
      cameraPosition[2] + rayDir[2] * t,
    ];

    // Find terrain entity and get actual height
    const terrainEntity = this.getTerrainEntity();
    if (terrainEntity) {
      const terrain = this.sculptTool.getHeightmapTerrain();
      if (terrain) {
        position[1] = terrain.getHeightAt(position[0], position[2]);
        return { position, entity: terrainEntity };
      }
    }

    // Get first root entity or create a fallback
    const rootEntities = this.config.scene.rootEntities;
    const rootEntity = rootEntities.length > 0 ? rootEntities[0] ?? null : null;
    if (!rootEntity) {
      return null;
    }
    return { position, entity: rootEntity };
  }

  /**
   * Gets the current terrain entity
   * Searches through all entities in the scene to find one with TerrainComponent
   */
  private getTerrainEntity(): Entity | null {
    const rootEntities = this.config.scene.rootEntities;
    
    // First, check root entities
    for (const entity of rootEntities) {
      if (entity.hasComponent(TerrainComponent)) {
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
        return foundEntity;
      }
    }
    
    return null;
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
  }
}

