/**
 * ModelBuilderMode - Edit mode for Model Builder
 * 
 * Manages building state, camera integration, and input handling
 */

import type { ModelBuilder, AABB } from '@engine/blocks';
import type { ModelBuilderScene } from './ModelBuilderScene';
import { MICRO_BLOCK_SIZE, type LocalPos, type MicroBlock, type MicroBlockStoreData } from '@engine/microblocks';
import { DisposableGroup } from '@engine/core';

/**
 * Configuration for ModelBuilderMode
 */
export interface ModelBuilderModeConfig {
  /** Enable undo/redo */
  enableHistory?: boolean;
  /** Callback to register undo handler with main editor */
  registerUndo?: (handler: () => boolean) => () => void;
  /** Callback to register redo handler with main editor */
  registerRedo?: (handler: () => boolean) => () => void;
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
  mode: 'place' | 'remove' | 'paint' | 'select' | 'box';
  /** Selected micro block shape */
  shape: 'cube' | 'slab' | 'stairs' | 'corner' | 'wedge';
  /** Selected material ID */
  materialId: string;
  /** Current rotation */
  rotation: 0 | 1 | 2 | 3;
}

/**
 * BuilderCommand interface for Undo/Redo
 */
interface BuilderCommand {
  execute(): boolean;
  undo(): void;
}

/**
 * Command to set (place, remove, paint) a single block
 */
class SetBlockCommand implements BuilderCommand {
  private prevBlock: MicroBlock | null = null;
  private executed = false;

  constructor(
    private builder: ModelBuilder,
    private pos: LocalPos,
    private newBlock: MicroBlock | null,
    private logger?: any
  ) {}

  execute(): boolean {
    if (!this.executed) {
      // First execution: capture previous state
      const store = this.builder.getStore();
      const worldPos = [
        this.pos[0] * MICRO_BLOCK_SIZE,
        this.pos[1] * MICRO_BLOCK_SIZE,
        this.pos[2] * MICRO_BLOCK_SIZE
      ] as [number, number, number];
      const block = store.getBlock(worldPos);
      this.prevBlock = block ? { ...block } : null;
      this.executed = true;
    }

    if (this.newBlock) {
      const success = this.builder.placeBlock(this.pos, this.newBlock);
      if (success) {
        this.logger?.debug(`Block placed at: [${this.pos[0]}, ${this.pos[1]}, ${this.pos[2]}]`);
      }
      return success;
    } else {
      const success = this.builder.removeBlock(this.pos);
      if (success) {
        this.logger?.debug(`Block removed at: [${this.pos[0]}, ${this.pos[1]}, ${this.pos[2]}]`);
      }
      return success;
    }
  }

  undo(): void {
    if (this.prevBlock) {
      this.builder.placeBlock(this.pos, this.prevBlock);
    } else {
      this.builder.removeBlock(this.pos);
    }
  }
}

/**
 * Command to set multiple blocks at once
 */
class BatchSetBlockCommand implements BuilderCommand {
  private prevBlocks: { pos: LocalPos; block: MicroBlock | null }[] = [];
  private executed = false;

  constructor(
    private builder: ModelBuilder,
    private updates: { pos: LocalPos; block: MicroBlock | null }[],
    private logger?: any
  ) {}

  execute(): boolean {
    if (!this.executed) {
      // Capture previous state for all positions
      const store = this.builder.getStore();
      this.prevBlocks = [];
      
      for (const update of this.updates) {
        const worldPos = [
          update.pos[0] * MICRO_BLOCK_SIZE,
          update.pos[1] * MICRO_BLOCK_SIZE,
          update.pos[2] * MICRO_BLOCK_SIZE
        ] as [number, number, number];
        const block = store.getBlock(worldPos);
        this.prevBlocks.push({
          pos: update.pos,
          block: block ? { ...block } : null
        });
      }
      this.executed = true;
    }

    const success = this.builder.placeBlocks(this.updates);
    if (success) {
      this.logger?.debug(`Batch placed: ${this.updates.length} blocks`);
    }
    return success;
  }

  undo(): void {
    this.builder.placeBlocks(this.prevBlocks);
  }
}

/**
 * Command to fill a region
 */
class FillRegionCommand implements BuilderCommand {
  private prevData: MicroBlockStoreData | null = null;
  private executed = false;
  private bounds: AABB;
  private selectionMin: LocalPos;

