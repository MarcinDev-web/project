/**
 * LogicConnectionController - Handles in-world logic cube connection editing.
 */

import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import type { LogicConnectionManager } from '@engine/script';
import type { LogicPort } from '@engine/script';
import { LogicCubeComponent } from '@engine/script';
import { LogicCubeLibrary } from '../managers/LogicCubeLibrary';
import { Logger } from '../../utils/logger';

type ConnectionMode = 'idle' | 'selecting-source' | 'selecting-target';

/**
 * Controls logic cube connection creation in the editor
 */
export class LogicConnectionController {
  private connectionManager: LogicConnectionManager;
  private mode: ConnectionMode = 'idle';

  // Connection creation state
  private sourceEntity: Entity | null = null;
  private sourcePort: LogicPort | null = null;

  // Callbacks for UI feedback
  private onModeChanged?: (mode: ConnectionMode) => void;
  private onConnectionCreated?: () => void;

  constructor(
    _scene: Scene,
    connectionManager: LogicConnectionManager,
    callbacks?: {
      onModeChanged?: (mode: ConnectionMode) => void;
      onConnectionCreated?: () => void;
    }
  ) {
    this.connectionManager = connectionManager;
    if (callbacks?.onModeChanged) this.onModeChanged = callbacks.onModeChanged;
    if (callbacks?.onConnectionCreated) this.onConnectionCreated = callbacks.onConnectionCreated;
  }

  /**
   * Starts connection mode
   */
  startConnectionMode(): void {
    this.mode = 'selecting-source';
    this.onModeChanged?.('selecting-source');
    Logger.info('Connection mode: Select source cube');
  }

  /**
   * Cancels connection mode
   */
  cancel(): void {
    this.mode = 'idle';
    this.sourceEntity = null;
    this.sourcePort = null;
    this.onModeChanged?.('idle');
  }

  /**
   * Handles entity click for connection creation
   */
  handleEntityClick(entity: Entity): boolean {
    if (this.mode === 'idle') return false;

    const component = entity.getComponent(LogicCubeComponent);
    if (!component) {
      Logger.warn('Selected entity is not a logic cube');
      return false;
    }

    if (this.mode === 'selecting-source') {
      return this.handleSourceSelection(entity, component);
    } else if (this.mode === 'selecting-target') {
      return this.handleTargetSelection(entity, component);
    }

    return false;
  }

  /**
   * Handles source entity selection
   */
  private handleSourceSelection(entity: Entity, component: LogicCubeComponent): boolean {
    // Get cube metadata to find output ports
    const cubeType = component.getCubeType();
    const entry = LogicCubeLibrary.get(cubeType);

    if (!entry) {
      Logger.warn(`Unknown cube type: ${cubeType}`);
      return false;
    }

    const outputPorts = entry.metadata.outputs;
    if (outputPorts.length === 0) {
      Logger.warn('Selected cube has no output ports');
      return false;
    }

    // For now, use the first output port
    // TODO: Show port selection UI if multiple ports
    this.sourceEntity = entity;
    this.sourcePort = outputPorts[0] || null;

    this.mode = 'selecting-target';
    this.onModeChanged?.('selecting-target');
    Logger.info('Connection mode: Select target cube');

    return true;
  }

  /**
   * Handles target entity selection
   */
  private handleTargetSelection(entity: Entity, component: LogicCubeComponent): boolean {
    if (!this.sourceEntity || !this.sourcePort) {
      this.cancel();
      return false;
    }

    // Get cube metadata to find input ports
    const cubeType = component.getCubeType();
    const entry = LogicCubeLibrary.get(cubeType);

    if (!entry) {
      Logger.warn(`Unknown cube type: ${cubeType}`);
      return false;
    }

    const inputPorts = entry.metadata.inputs;
    if (inputPorts.length === 0) {
      Logger.warn('Selected cube has no input ports');
      return false;
    }

    // Find compatible input port
    let targetPort: LogicPort | null = null;
    for (const port of inputPorts) {
      // Check if port types are compatible
      if (this.arePortsCompatible(this.sourcePort, port)) {
        targetPort = port;
        break;
      }
    }

    if (!targetPort) {
      Logger.warn('No compatible input port found');
      return false;
    }

    // Validate and create connection
    const result = this.connectionManager.validateConnection(
      this.sourceEntity.id,
      this.sourcePort.id,
      entity.id,
      targetPort.id
    );

    if (result.valid) {
      this.connectionManager.addConnection(
        this.sourceEntity.id,
        this.sourcePort.id,
        entity.id,
        targetPort.id
      );

      Logger.info(
        `Created connection: ${this.sourceEntity.name}[${this.sourcePort.id}] → ${entity.name}[${targetPort.id}]`
      );

      this.onConnectionCreated?.();

      // Reset state
      this.cancel();
      return true;
    } else {
      Logger.warn('Cannot create connection:', result.reason);
      this.cancel();
      return false;
    }
  }

  /**
   * Checks if two ports are compatible for connection
   */
  private arePortsCompatible(outputPort: LogicPort, inputPort: LogicPort): boolean {
    // Output must connect to input
    if (outputPort.direction !== 'output' || inputPort.direction !== 'input') {
      return false;
    }

    // Port types must match or be compatible
    if (outputPort.type === inputPort.type) {
      return true;
    }

    // Data ports can accept any type
    if (inputPort.type === 'data') {
      return true;
    }

    return false;
  }

  /**
   * Deletes a connection by clicking on it
   */
  deleteConnectionBetween(sourceEntityId: string, targetEntityId: string): boolean {
    const connections = this.connectionManager.getConnectionsFromEntity(sourceEntityId);
    
    for (const conn of connections) {
      if (conn.targetEntityId === targetEntityId) {
        this.connectionManager.removeConnection(conn.id);
        Logger.info('Connection deleted');
        this.onConnectionCreated?.(); // Trigger refresh
        return true;
      }
    }

    return false;
  }

  /**
   * Gets current connection mode
   */
  getMode(): ConnectionMode {
    return this.mode;
  }

  /**
   * Gets current source entity (if selecting target)
   */
  getSourceEntity(): Entity | null {
    return this.sourceEntity;
  }

  /**
   * Gets all connections for an entity
   */
  getConnectionsForEntity(entityId: string): Array<{ sourceId: string; targetId: string; sourcePort: string; targetPort: string }> {
    const connections = this.connectionManager.getConnectionsForEntity(entityId);
    return connections.map((conn) => ({
      sourceId: conn.sourceEntityId,
      targetId: conn.targetEntityId,
      sourcePort: conn.sourcePort,
      targetPort: conn.targetPort,
    }));
  }
}

