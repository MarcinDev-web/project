/**
 * LogicConnectionController - Handles in-world logic cube connection editing.
 */

import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import type { LogicConnectionManager } from '@engine/script';
import type { LogicPort } from '@engine/script';
import { LogicCubeComponent } from '@engine/script';
import { LogicCubeLibrary } from '@engine/editor-utils';
import { Logger } from '../../utils/logger';
import { showPortSelectionModal } from '../ui/modals/PortSelectionModal';

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
   * Returns a promise that resolves to true if the click was handled, false otherwise.
   */
  async handleEntityClick(entity: Entity): Promise<boolean> {
    if (this.mode === 'idle') return false;

    const component = entity.getComponent(LogicCubeComponent);
    if (!component) {
      Logger.warn('Selected entity is not a logic cube');
      return false;
    }

    if (this.mode === 'selecting-source') {
      return await this.handleSourceSelection(entity, component);
    } else if (this.mode === 'selecting-target') {
      return await this.handleTargetSelection(entity, component);
    }

    return false;
  }

  /**
   * Handles source entity selection
   */
  private async handleSourceSelection(entity: Entity, component: LogicCubeComponent): Promise<boolean> {
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

    // If only one port, use it directly
    if (outputPorts.length === 1) {
      this.sourceEntity = entity;
      this.sourcePort = outputPorts[0] || null;
      this.mode = 'selecting-target';
      this.onModeChanged?.('selecting-target');
      Logger.info('Connection mode: Select target cube');
      return true;
    }

    // Multiple ports - show selection UI
    const selectedPort = await showPortSelectionModal({
      title: 'Select Output Port',
      message: 'This cube has multiple output ports. Select which one to use:',
      ports: outputPorts,
      entityName: entity.name,
    });

    if (!selectedPort) {
      // User cancelled
      Logger.info('Port selection cancelled');
      return false;
    }

    this.sourceEntity = entity;
    this.sourcePort = selectedPort;
    this.mode = 'selecting-target';
    this.onModeChanged?.('selecting-target');
    Logger.info(`Connection mode: Select target cube (using port: ${selectedPort.label || selectedPort.id})`);

    return true;
  }

  /**
   * Handles target entity selection
   */
  private async handleTargetSelection(entity: Entity, component: LogicCubeComponent): Promise<boolean> {
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

    // Find compatible input ports
    const compatiblePorts: LogicPort[] = [];
    for (const port of inputPorts) {
      if (this.arePortsCompatible(this.sourcePort, port)) {
        compatiblePorts.push(port);
      }
    }

    if (compatiblePorts.length === 0) {
      Logger.warn('No compatible input port found');
      return false;
    }

    // Select target port
    let targetPort: LogicPort | null = null;

    if (compatiblePorts.length === 1) {
      targetPort = compatiblePorts[0] || null;
    } else {
      // Multiple compatible ports - show selection UI
      targetPort = await showPortSelectionModal({
        title: 'Select Input Port',
        message: 'This cube has multiple compatible input ports. Select which one to use:',
        ports: compatiblePorts,
        entityName: entity.name,
      });

      if (!targetPort) {
        Logger.info('Target port selection cancelled');
        return false;
      }
    }

    if (!targetPort) return false;

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