  constructor(
    private builder: ModelBuilder,
    selection: { min: LocalPos; max: LocalPos },
    private block: MicroBlock,
    private logger?: any
  ) {
    this.selectionMin = selection.min;
    this.bounds = {
      min: [
        selection.min[0] * MICRO_BLOCK_SIZE,
        selection.min[1] * MICRO_BLOCK_SIZE,
        selection.min[2] * MICRO_BLOCK_SIZE,
      ],
      max: [
        selection.max[0] * MICRO_BLOCK_SIZE,
        selection.max[1] * MICRO_BLOCK_SIZE,
        selection.max[2] * MICRO_BLOCK_SIZE,
      ],
    };
  }

  execute(): boolean {
    if (!this.executed) {
      this.prevData = this.builder.copyRegion(this.bounds);
      this.executed = true;
    }
    this.builder.fillRegion(this.bounds, this.block);
    this.logger?.debug('Region filled');
    return true;
  }

  undo(): void {
    if (this.prevData) {
      const buildBounds = this.builder.getBounds();
      const clampedMin: LocalPos = [
        Math.max(this.selectionMin[0], buildBounds.min[0]),
        Math.max(this.selectionMin[1], buildBounds.min[1]),
        Math.max(this.selectionMin[2], buildBounds.min[2]),
      ];
      this.builder.clearRegion(this.bounds);
      this.builder.pasteRegion(this.prevData, clampedMin);
    }
  }
}

/**
 * Command to clear a region
 */
class ClearRegionCommand implements BuilderCommand {
  private prevData: MicroBlockStoreData | null = null;
  private executed = false;
  private bounds: AABB;
  private selectionMin: LocalPos;

  constructor(
    private builder: ModelBuilder,
    selection: { min: LocalPos; max: LocalPos },
    private logger?: any
  ) {
    this.selectionMin = selection.min;
    this.bounds = {
      min: [
        selection.min[0] * MICRO_BLOCK_SIZE,
        selection.min[1] * MICRO_BLOCK_SIZE,
        selection.min[2] * MICRO_BLOCK_SIZE,
      ],
      max: [
        selection.max[0] * MICRO_BLOCK_SIZE,
        selection.max[1] * MICRO_BLOCK_SIZE,
        selection.max[2] * MICRO_BLOCK_SIZE,
      ],
    };
  }

  execute(): boolean {
    if (!this.executed) {
      this.prevData = this.builder.copyRegion(this.bounds);
      this.executed = true;
    }
    this.builder.clearRegion(this.bounds);
    this.logger?.debug('Region cleared');
    return true;
  }

  undo(): void {
    if (this.prevData) {
      const buildBounds = this.builder.getBounds();
      const clampedMin: LocalPos = [
        Math.max(this.selectionMin[0], buildBounds.min[0]),
        Math.max(this.selectionMin[1], buildBounds.min[1]),
        Math.max(this.selectionMin[2], buildBounds.min[2]),
      ];
      this.builder.clearRegion(this.bounds); // Just in case
      this.builder.pasteRegion(this.prevData, clampedMin);
    }
  }
}

/**
 * Command to mirror a region
 */
class MirrorRegionCommand implements BuilderCommand {
  private prevData: MicroBlockStoreData | null = null;
  private executed = false;
  private bounds: AABB;
  private selectionMin: LocalPos;

  constructor(
    private builder: ModelBuilder,
    selection: { min: LocalPos; max: LocalPos },
    private axis: 'x' | 'y' | 'z',
    private logger?: any
  ) {
    this.selectionMin = selection.min;
    this.bounds = {
      min: [
        selection.min[0] * MICRO_BLOCK_SIZE,
        selection.min[1] * MICRO_BLOCK_SIZE,
        selection.min[2] * MICRO_BLOCK_SIZE,
      ],
      max: [
        selection.max[0] * MICRO_BLOCK_SIZE,
        selection.max[1] * MICRO_BLOCK_SIZE,
        selection.max[2] * MICRO_BLOCK_SIZE,
      ],
    };
  }

  execute(): boolean {
    if (!this.executed) {
      this.prevData = this.builder.copyRegion(this.bounds);
      this.executed = true;
    }
    this.builder.mirrorRegion(this.bounds, this.axis);
    this.logger?.debug(`Region mirrored along ${this.axis}`);
    return true;
  }

  undo(): void {
    if (this.prevData) {
      const buildBounds = this.builder.getBounds();
      const clampedMin: LocalPos = [
        Math.max(this.selectionMin[0], buildBounds.min[0]),
        Math.max(this.selectionMin[1], buildBounds.min[1]),
        Math.max(this.selectionMin[2], buildBounds.min[2]),
      ];
      this.builder.clearRegion(this.bounds);
      this.builder.pasteRegion(this.prevData, clampedMin);
    }
  }
}

/**
 * CommandManager handles the undo/redo stack
 */
class CommandManager {
  private undoStack: BuilderCommand[] = [];
  private redoStack: BuilderCommand[] = [];
  private readonly limit: number;

