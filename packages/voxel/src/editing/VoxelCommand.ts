/**
 * Command pattern for voxel operations - enables undo/redo
 */

import type { VoxelOpResult } from './VoxelOperations.js';
import type { VoxelStore } from './VoxelStore.js';
import type { VoxelDiff } from './VoxelDiff.js';

/**
 * Command for a voxel operation
 */
export interface VoxelCommand {
  /** Unique command ID */
  commandId: string;
  /** Client/user that issued command */
  clientId: string;
  /** Timestamp when issued */
  timestamp: number;
  /** Execute the command */
  execute(store: VoxelStore): VoxelOpResult;
  /** Undo the command */
  undo(store: VoxelStore): void;
  /** Get diff of this command */
  getDiff(): VoxelDiff;
}

/**
 * Command history with undo/redo support per client
 */
export class VoxelCommandHistory {
  /** History per client */
  private readonly histories = new Map<string, VoxelCommand[]>();
  /** Redo stacks per client */
  private readonly redoStacks = new Map<string, VoxelCommand[]>();
  /** Max history size per client */
  private readonly maxHistorySize: number;

  constructor(maxHistorySize = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Add command to history
   */
  push(clientId: string, command: VoxelCommand): void {
    let history = this.histories.get(clientId);
    if (!history) {
      history = [];
      this.histories.set(clientId, history);
    }

    history.push(command);
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Clear redo stack when new command is added
    this.redoStacks.set(clientId, []);
  }

  /**
   * Undo last command for client
   */
  undo(clientId: string, store: VoxelStore): VoxelCommand | null {
    const history = this.histories.get(clientId);
    if (!history || history.length === 0) return null;

    const command = history.pop()!;
    command.undo(store);

    let redoStack = this.redoStacks.get(clientId);
    if (!redoStack) {
      redoStack = [];
      this.redoStacks.set(clientId, redoStack);
    }
    redoStack.push(command);

    return command;
  }

  /**
   * Redo last undone command for client
   */
  redo(clientId: string, store: VoxelStore): VoxelCommand | null {
    const redoStack = this.redoStacks.get(clientId);
    if (!redoStack || redoStack.length === 0) return null;

    const command = redoStack.pop()!;
    const result = command.execute(store);
    if (result.success) {
      let history = this.histories.get(clientId);
      if (!history) {
        history = [];
        this.histories.set(clientId, history);
      }
      history.push(command);
    }

    return command;
  }

  /**
   * Get history for client
   */
  getHistory(clientId: string): readonly VoxelCommand[] {
    return this.histories.get(clientId) ?? [];
  }

  /**
   * Clear history for client
   */
  clear(clientId: string): void {
    this.histories.delete(clientId);
    this.redoStacks.delete(clientId);
  }

  /**
   * Clear all history
   */
  clearAll(): void {
    this.histories.clear();
    this.redoStacks.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearAll();
  }
}

