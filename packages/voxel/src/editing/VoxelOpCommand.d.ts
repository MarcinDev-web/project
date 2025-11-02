/**
 * Concrete VoxelCommand implementations for voxel operations
 */
import type { VoxelCommand } from './VoxelCommand.js';
import type { VoxelOp, VoxelOpResult } from './VoxelOperations.js';
import type { VoxelStore } from './VoxelStore.js';
import { VoxelDiff } from './VoxelDiff.js';
/**
 * Command wrapper for a voxel operation
 */
export declare class VoxelOpCommand implements VoxelCommand {
    readonly commandId: string;
    readonly clientId: string;
    readonly timestamp: number;
    private readonly op;
    private readonly diff;
    constructor(clientId: string, op: VoxelOp);
    execute(store: VoxelStore): VoxelOpResult;
    undo(store: VoxelStore): void;
    getDiff(): VoxelDiff;
    private executePlace;
    private executeRemove;
    private executePaint;
}
//# sourceMappingURL=VoxelOpCommand.d.ts.map