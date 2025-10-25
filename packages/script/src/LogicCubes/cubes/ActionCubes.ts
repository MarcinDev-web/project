/**
 * Action Cubes - Perform actions when triggered
 */

import { LogicCube } from './LogicCube';
import type { LogicCubeMetadata, LogicSignal } from '../types';
import { Logger } from '@engine/core/utils';

/**
 * SendMessage Action - Sends a message via event bus
 */
export class SendMessageAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'sendMessageAction',
      displayName: 'Send Message',
      category: 'action',
      description: 'Sends a message to the event bus',
      icon: 'message',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after message is sent',
        },
      ],
      parameters: [
        {
          key: 'message',
          label: 'Message',
          type: 'string',
          defaultValue: 'CustomEvent',
          description: 'Event name to send',
        },
        {
          key: 'data',
          label: 'Data (JSON)',
          type: 'string',
          defaultValue: '{}',
          description: 'JSON data to send with event',
        },
      ],
      color: [0.8, 0.4, 1], // Purple
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const message = this.getConfig<string>('message', 'CustomEvent');
    const dataStr = this.getConfig<string>('data', '{}');

    try {
      const data = JSON.parse(dataStr);
      this.scene.events.publish({ type: message, payload: data, sender: this.entity });
      Logger.info(`Logic cube sent message: ${message}`, data);
    } catch (error) {
      Logger.error(`Failed to send message from logic cube:`, error as Error);
      return null;
    }

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * SetVariable Action - Sets a variable value
 */
export class SetVariableAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'setVariableAction',
      displayName: 'Set Variable',
      category: 'action',
      description: 'Sets a variable to a value',
      icon: 'box',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
        {
          id: 'value',
          type: 'data',
          direction: 'input',
          label: 'Value',
          description: 'Value to set (optional)',
          dataType: 'any',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after variable is set',
        },
      ],
      parameters: [
        {
          key: 'variableName',
          label: 'Variable Name',
          type: 'string',
          defaultValue: 'myVariable',
          description: 'Name of the variable',
        },
        {
          key: 'value',
          label: 'Value',
          type: 'string',
          defaultValue: '0',
          description: 'Default value to set',
        },
        {
          key: 'valueType',
          label: 'Type',
          type: 'select',
          defaultValue: 'number',
          options: [
            { label: 'Number', value: 'number' },
            { label: 'String', value: 'string' },
            { label: 'Boolean', value: 'boolean' },
          ],
          description: 'Value type',
        },
      ],
      color: [0.2, 0.8, 1], // Cyan
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    // Get variable storage from scene (we'll need to access it through the system)
    // For now, log the action
    const variableName = this.getConfig<string>('variableName', 'myVariable');
    const valueStr = this.getConfig<string>('value', '0');
    const valueType = this.getConfig<string>('valueType', 'number');

    let value: string | number | boolean;
    try {
      if (valueType === 'number') {
        value = parseFloat(valueStr);
      } else if (valueType === 'boolean') {
        value = valueStr.toLowerCase() === 'true';
      } else {
        value = valueStr;
      }
    } catch (error) {
      Logger.error(`Failed to parse variable value:`, error as Error);
      return null;
    }

    // Store in entity state for now (will be connected to VariableStorage later)
    this.setState(`var_${variableName}`, value);
    Logger.info(`Logic cube set variable: ${variableName} = ${value}`);

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * SpawnEntity Action - Spawns an entity
 */
export class SpawnEntityAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'spawnEntityAction',
      displayName: 'Spawn Entity',
      category: 'action',
      description: 'Spawns a new entity',
      icon: 'plus',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after spawn',
        },
      ],
      parameters: [
        {
          key: 'prefabName',
          label: 'Prefab Name',
          type: 'string',
          defaultValue: 'Cube',
          description: 'Name of entity to spawn',
        },
        {
          key: 'offsetX',
          label: 'Offset X',
          type: 'number',
          defaultValue: 0,
          description: 'X position offset',
        },
        {
          key: 'offsetY',
          label: 'Offset Y',
          type: 'number',
          defaultValue: 2,
          description: 'Y position offset',
        },
        {
          key: 'offsetZ',
          label: 'Offset Z',
          type: 'number',
          defaultValue: 0,
          description: 'Z position offset',
        },
      ],
      color: [0.2, 1, 0.5], // Green-cyan
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const prefabName = this.getConfig<string>('prefabName', 'Cube');
    const offsetX = this.getConfig<number>('offsetX', 0);
    const offsetY = this.getConfig<number>('offsetY', 2);
    const offsetZ = this.getConfig<number>('offsetZ', 0);

    Logger.info(
      `Logic cube spawn entity: ${prefabName} at offset (${offsetX}, ${offsetY}, ${offsetZ})`
    );

    // Actual spawning logic would go here
    // For now, just log the action

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * DestroyEntity Action - Destroys an entity
 */
export class DestroyEntityAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'destroyEntityAction',
      displayName: 'Destroy Entity',
      category: 'action',
      description: 'Destroys this or another entity',
      icon: 'trash',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [],
      parameters: [
        {
          key: 'target',
          label: 'Target',
          type: 'select',
          defaultValue: 'self',
          options: [
            { label: 'Self', value: 'self' },
            { label: 'Other', value: 'other' },
          ],
          description: 'What to destroy',
        },
      ],
      color: [1, 0.3, 0.3], // Red
    };
  }

  onSignalReceived(portId: string): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const target = this.getConfig<string>('target', 'self');

    if (target === 'self') {
      Logger.info(`Logic cube destroying self: ${this.entity.id}`);
      // Schedule destruction (don't destroy immediately during signal processing)
      this.setState('scheduledForDestruction', true);
    }

    return null;
  }
}

/**
 * Log Action - Logs a message to console (useful for debugging)
 */
export class LogAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'logAction',
      displayName: 'Log Message',
      category: 'action',
      description: 'Logs a message to console',
      icon: 'terminal',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after logging',
        },
      ],
      parameters: [
        {
          key: 'message',
          label: 'Message',
          type: 'string',
          defaultValue: 'Hello World',
          description: 'Message to log',
        },
      ],
      color: [0.5, 0.5, 0.5], // Gray
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const message = this.getConfig<string>('message', 'Hello World');
    Logger.info(`[Logic Cube Log] ${message}`);

    // Pass signal through
    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

