/**
 * ModelBuilderController - Handles user interactions with model builder
 * 
 * Raycasting, mouse clicks, dragging, keyboard shortcuts
 */

import { Raycaster } from '@engine/world';
import type { Scene, Entity, Ray, RaycastHit } from '@engine/world';
import type { ModelBuilder } from '@engine/blocks';
import type { ModelBuilderMode } from '../model-builder/ModelBuilderMode';
import { MicroBlockComponent, MICRO_BLOCK_SIZE } from '@engine/microblocks';
import type { LocalPos } from '@engine/microblocks';
import type { Vec3 } from '@engine/core/math';

/**
 * Configuration for ModelBuilderController
 */
export interface ModelBuilderControllerConfig {
  /** Logger for debugging */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

type ControllerLogger = NonNullable<ModelBuilderControllerConfig['logger']>;

/**
 * ModelBuilderController handles user input and raycasting
 */
export class ModelBuilderController {
  private readonly scene: Scene;
  private readonly builder: ModelBuilder;
  private readonly mode: ModelBuilderMode;
  private readonly raycaster: Raycaster;
  private readonly logger: ControllerLogger;
  private readonly scratchRay: Ray = {
    origin: [0, 0, 0] as [number, number, number],
    direction: [0, 0, 0] as [number, number, number],
  };
  private cachedMicroBlockEntities: Entity[] = [];
  private cachedEntityCount = -1;

  private isDragging = false;
  private lastHitPos: LocalPos | null = null;

  constructor(
    scene: Scene,
    builder: ModelBuilder,
    mode: ModelBuilderMode,
    config?: ModelBuilderControllerConfig
  ) {
    this.scene = scene;
    this.builder = builder;
    this.mode = mode;
    this.raycaster = new Raycaster();
    this.logger = config?.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
    this.logger.debug('ModelBuilderController initialized');
  }

  /**
   * Performs raycast and returns hit position in local coordinates
   */
  raycast(rayOrigin: Vec3, rayDirection: Vec3): LocalPos | null {
    const targetEntities = this.getMicroBlockEntities();
    if (targetEntities.length === 0) {
      return null;
    }

    const ray = this.updateRay(rayOrigin, rayDirection);
    const hit: RaycastHit | null = this.raycaster.raycastClosest(ray, targetEntities);
    if (!hit) {
      return null;
    }

    return this.toLocalPos(hit.point);
  }

  /**
   * Handles mouse click
   */
  handleClick(rayOrigin: Vec3, rayDirection: Vec3, button: 'left' | 'right'): void {
    const hitPos = this.raycast(rayOrigin, rayDirection);
    if (!hitPos) return;

    const toolState = this.mode.getToolState();

    if (button === 'left') {
      if (toolState.mode === 'place') {
        this.mode.placeBlock(hitPos);
      } else if (toolState.mode === 'remove') {
        this.mode.removeBlock(hitPos);
      } else if (toolState.mode === 'paint') {
        // Paint mode: place block if empty, otherwise change material
        const store = this.builder.getStore();
        const worldPos: Vec3 = [
          hitPos[0] * MICRO_BLOCK_SIZE,
          hitPos[1] * MICRO_BLOCK_SIZE,
          hitPos[2] * MICRO_BLOCK_SIZE,
        ];
        const existing = store.getBlock(worldPos);
        if (existing) {
          // Change material of existing block
          this.mode.removeBlock(hitPos);
          this.mode.placeBlock(hitPos);
        } else {
          this.mode.placeBlock(hitPos);
        }
      }
    } else if (button === 'right') {
      if (toolState.mode === 'place' || toolState.mode === 'paint') {
        this.mode.removeBlock(hitPos);
      }
    }

    this.lastHitPos = hitPos;
  }

  /**
   * Handles mouse drag start
   */
  handleDragStart(rayOrigin: Vec3, rayDirection: Vec3): void {
    const hitPos = this.raycast(rayOrigin, rayDirection);
    if (hitPos) {
      this.isDragging = true;
      this.lastHitPos = hitPos;
    }
  }

  /**
   * Handles mouse drag
   */
  handleDrag(rayOrigin: Vec3, rayDirection: Vec3): void {
    if (!this.isDragging) return;

    const hitPos = this.raycast(rayOrigin, rayDirection);
    if (!hitPos) return;

    // Only place/remove if position changed
    if (this.lastHitPos && (
      hitPos[0] !== this.lastHitPos[0] ||
      hitPos[1] !== this.lastHitPos[1] ||
      hitPos[2] !== this.lastHitPos[2]
    )) {
      const toolState = this.mode.getToolState();
      
      if (toolState.mode === 'place' || toolState.mode === 'paint') {
        this.mode.placeBlock(hitPos);
      } else if (toolState.mode === 'remove') {
        this.mode.removeBlock(hitPos);
      }

      this.lastHitPos = hitPos;
    }
  }

  /**
   * Handles mouse drag end
   */
  handleDragEnd(): void {
    this.isDragging = false;
    this.lastHitPos = null;
  }

  /**
   * Handles keyboard shortcut
   */
  handleKey(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }): boolean {
    const ctrl = modifiers?.ctrl ?? false;
    const shift = modifiers?.shift ?? false;

    // Undo/Redo
    if (ctrl && key === 'z' && !shift) {
      return this.mode.undo();
    }
    if (ctrl && key === 'z' && shift) {
      return this.mode.redo();
    }
    if (ctrl && key === 'y') {
      return this.mode.redo();
    }

    // Rotate block
    if (key === 'r' || key === 'R') {
      this.mode.rotateBlock();
      return true;
    }

    // Tool shortcuts
    if (key === '1') {
      this.mode.setToolMode('place');
      return true;
    }
    if (key === '2') {
      this.mode.setToolMode('remove');
      return true;
    }
    if (key === '3') {
      this.mode.setToolMode('paint');
      return true;
    }
    if (key === '4') {
      this.mode.setToolMode('select');
      return true;
    }

    return false;
  }

  /**
   * Gets last hit position
   */
  getLastHitPosition(): LocalPos | null {
    return this.lastHitPos;
  }

  private updateRay(rayOrigin: Vec3, rayDirection: Vec3): Ray {
    const ray = this.scratchRay;
    const origin = ray.origin;
    origin[0] = rayOrigin[0] ?? 0;
    origin[1] = rayOrigin[1] ?? 0;
    origin[2] = rayOrigin[2] ?? 0;

    const direction = ray.direction;
    direction[0] = rayDirection[0] ?? 0;
    direction[1] = rayDirection[1] ?? 0;
    direction[2] = rayDirection[2] ?? 0;

    const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
    direction[0] /= length;
    direction[1] /= length;
    direction[2] /= length;

    return ray;
  }

  private getMicroBlockEntities(): Entity[] {
    const entityCount = this.scene.entityCount;
    if (entityCount !== this.cachedEntityCount) {
      this.cachedMicroBlockEntities = this.scene.queryEntities(MicroBlockComponent);
      this.cachedEntityCount = entityCount;
    }
    return this.cachedMicroBlockEntities;
  }

  private toLocalPos(worldPos: [number, number, number]): LocalPos {
    return [
      Math.floor((worldPos[0] ?? 0) / MICRO_BLOCK_SIZE),
      Math.floor((worldPos[1] ?? 0) / MICRO_BLOCK_SIZE),
      Math.floor((worldPos[2] ?? 0) / MICRO_BLOCK_SIZE),
    ] as LocalPos;
  }
}

