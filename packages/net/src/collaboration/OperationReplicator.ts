import type { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { getComponentConstructor } from '@engine/world';
import { ReplicationClient } from '../ReplicationClient';
import type { Operation } from '../types/replication';
import type { Vec3 } from '@engine/core/math';

/**
 * Callback types for operation handlers.
 */
export type OnOperationAppliedCallback = (operation: Operation) => void;
export type OnOperationFailedCallback = (operation: Operation, error: Error) => void;

/**
 * Configuration for OperationReplicator.
 */
export interface OperationReplicatorConfig {
  /** Scene to operate on. */
  scene: Scene;
  /** Replication client for network communication. */
  replicationClient: ReplicationClient;
  /** Enable operation buffering for ordering. */
  enableBuffering?: boolean; // Default: true
  /** Buffer size for operations. */
  bufferSize?: number; // Default: 100
  /** Enable conflict resolution (last-write-wins). */
  enableConflictResolution?: boolean; // Default: true
}

/**
 * Replicates scene editing operations across network.
 * Handles:
 * - Entity creation/deletion
 * - Transform updates (position, rotation, scale)
 * - Component additions/removals/updates
 * - Operation ordering and conflict resolution
 */
export class OperationReplicator {
  private readonly config: Required<OperationReplicatorConfig>;
  private operationBuffer: Operation[] = [];
  private operationSequence = 0;
  private appliedOperations = new Set<string>(); // operation IDs to prevent duplicates
  private localUserId: string | null = null;

  // Event handlers
  private onOperationAppliedHandlers: OnOperationAppliedCallback[] = [];
  private onOperationFailedHandlers: OnOperationFailedCallback[] = [];

  constructor(config: OperationReplicatorConfig) {
    this.config = {
      enableBuffering: config.enableBuffering ?? true,
      bufferSize: config.bufferSize ?? 100,
      enableConflictResolution: config.enableConflictResolution ?? true,
      ...config,
    };

    // Subscribe to operations from network
    this.config.replicationClient.onOperation((operation) => {
      this.handleRemoteOperation(operation);
    });
  }

  /**
   * Replicate entity creation.
   */
  replicateEntityCreate(entity: Entity, parentId?: string): void {
    const operation: Operation = {
      id: `create_${entity.id}_${Date.now()}`,
      type: 'entity-create',
      timestamp: Date.now(),
      userId: this.getLocalUserId() ?? 'local',
      entityId: entity.id,
      data: {
        name: entity.name,
        position: [...entity.transform.position] as [number, number, number],
        rotation: [...entity.transform.rotation] as [number, number, number, number],
        scale: [...entity.transform.scale] as [number, number, number],
        parentId,
        // Serialize components (basic implementation)
        components: this.serializeEntityComponents(entity),
      },
    };

    this.sendOperation(operation);
  }

  /**
   * Replicate entity deletion.
   */
  replicateEntityDelete(entityId: string): void {
    const operation: Operation = {
      id: `delete_${entityId}_${Date.now()}`,
      type: 'entity-delete',
      timestamp: Date.now(),
      userId: this.getLocalUserId() ?? 'local',
      entityId,
      data: {},
    };

    this.sendOperation(operation);
  }

  /**
   * Replicate transform update.
   */
  replicateTransformUpdate(
    entityId: string,
    position?: Vec3,
    rotation?: [number, number, number, number],
    scale?: Vec3
  ): void {
    const operation: Operation = {
      id: `transform_${entityId}_${Date.now()}`,
      type: 'transform-update',
      timestamp: Date.now(),
      userId: this.getLocalUserId() ?? 'local',
      entityId,
      data: {
        ...(position && { position: [...position] as [number, number, number] }),
        ...(rotation && { rotation }),
        ...(scale && { scale: [...scale] as [number, number, number] }),
      },
    };

    this.sendOperation(operation);
  }

  /**
   * Replicate component update.
   */
  replicateComponentUpdate(
    entityId: string,
    componentType: string,
    componentData: Record<string, unknown>
  ): void {
    const operation: Operation = {
      id: `component_${entityId}_${componentType}_${Date.now()}`,
      type: 'component-update',
      timestamp: Date.now(),
      userId: this.getLocalUserId() ?? 'local',
      entityId,
      data: {
        componentType,
        componentData,
      },
    };

    this.sendOperation(operation);
  }

  /**
   * Replicate selection change.
   */
  replicateSelectionChange(selectedEntityIds: string[]): void {
    const operation: Operation = {
      id: `selection_${Date.now()}`,
      type: 'selection-change',
      timestamp: Date.now(),
      userId: this.getLocalUserId() ?? 'local',
      data: {
        selectedEntityIds,
      },
    };

    this.sendOperation(operation);
  }

  /**
   * Send operation to network.
   */
  private sendOperation(operation: Operation): void {
    // Set sequence number
    operation.data.sequence = this.operationSequence++;

    // Send via replication client
    this.config.replicationClient.sendOperation(operation);

    // Buffer for retransmission if enabled
    if (this.config.enableBuffering) {
      this.bufferOperation(operation);
    }
  }

  /**
   * Handle remote operation from network.
   */
  private handleRemoteOperation(operation: Operation): void {
    // Ignore operations from self
    if (operation.userId === this.getLocalUserId()) {
      return;
    }

    // Check if already applied (prevent duplicates)
    if (this.appliedOperations.has(operation.id)) {
      return;
    }

    try {
      this.applyOperation(operation);
      this.appliedOperations.add(operation.id);

      // Cleanup old operations (keep last N)
      if (this.appliedOperations.size > this.config.bufferSize * 2) {
        const operationsArray = Array.from(this.appliedOperations);
        const toRemove = operationsArray.slice(0, operationsArray.length - this.config.bufferSize);
        for (const id of toRemove) {
          this.appliedOperations.delete(id);
        }
      }

      // Notify handlers
      this.onOperationAppliedHandlers.forEach((cb) => cb(operation));
    } catch (error) {
      console.error('Failed to apply operation:', error);
      this.onOperationFailedHandlers.forEach((cb) => cb(operation, error as Error));
    }
  }

  /**
   * Apply operation to scene.
   */
  private applyOperation(operation: Operation): void {
    switch (operation.type) {
      case 'entity-create':
        this.applyEntityCreate(operation);
        break;
      case 'entity-delete':
        this.applyEntityDelete(operation);
        break;
      case 'transform-update':
        this.applyTransformUpdate(operation);
        break;
      case 'component-update':
        this.applyComponentUpdate(operation);
        break;
      case 'selection-change':
        // Selection changes are usually local-only, but we can optionally sync them
        // For now, we'll skip them as they're UI state
        break;
      default:
        console.warn('Unknown operation type:', operation.type);
    }
  }

  /**
   * Apply entity creation operation.
   */
  private applyEntityCreate(operation: Operation): void {
    if (!operation.entityId || !operation.data) {
      throw new Error('Invalid entity-create operation');
    }

    // Check if entity already exists (conflict resolution)
    const existing = this.config.scene.findEntityById(operation.entityId);
    if (existing) {
      if (this.config.enableConflictResolution) {
        // Last-write-wins: update existing entity
        this.updateEntityFromOperation(existing, operation);
        return;
      } else {
        throw new Error(`Entity ${operation.entityId} already exists`);
      }
    }

    // Create new entity
    const entity = new Entity(
      operation.data.name as string || 'Entity',
      undefined,
      operation.entityId
    );

    // Set transform
    if (operation.data.position) {
      entity.transform.position = operation.data.position as Vec3;
    }
    if (operation.data.rotation) {
      entity.transform.rotation = operation.data.rotation as [number, number, number, number];
    }
    if (operation.data.scale) {
      entity.transform.scale = operation.data.scale as Vec3;
    }

    // Set parent if specified
    if (operation.data.parentId) {
      const parent = this.config.scene.findEntityById(operation.data.parentId as string);
      if (parent) {
        parent.addChild(entity);
      }
    }

    // Add components (basic implementation)
    if (operation.data.components) {
      this.deserializeEntityComponents(entity, operation.data.components as Record<string, unknown>);
    }

    // Add to scene
    this.config.scene.addEntity(entity);
  }

  /**
   * Apply entity deletion operation.
   */
  private applyEntityDelete(operation: Operation): void {
    if (!operation.entityId) {
      throw new Error('Invalid entity-delete operation');
    }

    const entity = this.config.scene.findEntityById(operation.entityId);
    if (entity) {
      this.config.scene.removeEntity(entity);
    }
    // If entity doesn't exist, it's already deleted - no error
  }

  /**
   * Apply transform update operation.
   */
  private applyTransformUpdate(operation: Operation): void {
    if (!operation.entityId || !operation.data) {
      throw new Error('Invalid transform-update operation');
    }

    const entity = this.config.scene.findEntityById(operation.entityId);
    if (!entity) {
      throw new Error(`Entity ${operation.entityId} not found`);
    }

    if (operation.data.position) {
      entity.transform.position = operation.data.position as Vec3;
    }
    if (operation.data.rotation) {
      entity.transform.rotation = operation.data.rotation as [number, number, number, number];
    }
    if (operation.data.scale) {
      entity.transform.scale = operation.data.scale as Vec3;
    }
  }

  /**
   * Apply component update operation.
   * 
   * Note: Full component deserialization requires a component registry system
   * to map string names to Component classes. This implementation handles updates
   * to existing components via fromJSON(). For creating new components, a registry
   * would need to be added (e.g., Map<string, ComponentClass>).
   */
  private applyComponentUpdate(operation: Operation): void {
    if (!operation.entityId || !operation.data) {
      throw new Error('Invalid component-update operation');
    }

    const entity = this.config.scene.findEntityById(operation.entityId);
    if (!entity) {
      throw new Error(`Entity ${operation.entityId} not found`);
    }

    const componentType = operation.data.componentType as string;
    const componentData = operation.data.componentData as Record<string, unknown>;

    // Try to find existing component and update it
    // Note: This is a simplified approach - in a full implementation, you would:
    // 1. Maintain a component registry (Map<string, ComponentClass>)
    // 2. Look up the component class by name
    // 3. Check if component exists, if not create new instance
    // 4. Call fromJSON() on the component instance
    
    // Use component registry to get component class
    const ComponentClass = getComponentConstructor(componentType);
    
    if (ComponentClass) {
      // Check if entity already has this component
      let component = entity.getComponent(ComponentClass);
      
      if (component) {
        // Component exists - update via fromJSON if available
        const componentWithFromJSON = component as unknown as { fromJSON?: (data: unknown) => void };
        if (typeof componentWithFromJSON.fromJSON === 'function') {
          try {
            componentWithFromJSON.fromJSON(componentData);
          } catch (error) {
            console.error(`Failed to deserialize component ${componentType}:`, error);
            throw error;
          }
        } else {
          console.warn(`Component ${componentType} does not support fromJSON() - cannot update`);
        }
      } else {
        // Component doesn't exist - try to create and add it
        try {
          const newComponent = new ComponentClass();
          // Try to hydrate from JSON if supported
          const componentWithFromJSON = newComponent as unknown as { fromJSON?: (data: unknown) => void };
          if (typeof componentWithFromJSON.fromJSON === 'function') {
            componentWithFromJSON.fromJSON(componentData);
          }
          entity.addComponent(newComponent);
        } catch (error) {
          console.error(`Failed to create component ${componentType}:`, error);
          throw error;
        }
      }
    } else {
      // Component type not found in registry
      console.warn(`Component type ${componentType} not found in component registry. ` +
        `Make sure the component is registered.`);
    }
  }

  /**
   * Update entity from operation data.
   */
  private updateEntityFromOperation(entity: Entity, operation: Operation): void {
    if (operation.data.position) {
      entity.transform.position = operation.data.position as Vec3;
    }
    if (operation.data.rotation) {
      entity.transform.rotation = operation.data.rotation as [number, number, number, number];
    }
    if (operation.data.scale) {
      entity.transform.scale = operation.data.scale as Vec3;
    }
  }

  /**
   * Serialize entity components (basic implementation).
   */
  private serializeEntityComponents(_entity: Entity): Record<string, unknown> {
    // Basic implementation - serialize component types
    // In a full implementation, this would serialize all component data
    const components: Record<string, unknown> = {};
    
    // Get all components (this is a simplified version)
    // In reality, you'd iterate through registered components
    return components;
  }

  /**
   * Deserialize entity components (basic implementation).
   */
  private deserializeEntityComponents(_entity: Entity, _componentsData: Record<string, unknown>): void {
    // Basic implementation - deserialize components
    // In a full implementation, this would recreate components from data
    // For now, components are created elsewhere
  }

  /**
   * Buffer operation for retransmission.
   */
  private bufferOperation(operation: Operation): void {
    if (this.operationBuffer.length >= this.config.bufferSize) {
      this.operationBuffer.shift();
    }
    this.operationBuffer.push(operation);
  }

  /**
   * Set local user ID.
   */
  setLocalUserId(userId: string): void {
    this.localUserId = userId;
  }

  /**
   * Get local user ID.
   */
  private getLocalUserId(): string | null {
    return this.localUserId;
  }

  /**
   * Register event handlers.
   */
  onOperationApplied(callback: OnOperationAppliedCallback): () => void {
    this.onOperationAppliedHandlers.push(callback);
    return () => {
      const index = this.onOperationAppliedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onOperationAppliedHandlers.splice(index, 1);
      }
    };
  }

  onOperationFailed(callback: OnOperationFailedCallback): () => void {
    this.onOperationFailedHandlers.push(callback);
    return () => {
      const index = this.onOperationFailedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onOperationFailedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Cleanup - call when operation replicator is no longer needed.
   */
  dispose(): void {
    this.operationBuffer = [];
    this.appliedOperations.clear();
    this.onOperationAppliedHandlers = [];
    this.onOperationFailedHandlers = [];
  }
}

