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
export declare class VoxelCommandHistory {
    /** History per client */
    private readonly histories;
    /** Redo stacks per client */
    private readonly redoStacks;
    /** Max history size per client */
    private readonly maxHistorySize;
    constructor(maxHistorySize?: number);
    /**
     * Add command to history
     */
    push(clientId: string, command: VoxelCommand): void;
    /**
     * Undo last command for client
     */
    undo(clientId: string, store: VoxelStore): VoxelCommand | null;
    /**
     * Redo last undone command for client
     */
    redo(clientId: string, store: VoxelStore): VoxelCommand | null;
    /**
     * Get history for client
     */
    getHistory(clientId: string): readonly VoxelCommand[];
    /**
     * Clear history for client
     */
    clear(clientId: string): void;
    /**
     * Clear all history
     */
    clearAll(): void;
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=VoxelCommand.d.ts.map