/**
 * UI Cubes - Logic cubes for UI element interactions
 */

import { LogicCube } from './LogicCube.js';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types.js';
import { Logger } from '@engine/core/utils';
import { UIElementComponent } from '@engine/world/components/UIElementComponent';
import { getLogicConnectionManager } from '../../connection/index.js';

/**
 * UIButtonClick Trigger - Fires when a UI button is clicked
 */
export class UIButtonClickTrigger extends LogicCube {
  private clickHandler: ((event: any) => void) | null = null;

  getMetadata(): LogicCubeMetadata {
    return {
      type: 'uiButtonClick',
      displayName: 'UI Button Click',
      category: 'trigger',
      description: 'Triggers when a UI button with specified elementId is clicked',
      icon: 'mouse-pointer',
      inputs: [],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'On Click',
          description: 'Fires when button is clicked',
        },
        {
          id: 'elementId',
          type: 'data',
          direction: 'output',
          label: 'Element ID',
          description: 'ID of clicked element',
          dataType: 'string',
        },
      ],
      parameters: [
        {
          key: 'elementId',
          label: 'Element ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of UI button element to listen for',
        },
      ],
      color: [0.2, 0.8, 1], // Cyan
    };
  }

  override onInit(): void {
    super.onInit();
    this.setupClickHandler();
  }

  override onDestroy(): void {
    super.onDestroy();
    this.removeClickHandler();
  }

  private setupClickHandler(): void {
    if (this.clickHandler) return;

    const elementId = this.getConfig<string>('elementId', '');
    if (!elementId) return;

    this.clickHandler = (event: { elementId: string; entity: any; component: UIElementComponent }) => {
      if (event.elementId === elementId && this.enabled && !this.isOnCooldown()) {
        // Emit signals through event bus - LogicCubeSystem will process them
        const connectionManager = getLogicConnectionManager(this.scene);
        if (connectionManager) {
          const triggerSignal: LogicSignal = {
            type: 'trigger',
            sourceEntityId: this.entity.id,
            timestamp: Date.now(),
          };
          const stringSignal: LogicSignal = {
            type: 'data',
            sourceEntityId: this.entity.id,
            timestamp: Date.now(),
            data: elementId,
          };
          
          // Emit trigger signal to connected cubes
          const connections = connectionManager.getConnectionsFromPort(this.entity.id, 'output');
          for (const conn of connections) {
            this.scene.events.publish({
              type: 'logic:signal',
              payload: {
                targetEntityId: conn.targetEntityId,
                targetPort: conn.targetPort,
                signal: triggerSignal,
              },
              sender: this.entity,
            });
          }
          
          // Emit elementId string signal
          const stringConnections = connectionManager.getConnectionsFromPort(this.entity.id, 'elementId');
          for (const conn of stringConnections) {
            this.scene.events.publish({
              type: 'logic:signal',
              payload: {
                targetEntityId: conn.targetEntityId,
                targetPort: conn.targetPort,
                signal: stringSignal,
              },
              sender: this.entity,
            });
          }
        }
      }
    };

    this.scene.events.on('ui:element:click', this.clickHandler);
  }

  private removeClickHandler(): void {
    if (this.clickHandler) {
      this.scene.events.off('ui:element:click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  onSignalReceived(_portId: string, _signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null {
    // This cube doesn't receive signals, it generates them on UI click
    return null;
  }
}

/**
 * UIShowElement Action - Show or hide a UI element
 */
export class UIShowElementAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'uiShowElement',
      displayName: 'Show/Hide UI Element',
      category: 'action',
      description: 'Shows or hides a UI element by elementId',
      icon: 'eye',
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
          description: 'Fires after element visibility is changed',
        },
      ],
      parameters: [
        {
          key: 'elementId',
          label: 'Element ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of UI element to show/hide',
        },
        {
          key: 'visible',
          label: 'Visible',
          type: 'boolean',
          defaultValue: true,
          description: 'Whether to show (true) or hide (false) the element',
        },
      ],
      color: [0.8, 0.4, 1], // Purple
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const elementId = this.getConfig<string>('elementId', '');
    const visible = this.getConfig<boolean>('visible', true);

    if (!elementId) {
      Logger.warn('UIShowElementAction: elementId not specified');
      return null;
    }

    // Find UI element entity
    const elementEntities = this.scene.queryEntities(UIElementComponent);
    for (const entity of elementEntities) {
      const component = entity.getComponent(UIElementComponent);
      if (component && component.elementId === elementId) {
        component.visible = visible;
        Logger.debug(`UI element ${elementId} visibility set to ${visible}`);
        break;
      }
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
 * UISetText Action - Set text content of a UI element
 */
export class UISetTextAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'uiSetText',
      displayName: 'Set UI Text',
      category: 'action',
      description: 'Sets the text content of a UI text or button element',
      icon: 'type',
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
          description: 'Fires after text is set',
        },
      ],
      parameters: [
        {
          key: 'elementId',
          label: 'Element ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of UI element to update',
        },
        {
          key: 'text',
          label: 'Text',
          type: 'string',
          defaultValue: '',
          description: 'Text content to set',
        },
      ],
      color: [0.8, 0.4, 1], // Purple
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const elementId = this.getConfig<string>('elementId', '');
    const text = this.getConfig<string>('text', '');

    if (!elementId) {
      Logger.warn('UISetTextAction: elementId not specified');
      return null;
    }

    // Find UI element entity
    const elementEntities = this.scene.queryEntities(UIElementComponent);
    for (const entity of elementEntities) {
      const component = entity.getComponent(UIElementComponent);
      if (component && component.elementId === elementId) {
        if (component.type === 'button') {
          component.buttonText = text;
        } else if (component.type === 'text' || component.type === 'input') {
          component.textContent = text;
        }
        Logger.debug(`UI element ${elementId} text set to: ${text}`);
        break;
      }
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
 * UISetImage Action - Set image URL of a UI image element
 */
export class UISetImageAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'uiSetImage',
      displayName: 'Set UI Image',
      category: 'action',
      description: 'Sets the image URL of a UI image element',
      icon: 'image',
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
          description: 'Fires after image is set',
        },
      ],
      parameters: [
        {
          key: 'elementId',
          label: 'Element ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of UI image element to update',
        },
        {
          key: 'imageUrl',
          label: 'Image URL',
          type: 'string',
          defaultValue: '',
          description: 'URL or path to image',
        },
      ],
      color: [0.8, 0.4, 1], // Purple
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const elementId = this.getConfig<string>('elementId', '');
    const imageUrl = this.getConfig<string>('imageUrl', '');

    if (!elementId) {
      Logger.warn('UISetImageAction: elementId not specified');
      return null;
    }

    // Find UI element entity
    const elementEntities = this.scene.queryEntities(UIElementComponent);
    for (const entity of elementEntities) {
      const component = entity.getComponent(UIElementComponent);
      if (component && component.elementId === elementId && component.type === 'image') {
        component.imageUrl = imageUrl;
        Logger.debug(`UI element ${elementId} image set to: ${imageUrl}`);
        break;
      }
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
 * UISetValue Action - Set value of a UI slider/progress/input element
 */
export class UISetValueAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'uiSetValue',
      displayName: 'Set UI Value',
      category: 'action',
      description: 'Sets the value of a UI slider, progress bar, or input element',
      icon: 'sliders',
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
          description: 'Fires after value is set',
        },
      ],
      parameters: [
        {
          key: 'elementId',
          label: 'Element ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of UI element to update',
        },
        {
          key: 'value',
          label: 'Value',
          type: 'number',
          defaultValue: 0,
          description: 'Value to set (0-1 for progress, min-max for slider)',
        },
      ],
      color: [0.8, 0.4, 1], // Purple
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const elementId = this.getConfig<string>('elementId', '');
    const value = this.getConfig<number>('value', 0);

    if (!elementId) {
      Logger.warn('UISetValueAction: elementId not specified');
      return null;
    }

    // Find UI element entity
    const elementEntities = this.scene.queryEntities(UIElementComponent);
    for (const entity of elementEntities) {
      const component = entity.getComponent(UIElementComponent);
      if (component && component.elementId === elementId) {
        if (component.type === 'progress') {
          component.value = Math.max(0, Math.min(1, value));
        } else if (component.type === 'slider' || component.type === 'input') {
          component.value = value;
        }
        Logger.debug(`UI element ${elementId} value set to: ${value}`);
        break;
      }
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
 * UIEnableElement Action - Enable or disable a UI element
 */
export class UIEnableElementAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'uiEnableElement',
      displayName: 'Enable/Disable UI Element',
      category: 'action',
      description: 'Enables or disables a UI element by elementId',
      icon: 'toggle-left',
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
          description: 'Fires after element is enabled/disabled',
        },
      ],
      parameters: [
        {
          key: 'elementId',
          label: 'Element ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of UI element to enable/disable',
        },
        {
          key: 'enabled',
          label: 'Enabled',
          type: 'boolean',
          defaultValue: true,
          description: 'Whether to enable (true) or disable (false) the element',
        },
      ],
      color: [0.8, 0.4, 1], // Purple
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const elementId = this.getConfig<string>('elementId', '');
    const enabled = this.getConfig<boolean>('enabled', true);

    if (!elementId) {
      Logger.warn('UIEnableElementAction: elementId not specified');
      return null;
    }

    // Find UI element entity
    const elementEntities = this.scene.queryEntities(UIElementComponent);
    for (const entity of elementEntities) {
      const component = entity.getComponent(UIElementComponent);
      if (component && component.elementId === elementId) {
        component.enabled = enabled;
        Logger.debug(`UI element ${elementId} enabled set to ${enabled}`);
        break;
      }
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

