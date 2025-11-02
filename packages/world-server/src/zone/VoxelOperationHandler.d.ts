/**
 * VoxelOperationHandler - Handles voxel operations in zone server
 */
import type { ZoneServer } from './ZoneServer.js';
import type { VoxelStore } from '@engine/voxel';
import type { VoxelOpBatch, VoxelOpResult } from '@engine/voxel';
import type { TelemetryCollector } from '../telemetry/GameTelemetry.js';
/**
 * Handler for voxel operations in a zone
 */
export declare class VoxelOperationHandler {
    private readonly zoneServer;
    private readonly voxelStore;
    private readonly commandHistory;
    private readonly telemetry;
    private readonly zoneId;
    constructor(zoneServer: ZoneServer, voxelStore: VoxelStore, zoneId: string, telemetry?: TelemetryCollector);
    /**
     * Process a voxel operation batch from a client
     */
    processBatch(clientId: string, batch: VoxelOpBatch): VoxelOpResult[];
    /**
     * Process a single voxel operation (creates command and executes it)
     */
    private processOperation;
    /**
     * Undo last operation for client
     */
    undoOperation(clientId: string): boolean;
    /**
     * Redo last undone operation for client
     */
    redoOperation(clientId: string): boolean;
    /**
     * Get voxel store (for snapshot/versioning)
     */
    getStore(): VoxelStore;
    /**
     * Emit voxel operation telemetry
     */
    private emitVoxelOpTelemetry;
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=VoxelOperationHandler.d.ts.map