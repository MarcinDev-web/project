/**
 * MicroBlockComponent - ECS component for entities with micro block structures
 */
import { Component } from '@engine/world';
import { MicroBlockStore } from './MicroBlockStore';
import type { MicroBlockComponentData } from './types';
/**
 * ECS component that holds a micro block store
 */
export declare class MicroBlockComponent extends Component {
    static readonly type = "MicroBlock";
    /** The micro block store */
    store: MicroBlockStore;
    /** Chunk size (blocks per axis) */
    chunkSize: number;
    constructor(data?: {
        store?: MicroBlockStore;
        chunkSize?: number;
    });
    getType(): string;
    clone(): MicroBlockComponent;
    toJSON(): MicroBlockComponentData;
    fromJSON(data: MicroBlockComponentData): void;
    dispose(): void;
}
//# sourceMappingURL=MicroBlockComponent.d.ts.map