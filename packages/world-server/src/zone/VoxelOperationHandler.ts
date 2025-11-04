/**
 * VoxelOperationHandler - Handles voxel operations in zone server
 */

import type { ZoneServer } from './ZoneServer.js';
import { EditScope } from '@engine/net-protocol';
import type { VoxelStore } from '@engine/voxel';
import type { VoxelOp, VoxelOpBatch, VoxelOpResult } from '@engine/voxel';
import { VoxelCommandHistory, VoxelOpCommand } from '@engine/voxel';
import type { TelemetryCollector, TelemetryGameEvent } from '../telemetry/GameTelemetry.js';

/**
 * Handler for voxel operations in a zone
 */
export class VoxelOperationHandler {
  private readonly zoneServer: ZoneServer;
  private readonly voxelStore: VoxelStore;
  private readonly commandHistory: VoxelCommandHistory;
  private readonly telemetry: TelemetryCollector | undefined;
  private readonly zoneId: string;

  constructor(
    zoneServer: ZoneServer,
    voxelStore: VoxelStore,
    zoneId: string,
    telemetry?: TelemetryCollector
  ) {
    this.zoneServer = zoneServer;
    this.voxelStore = voxelStore;
    this.zoneId = zoneId;
    this.telemetry = telemetry;
    this.commandHistory = new VoxelCommandHistory();
  }

  /**
   * Process a voxel operation batch from a client
   */
  processBatch(clientId: string, batch: VoxelOpBatch): VoxelOpResult[] {
    // Check permissions
    if (!this.zoneServer.canPerformVoxelOp(clientId)) {
      return batch.operations.map((op: VoxelOp) => ({
        success: false,
        operation: op,
        error: 'Permission denied or rate limit exceeded',
      }));
    }

    const results: VoxelOpResult[] = [];

    // Process each operation in batch
    for (const op of batch.operations) {
      const result = this.processOperation(clientId, op);
      results.push(result);

      if (result.success) {
        this.zoneServer.recordVoxelOp(clientId);

        // Emit telemetry
        if (this.telemetry) {
          this.emitVoxelOpTelemetry(clientId, op);
        }
      }
    }

    return results;
  }

  /**
   * Process a single voxel operation (creates command and executes it)
   */
  private processOperation(clientId: string, op: VoxelOp): VoxelOpResult {
    try {
      // Create command from operation
      const command = new VoxelOpCommand(clientId, op);
      
      // Execute command
      const result = command.execute(this.voxelStore);
      
      // If successful, add to history for undo/redo
      if (result.success) {
        this.commandHistory.push(clientId, command);
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        operation: op,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Undo last operation for client
   */
  undoOperation(clientId: string): boolean {
    if (!this.zoneServer.hasScope(clientId, EditScope.VOXEL_EDIT)) {
      return false;
    }

    // Command history undo is per-client
    const command = this.commandHistory.undo(clientId, this.voxelStore);
    return command !== null;
  }

  /**
   * Redo last undone operation for client
   */
  redoOperation(clientId: string): boolean {
    if (!this.zoneServer.hasScope(clientId, EditScope.VOXEL_EDIT)) {
      return false;
    }

    const command = this.commandHistory.redo(clientId, this.voxelStore);
    return command !== null;
  }

  /**
   * Get voxel store (for snapshot/versioning)
   */
  getStore(): VoxelStore {
    return this.voxelStore;
  }

  /**
   * Emit voxel operation telemetry
   */
  private emitVoxelOpTelemetry(clientId: string, op: VoxelOp): void {
    if (!this.telemetry) return;

    const role = this.zoneServer.getClientRole(clientId);
    if (!role) return;

    const userId = clientId; // TODO: Get actual userId from client state

    const event: TelemetryGameEvent = {
      type: op.type === 'place' ? 'voxel:place' : op.type === 'remove' ? 'voxel:remove' : 'voxel:paint',
      timestamp: Date.now(),
      userId,
      zoneId: this.zoneId,
      position: op.position,
      ...(op.type === 'place' && op.blockType !== undefined && { blockType: op.blockType }),
    };

    this.telemetry.emit(event);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.commandHistory.dispose();
  }
}


