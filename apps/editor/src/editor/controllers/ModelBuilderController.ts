/**
 * ModelBuilderController - Handles user interactions with model builder
 * 
 * Raycasting, mouse clicks, dragging, keyboard shortcuts
 */

import { Raycaster } from '@engine/world';
import type { Scene, Entity, Ray, RaycastHit } from '@engine/world';
import type { ModelBuilderMode } from '../model-builder/ModelBuilderMode';
import { MicroBlockComponent } from '@engine/world';
import { MICRO_BLOCK_SIZE } from '@engine/microblocks';
import type { LocalPos } from '@engine/microblocks';
import type { InteractionTool } from '../input/InteractionTypes';
import type { MicroBlockPreview } from '../model-builder/MicroBlockPreview';

/**
 * Key binding configuration
 */
export interface KeyBindingConfig {
  undo: string[];
  redo: string[];
  rotate: string[];
  toolPlace: string[];
  toolRemove: string[];
  toolPaint: string[];
  toolSelect: string[];
  toolBox: string[];
}

const DEFAULT_KEY_BINDINGS: KeyBindingConfig = {
  undo: ['z'],
  redo: ['y', 'Z'], // Z implies Shift+Z if checked correctly
  rotate: ['r'],
  toolPlace: ['1'],
  toolRemove: ['2'],
  toolPaint: ['3'],
  toolSelect: ['4'],
  toolBox: ['5'],
};

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
  /** Custom key bindings */
  keyBindings?: Partial<KeyBindingConfig>;
}

type ControllerLogger = NonNullable<ModelBuilderControllerConfig['logger']>;

/**
 * ModelBuilderController handles user input and raycasting
 */
export class ModelBuilderController implements InteractionTool {
  name = 'ModelBuilder';
  
  private readonly scene: Scene;
  private readonly mode: ModelBuilderMode;
  private readonly preview: MicroBlockPreview;
  private readonly raycaster: Raycaster;
  private readonly logger: ControllerLogger;
  private readonly keyBindings: KeyBindingConfig;
  
  private cachedMicroBlockEntities: Entity[] = [];
  private cachedEntityCount = -1;

  private isDragging = false;
  private boxStartPos: LocalPos | null = null;
  private lastHitPos: LocalPos | null = null;

  constructor(
    scene: Scene,
    mode: ModelBuilderMode,
    preview: MicroBlockPreview,
    config?: ModelBuilderControllerConfig
  ) {
    this.scene = scene;
    this.mode = mode;
    this.preview = preview;
    this.raycaster = new Raycaster();
    this.logger = config?.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
    this.keyBindings = { ...DEFAULT_KEY_BINDINGS, ...config?.keyBindings };
    this.logger.debug('ModelBuilderController initialized');
  }

  /**
   * Checks if this tool wants to handle the input at the given ray.
   */
  checkHit(ray: Ray): boolean {
    if (!this.mode.isModeActive()) {
      this.preview.hidePreview();
      return false;
    }

    const hitPos = this.raycast(ray);
    return hitPos !== null;
  }

  /**
   * Called when the tool becomes active (mousedown on a claimed hit).
   */
  onPointerDown(event: PointerEvent, ray: Ray): void {
    if (!this.mode.isModeActive()) return;

    // Handle Pipette (Alt+Click)
    if (event.altKey) {
      const hitPos = this.raycast(ray);
      if (hitPos) {
        this.mode.pickBlock(hitPos);
        this.updatePreview(hitPos, true);
      }
      return;
    }

    // Left click
    if (event.button === 0) {
      const toolState = this.mode.getToolState();

      // Handle Box Tool
      if (toolState.mode === 'box') {
        const hitPos = this.raycast(ray);
        if (hitPos) {
          this.isDragging = true;
          this.boxStartPos = hitPos;
          this.lastHitPos = hitPos; // Track current pos for preview
        }
        return;
      }

      this.handleDragStart(ray);
      this.handleClick(ray, 'left');
    }
  }

  /**
   * Called on mouse move.
   */
  onPointerMove(_event: PointerEvent, ray: Ray): void {
    if (!this.mode.isModeActive()) return;

    const hitPos = this.raycast(ray);
    const toolState = this.mode.getToolState();

    // Update Preview
    if (hitPos) {
      if (this.isDragging && toolState.mode === 'box' && this.boxStartPos) {
        // Box Preview
        this.preview.showBoxPreview(this.boxStartPos, hitPos, true);
      } else {
        // Standard Preview
        if (toolState.mode === 'remove') {
          this.updatePreview(hitPos, false); // Red
        } else if (toolState.mode === 'select') {
          this.preview.hidePreview();
        } else if (toolState.mode === 'box') {
           // Show single block preview when just hovering in box mode
           this.updatePreview(hitPos, true);
        } else {
          this.updatePreview(hitPos, true); // Green
        }
      }
    } else {
      this.preview.hidePreview();
    }

    // Handle dragging
    if (this.isDragging && hitPos) {
      if (toolState.mode === 'box') {
        // Just update lastHitPos for reference, actual preview is handled above
        this.lastHitPos = hitPos;
      } else {
        this.handleDrag(ray);
      }
    }
  }

