/**
 * Voxel editing operations - authoritative server-side operations
 */
import type { VoxelPos } from './VoxelPosition.js';
/**
 * Voxel block type identifier
 */
export type BlockType = number;
/**
 * Voxel block metadata (color, rotation, etc.)
 */
export interface BlockMetadata {
    color?: number;
    rotation?: number;
    [key: string]: unknown;
}
/**
 * Base voxel operation
 */
export interface VoxelOperation {
    /** Server timestamp when operation was applied */
    timestamp: number;
    /** Client/user ID that initiated the operation */
    clientId: string;
}
/**
 * Place/Add voxel operation
 */
export interface PlaceVoxelOp extends VoxelOperation {
    type: 'place';
    position: VoxelPos;
    blockType: BlockType;
    metadata?: BlockMetadata;
}
/**
 * Remove/Break voxel operation
 */
export interface RemoveVoxelOp extends VoxelOperation {
    type: 'remove';
    position: VoxelPos;
    /** Previous block type (for undo) */
    previousBlockType?: BlockType;
    /** Previous metadata (for undo) */
    previousMetadata?: BlockMetadata;
}
/**
 * Paint voxel operation (change color/metadata without removing)
 */
export interface PaintVoxelOp extends VoxelOperation {
    type: 'paint';
    position: VoxelPos;
    metadata: BlockMetadata;
    /** Previous metadata (for undo) */
    previousMetadata?: BlockMetadata;
}
/**
 * Union type of all voxel operations
 */
export type VoxelOp = PlaceVoxelOp | RemoveVoxelOp | PaintVoxelOp;
/**
 * Batch of voxel operations (applied atomically)
 */
export interface VoxelOpBatch {
    /** Unique batch ID */
    batchId: string;
    /** Operations in this batch */
    operations: VoxelOp[];
    /** Server timestamp when batch was created */
    timestamp: number;
    /** Client/user ID that initiated the batch */
    clientId: string;
}
/**
 * Result of applying an operation
 */
export interface VoxelOpResult {
    success: boolean;
    /** Operation that was applied (may differ if server modified it) */
    operation: VoxelOp;
    /** Error message if failed */
    error?: string;
}
//# sourceMappingURL=VoxelOperations.d.ts.map