  constructor(limit = 50) {
    this.limit = limit;
  }

  push(command: BuilderCommand): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
      return true;
    }
    return false;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
      return true;
    }
    return false;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

/**
 * ModelBuilderMode manages the building state and operations
 */
export class ModelBuilderMode {
  private readonly builderScene: ModelBuilderScene;
  private readonly builder: ModelBuilder;
  private readonly config: ModelBuilderModeConfig;
  private readonly logger: ModelBuilderModeConfig['logger'];
  private readonly disposables = new DisposableGroup();

  private commandManager: CommandManager;
  private toolState: ToolState = {
    mode: 'place',
    shape: 'cube',
    materialId: 'plastic_red',
    rotation: 0,
  };
  private isActive = false;
  private undoHandlerCleanup: (() => void) | null = null;
  private redoHandlerCleanup: (() => void) | null = null;

  private selectionStart: LocalPos | null = null;
  private selectionEnd: LocalPos | null = null;

  constructor(
    builderScene: ModelBuilderScene,
    builder: ModelBuilder,
    config?: ModelBuilderModeConfig
  ) {
    this.builderScene = builderScene;
    this.builder = builder;
    this.config = config ?? {};
    this.logger = this.config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };

    this.commandManager = new CommandManager();
  }

  /**
   * Activates the building mode
   */
  activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.logger?.debug('ModelBuilderMode activated');

    // Register undo/redo handlers
    if (this.config.registerUndo && this.config.registerRedo) {
      this.undoHandlerCleanup = this.config.registerUndo(() => this.undo());
      this.redoHandlerCleanup = this.config.registerRedo(() => this.redo());
    }
  }

  /**
   * Deactivates the building mode
   */
  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.logger?.debug('ModelBuilderMode deactivated');

    // Unregister handlers
    this.undoHandlerCleanup?.();
    this.undoHandlerCleanup = null;
    this.redoHandlerCleanup?.();
    this.redoHandlerCleanup = null;
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

    const command = new SetBlockCommand(this.builder, pos, block, this.logger);
    if (command.execute()) {
      if (this.config.enableHistory !== false) {
        this.commandManager.push(command);
      }
      return true;
    }
    return false;
  }

  /**
   * Removes a block at local position
   */
  removeBlock(pos: LocalPos): boolean {
    if (!this.isActive) return false;

    const command = new SetBlockCommand(this.builder, pos, null, this.logger);
    if (command.execute()) {
      if (this.config.enableHistory !== false) {
        this.commandManager.push(command);
      }
      return true;
    }
    return false;
  }

  /**
   * Paints a block (replaces if exists, places if empty)
   */
  paintBlock(pos: LocalPos): boolean {
    if (!this.isActive) return false;

    // Paint logic: just a place operation that overwrites whatever is there
    // SetBlockCommand handles capturing the previous block (whether null or existing)
    // so we don't need separate remove + place commands.
    
    const block: MicroBlock = {
      type: this.toolState.shape,
      materialId: this.toolState.materialId,
      rotation: this.toolState.rotation,
    };

    const command = new SetBlockCommand(this.builder, pos, block, this.logger);
    if (command.execute()) {
      if (this.config.enableHistory !== false) {
        this.commandManager.push(command);
      }
      return true;
    }
    return false;
  }

  /**
   * Picks a block at local position (Pipette)
   * Returns the block data if found
   */
  pickBlock(pos: LocalPos): MicroBlock | null {
    const store = this.builder.getStore();
    const worldPos: [number, number, number] = [
      pos[0] * MICRO_BLOCK_SIZE,
      pos[1] * MICRO_BLOCK_SIZE,
      pos[2] * MICRO_BLOCK_SIZE,
    ];

    const block = store.getBlock(worldPos);
    if (!block) return null;

    // Update tool state
    this.setBlockShape(block.type);
    this.setMaterialId(block.materialId);
    this.setRotation(block.rotation ?? 0);

    this.logger?.debug(`Picked block: ${block.type} (${block.materialId})`);
    return block;
  }

  /**
   * Places a box of blocks
   */
  placeBox(start: LocalPos, end: LocalPos): boolean {
    if (!this.isActive) return false;

    const minX = Math.min(start[0], end[0]);
    const minY = Math.min(start[1], end[1]);
    const minZ = Math.min(start[2], end[2]);
    const maxX = Math.max(start[0], end[0]);
    const maxY = Math.max(start[1], end[1]);
    const maxZ = Math.max(start[2], end[2]);

    const blockTemplate: MicroBlock = {
      type: this.toolState.shape,
      materialId: this.toolState.materialId,
      rotation: this.toolState.rotation,
    };

    const updates: { pos: LocalPos; block: MicroBlock | null }[] = [];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          updates.push({
            pos: [x, y, z],
            block: { ...blockTemplate }
          });
        }
      }
    }

    if (updates.length === 0) return false;

    const command = new BatchSetBlockCommand(this.builder, updates, this.logger);
    if (command.execute()) {
      if (this.config.enableHistory !== false) {
        this.commandManager.push(command);
      }
      return true;
    }
    return false;
  }

  /**
   * Rotates a block at position
   */
  rotateBlockAt(pos: LocalPos): boolean {
    if (!this.isActive) return false;

    // For rotation, we need to know the current block to create a SetBlockCommand
    // Or we could create a RotateBlockCommand. For simplicity, let's use SetBlockCommand
    // by calculating the new state manually.
    
    const store = this.builder.getStore();
    const worldPos: [number, number, number] = [
      pos[0] * MICRO_BLOCK_SIZE,
      pos[1] * MICRO_BLOCK_SIZE,
      pos[2] * MICRO_BLOCK_SIZE,
    ];
    const existing = store.getBlock(worldPos);
    
    if (!existing) return false;

    const newRotation = ((existing.rotation ?? 0) + 1) % 4 as 0 | 1 | 2 | 3;
    const newBlock: MicroBlock = {
      ...existing,
      rotation: newRotation
    };

    const command = new SetBlockCommand(this.builder, pos, newBlock, this.logger);
    if (command.execute()) {
      if (this.config.enableHistory !== false) {
        this.commandManager.push(command);
      }
      return true;
    }
    return false;
  }

  /**
   * Sets selection start position
   */
  setSelectionStart(pos: LocalPos): void {
    this.selectionStart = pos;
    if (!this.selectionEnd) {
      this.selectionEnd = pos;
    }
    this.logger?.debug(`Selection start set to: ${pos}`);
  }

  /**
   * Sets selection end position
   */
  setSelectionEnd(pos: LocalPos): void {
    this.selectionEnd = pos;
    if (!this.selectionStart) {
      this.selectionStart = pos;
    }
    this.logger?.debug(`Selection end set to: ${pos}`);
  }

  /**
   * Gets current selection bounds (normalized min/max)
   */
  getSelectionBounds(): { min: LocalPos; max: LocalPos } | null {
    if (!this.selectionStart || !this.selectionEnd) return null;
    
    return {
      min: [
        Math.min(this.selectionStart[0], this.selectionEnd[0]),
        Math.min(this.selectionStart[1], this.selectionEnd[1]),
        Math.min(this.selectionStart[2], this.selectionEnd[2]),
      ],
      max: [
        Math.max(this.selectionStart[0], this.selectionEnd[0]),
        Math.max(this.selectionStart[1], this.selectionEnd[1]),
        Math.max(this.selectionStart[2], this.selectionEnd[2]),
      ],
    };
  }

  /**
   * Fills current selection with block
   */
  fillSelection(): boolean {
    const bounds = this.getSelectionBounds();
    if (!bounds || !this.isActive) return false;

    const block: MicroBlock = {
      type: this.toolState.shape,
      materialId: this.toolState.materialId,
      rotation: this.toolState.rotation,
    };

    const command = new FillRegionCommand(this.builder, bounds, block, this.logger);
    if (command.execute()) {
      if (this.config.enableHistory !== false) {
        this.commandManager.push(command);
      }
      return true;
    }
    return false;
  }

  /**
   * Clears current selection
   */
  clearSelection(): boolean {
    const bounds = this.getSelectionBounds();
    if (!bounds || !this.isActive) return false;

    const command = new ClearRegionCommand(this.builder, bounds, this.logger);
    if (command.execute()) {
      if (this.config.enableHistory !== false) {
        this.commandManager.push(command);
      }
      return true;
    }
    return false;
  }

  /**
   * Mirrors current selection
   */
  mirrorSelection(axis: 'x' | 'y' | 'z'): boolean {
    const bounds = this.getSelectionBounds();
    if (!bounds || !this.isActive) return false;

    const command = new MirrorRegionCommand(this.builder, bounds, axis, this.logger);
    if (command.execute()) {
      if (this.config.enableHistory !== false) {
        this.commandManager.push(command);
      }
      return true;
    }
    return false;
  }

  /**
   * Undo last operation
   */
  undo(): boolean {
    if (this.commandManager.undo()) {
      this.logger?.debug('Undo performed');
      return true;
    }
    return false;
  }

  /**
   * Redo last undone operation
   */
  redo(): boolean {
    if (this.commandManager.redo()) {
      this.logger?.debug('Redo performed');
      return true;
    }
    return false;
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
    this.commandManager.clear();
  }
}
