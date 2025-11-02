/**
 * MicroBlockComponent - ECS component for entities with micro block structures
 */

import { Component, registerComponent } from '@engine/world';
import { MicroBlockStore } from './MicroBlockStore';
import type { MicroBlockComponentData } from './types';

/**
 * ECS component that holds a micro block store
 */
export class MicroBlockComponent extends Component {
  static readonly type = 'MicroBlock';

  /** The micro block store */
  store: MicroBlockStore;

  /** Chunk size (blocks per axis) */
  chunkSize: number;

  constructor(data?: { store?: MicroBlockStore; chunkSize?: number }) {
    super();
    this.chunkSize = data?.chunkSize ?? 16;
    this.store = data?.store ?? new MicroBlockStore(this.chunkSize);
  }

  getType(): string {
    return MicroBlockComponent.type;
  }

  clone(): MicroBlockComponent {
    const clone = new MicroBlockComponent({ chunkSize: this.chunkSize });
    
    // Deep copy the store
    clone.store.fromJSON(this.store.toJSON());
    
    return clone;
  }

  toJSON(): MicroBlockComponentData {
    return {
      storeData: this.store.toJSON(),
      chunkSize: this.chunkSize,
    };
  }

  fromJSON(data: MicroBlockComponentData): void {
    if (data.chunkSize) {
      this.chunkSize = data.chunkSize;
    }
    
    // Create new store if needed or reuse existing
    if (!this.store || this.store.chunkSize !== this.chunkSize) {
      this.store = new MicroBlockStore(this.chunkSize);
    }
    
    if (data.storeData) {
      this.store.fromJSON(data.storeData);
    }
  }

  dispose(): void {
    if (this.store) {
      this.store.dispose();
      // @ts-expect-error - Allow clearing reference after disposal
      this.store = null;
    }
  }
}

registerComponent(MicroBlockComponent.type, MicroBlockComponent);

