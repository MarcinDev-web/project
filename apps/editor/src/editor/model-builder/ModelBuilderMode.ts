/**
 * ModelBuilderMode - Edit mode for Model Builder
 * 
 * Manages building state, camera integration, and input handling
 */

import type { Scene } from '@engine/world';
import type { ModelBuilder } from '@engine/blocks';
import type { ModelBuilderScene } from './ModelBuilderScene';
import type { LocalPos, MicroBlock } from '@engine/microblocks';
import { HistoryManager } from '@engine/editor-utils';
import { DisposableGroup } from '@engine/core';

/**
 * Configuration for ModelBuilderMode
 */
export interface ModelBuilderModeConfig {
  /** Enable undo/redo */
  enableHistory?: boolean;
  /** Logger for debugging */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Current tool state
 */
export interface ToolState {
  /** Current tool mode */
  mode: 'place' | 'remove' | 'paint' | 'select';
  /** Selected micro block shape */
  shape: 'cube' | 'slab' | 'stairs' | 'corner' | 'wedge';
  /** Selected material ID */
  materialId: string;
  /** Current rotation */
  rotation: 0 | 1 | 2 | 3;
}

/**
 * ModelBuilderMode manages the building state and operations
 */
export class ModelBuilderMode {
  private readonly scene: Scene;
  private readonly builderScene: ModelBuilderScene;
  private readonly builder: ModelBuilder;
  private readonly config: ModelBuilderModeConfig;
  private readonly logger: ModelBuilderModeConfig['logger'];
  private readonly disposables = new DisposableGroup();

  private history: HistoryManager | null = null;
  private toolState: ToolState = {
    mode: 'place',
    shape: 'cube',
    materialId: 'plastic_red',
    rotation: 0,
  };
  private isActive = false;

  constructor(
    scene: Scene,
    builderScene: ModelBuilderScene,
    builder: ModelBuilder,
    config?: ModelBuilderModeConfig
  ) {
    this.scene = scene;
    this.builderScene = builderScene;
    this.builder = builder;
    this.config = config ?? {};
    this.logger = this.config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };

    if (this.config.enableHistory !== false) {
      this.history = new HistoryManager();
    }
  }

  /**
   * Activates the building mode
   */
  activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.logger?.debug('ModelBuilderMode activated');
  }

  /**
   * Deactivates the building mode
   */
  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.logger?.debug('ModelBuilderMode deactivated');
  }

  /**
   * Checks if mode is active
   */
  isModeActive(): boolean {
    return this.isActive;
  }

  /**
   * Gets current tool state
   */
  getToolState(): ToolState {
    return { ...this.toolState };
  }

  /**
   * Sets tool mode
   */
  setToolMode(mode: ToolState['mode']): void {
    this.toolState.mode = mode;
    this.logger?.debug(`Tool mode set to: ${mode}`);
  }

  /**
   * Sets block shape
   */
  setBlockShape(shape: ToolState['shape']): void {
    this.toolState.shape = shape;
    this.logger?.debug(`Block shape set to: ${shape}`);
  }

  /**
   * Sets material ID
   */
  setMaterialId(materialId: string): void {
    this.toolState.materialId = materialId;
    this.logger?.debug(`Material ID set to: ${materialId}`);
  }

  /**
   * Sets rotation
   */
  setRotation(rotation: ToolState['rotation']): void {
    this.toolState.rotation = rotation;
    this.logger?.debug(`Rotation set to: ${rotation}`);
  }

  /**
   * Rotates current block (cycles through 0-3)
   */
  rotateBlock(): void {
    this.toolState.rotation = ((this.toolState.rotation + 1) % 4) as ToolState['rotation'];
    this.logger?.debug(`Rotation cycled to: ${this.toolState.rotation}`);
  }

  /**
   * Places a block at local position
   */
  placeBlock(pos: LocalPos): boolean {
    if (!this.isActive) return false;

    const block: MicroBlock = {
      type: this.toolState.shape,
      materialId: this.toolState.materialId,
      rotation: this.toolState.rotation,
    };

    // Save state for undo
    if (this.history) {
      const snapshot = this.createSnapshot();
      this.history.push(snapshot);
    }

    const success = this.builder.placeBlock(pos, block);
    if (success) {
      this.logger?.debug(`Block placed at: [${pos[0]}, ${pos[1]}, ${pos[2]}]`);
    }
    return success;
  }

  /**
   * Removes a block at local position
   */
  removeBlock(pos: LocalPos): boolean {
    if (!this.isActive) return false;

    // Save state for undo
    if (this.history) {
      const snapshot = this.createSnapshot();
      this.history.push(snapshot);
    }

    const success = this.builder.removeBlock(pos);
    if (success) {
      this.logger?.debug(`Block removed at: [${pos[0]}, ${pos[1]}, ${pos[2]}]`);
    }
    return success;
  }

  /**
   * Rotates a block at position
   */
  rotateBlockAt(pos: LocalPos): boolean {
    if (!this.isActive) return false;

    // Save state for undo
    if (this.history) {
      const snapshot = this.createSnapshot();
      this.history.push(snapshot);
    }

    const success = this.builder.rotateBlock(pos, 1);
    if (success) {
      this.logger?.debug(`Block rotated at: [${pos[0]}, ${pos[1]}, ${pos[2]}]`);
    }
    return success;
  }

  /**
   * Undo last operation
   */
  undo(): boolean {
    if (!this.history || !this.history.canUndo()) {
      return false;
    }

    const snapshot = this.history.undo();
    if (snapshot) {
      this.restoreSnapshot(snapshot);
      this.logger?.debug('Undo performed');
      return true;
    }
    return false;
  }

  /**
   * Redo last undone operation
   */
  redo(): boolean {
    if (!this.history || !this.history.canRedo()) {
      return false;
    }

    const snapshot = this.history.redo();
    if (snapshot) {
      this.restoreSnapshot(snapshot);
      this.logger?.debug('Redo performed');
      return true;
    }
    return false;
  }

  /**
   * Creates a snapshot of current state for undo/redo
   */
  private createSnapshot(): unknown {
    return this.builder.exportModel();
  }

  /**
   * Restores state from snapshot
   */
  private restoreSnapshot(snapshot: unknown): void {
    if (snapshot && typeof snapshot === 'object' && 'storeData' in snapshot) {
      this.builder.importModel(snapshot as Parameters<typeof this.builder.importModel>[0]);
    }
  }

  /**
   * Updates mode (call each frame)
   */
  update(deltaTime: number): void {
    if (!this.isActive) return;
    
    // Update camera
    this.builderScene.updateCamera(deltaTime);
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    this.deactivate();
    this.disposables.dispose();
    this.history = null;
  }
}