  /**
   * Called on mouse up if the tool was active.
   */
  onPointerUp(_event: PointerEvent, _ray: Ray): void {
    const toolState = this.mode.getToolState();

    if (this.isDragging && toolState.mode === 'box' && this.boxStartPos && this.lastHitPos) {
      // Place Box
      this.mode.placeBox(this.boxStartPos, this.lastHitPos);
      this.boxStartPos = null;
    }

    this.handleDragEnd();
  }

  /**
   * Called to cancel the current operation (e.g. Esc key).
   */
  cancel(): void {
    this.handleDragEnd();
    this.boxStartPos = null;
    this.preview.hidePreview();
  }

  /**
   * Performs raycast and returns hit position in local coordinates
   */
  raycast(ray: Ray): LocalPos | null {
    const targetEntities = this.getMicroBlockEntities();
    if (targetEntities.length === 0) {
      return null;
    }

    const hit: RaycastHit | null = this.raycaster.raycastClosest(ray, targetEntities);
    if (!hit) {
      return null;
    }

    return this.toLocalPos(hit.point);
  }

  private updatePreview(pos: LocalPos, isValid: boolean): void {
    const toolState = this.mode.getToolState();
    
    this.preview.showPreview(pos, {
      type: toolState.shape,
      materialId: toolState.materialId,
      rotation: toolState.rotation
    }, isValid);
  }

  /**
   * Handles mouse click
   */
  handleClick(ray: Ray, button: 'left' | 'right'): void {
    const hitPos = this.raycast(ray);
    if (!hitPos) return;

    const toolState = this.mode.getToolState();

    if (button === 'left') {
      if (toolState.mode === 'place') {
        this.mode.placeBlock(hitPos);
      } else if (toolState.mode === 'remove') {
        this.mode.removeBlock(hitPos);
      } else if (toolState.mode === 'paint') {
        this.mode.paintBlock(hitPos);
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
  handleDragStart(ray: Ray): void {
    const hitPos = this.raycast(ray);
    if (hitPos) {
      this.isDragging = true;
      this.lastHitPos = hitPos;
    }
  }

  /**
   * Handles mouse drag
   */
  handleDrag(ray: Ray): void {
    if (!this.isDragging) return;

    const hitPos = this.raycast(ray);
    if (!hitPos) return;

    if (this.lastHitPos && (
      hitPos[0] !== this.lastHitPos[0] ||
      hitPos[1] !== this.lastHitPos[1] ||
      hitPos[2] !== this.lastHitPos[2]
    )) {
      const toolState = this.mode.getToolState();
      
      if (toolState.mode === 'place') {
        this.mode.placeBlock(hitPos);
      } else if (toolState.mode === 'remove') {
        this.mode.removeBlock(hitPos);
      } else if (toolState.mode === 'paint') {
        this.mode.paintBlock(hitPos);
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
    if (ctrl && this.keyBindings.undo.includes(key.toLowerCase()) && !shift) {
      return this.mode.undo();
    }
    if (ctrl && this.keyBindings.undo.includes(key.toLowerCase()) && shift) {
      return this.mode.redo();
    }
    if (ctrl && this.keyBindings.redo.includes(key)) {
      return this.mode.redo();
    }

    // Rotate block
    if (this.keyBindings.rotate.includes(key.toLowerCase())) {
      this.mode.rotateBlock();
      return true;
    }

    // Tool shortcuts
    if (this.keyBindings.toolPlace.includes(key)) {
      this.mode.setToolMode('place');
      return true;
    }
    if (this.keyBindings.toolRemove.includes(key)) {
      this.mode.setToolMode('remove');
      return true;
    }
    if (this.keyBindings.toolPaint.includes(key)) {
      this.mode.setToolMode('paint');
      return true;
    }
    if (this.keyBindings.toolSelect.includes(key)) {
      this.mode.setToolMode('select');
      return true;
    }
    if (this.keyBindings.toolBox.includes(key)) {
      this.mode.setToolMode('box');
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

  /**
   * Cleans up resources
   */
  dispose(): void {
    this.cachedMicroBlockEntities = [];
    this.cachedEntityCount = -1;
    this.isDragging = false;
    this.lastHitPos = null;
    this.boxStartPos = null;
    this.preview.hidePreview();
    this.logger.debug('ModelBuilderController disposed');
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
