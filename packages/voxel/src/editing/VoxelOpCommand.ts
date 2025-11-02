/**
 * Concrete VoxelCommand implementations for voxel operations
 */

import type { VoxelCommand } from './VoxelCommand.js';
import type { VoxelOp, VoxelOpResult, BlockMetadata } from './VoxelOperations.js';
import type { VoxelStore } from './VoxelStore.js';
import { VoxelDiff } from './VoxelDiff.js';

/**
 * Command wrapper for a voxel operation
 */
export class VoxelOpCommand implements VoxelCommand {
  readonly commandId: string;
  readonly clientId: string;
  readonly timestamp: number;
  private readonly op: VoxelOp;
  private readonly diff: VoxelDiff;

  constructor(clientId: string, op: VoxelOp) {
    this.commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.clientId = clientId;
    this.timestamp = Date.now();
    this.op = op;
    this.diff = new VoxelDiff();
  }

  execute(store: VoxelStore): VoxelOpResult {
    // Record before state
    const before = store.getVoxel(this.op.position);

    // Execute operation
    let result: VoxelOpResult;
    switch (this.op.type) {
      case 'place':
        result = this.executePlace(store);
        break;
      case 'remove':
        result = this.executeRemove(store, before);
        break;
      case 'paint':
        result = this.executePaint(store, before);
        break;
      default:
        result = {
          success: false,
          operation: this.op,
          error: 'Unknown operation type',
        };
    }

    // Record after state if successful
    if (result.success) {
      const after = store.getVoxel(this.op.position);
      this.diff.recordChange(
        this.op.position,
        before?.blockType ?? null,
        after?.blockType ?? null,
        before?.metadata,
        after?.metadata
      );
    }

    return result;
  }

  undo(store: VoxelStore): void {
    // Reverse the diff
    const reversed = this.diff.reverse();
    reversed.applyToStore(store);
  }

  getDiff(): VoxelDiff {
    return this.diff;
  }

  private executePlace(store: VoxelStore): VoxelOpResult {
    if (this.op.type !== 'place') {
      return {
        success: false,
        operation: this.op,
        error: 'Invalid operation type for executePlace',
      };
    }

    const data: { blockType: number; metadata?: BlockMetadata } = {
      blockType: this.op.blockType,
    };
    if (this.op.metadata !== undefined) {
      data.metadata = this.op.metadata;
    }

    store.setVoxel(this.op.position, data);

    return {
      success: true,
      operation: this.op,
    };
  }

  private executeRemove(store: VoxelStore, before: ReturnType<VoxelStore['getVoxel']>): VoxelOpResult {
    if (!before) {
      return {
        success: false,
        operation: this.op,
        error: 'No block at position',
      };
    }

    if (this.op.type === 'remove') {
      // Store previous for undo
      this.op.previousBlockType = before.blockType;
      if (before.metadata !== undefined) {
        this.op.previousMetadata = before.metadata;
      }
    }

    store.setVoxel(this.op.position, null);
    return {
      success: true,
      operation: this.op,
    };
  }

  private executePaint(store: VoxelStore, before: ReturnType<VoxelStore['getVoxel']>): VoxelOpResult {
    if (!before) {
      return {
        success: false,
        operation: this.op,
        error: 'No block at position to paint',
      };
    }

    if (this.op.type === 'paint') {
      if (before.metadata !== undefined) {
        this.op.previousMetadata = before.metadata;
      }

      const mergedMetadata: BlockMetadata = {
        ...(before.metadata ?? {}),
        ...this.op.metadata,
      };

      store.setVoxel(this.op.position, {
        blockType: before.blockType,
        metadata: mergedMetadata,
      });
    }

    return {
      success: true,
      operation: this.op,
    };
  }
}

