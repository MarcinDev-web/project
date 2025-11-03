/**
 * Condition Cubes - Evaluate conditions and route signals
 */

import { LogicCube } from './LogicCube.js';
import type { LogicCubeMetadata, LogicSignal } from './types.js';

/**
 * CompareVariable Condition - Compares a variable to a value
 */
export class CompareVariableCondition extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'compareVariableCondition',
      displayName: 'Compare Variable',
      category: 'condition',
      description: 'Compares a variable to a value',
      icon: 'compare',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Evaluate condition',
        },
      ],
      outputs: [
        {
          id: 'true',
          type: 'trigger',
          direction: 'output',
          label: 'True',
          description: 'Condition is true',
        },
        {
          id: 'false',
          type: 'trigger',
          direction: 'output',
          label: 'False',
          description: 'Condition is false',
        },
      ],
      parameters: [
        {
          key: 'variableName',
          label: 'Variable Name',
          type: 'string',
          defaultValue: 'myVariable',
          description: 'Variable to check',
        },
        {
          key: 'operator',
          label: 'Operator',
          type: 'select',
          defaultValue: 'equal',
          options: [
            { label: 'Equal', value: 'equal' },
            { label: 'Not Equal', value: 'notEqual' },
            { label: 'Greater Than', value: 'greaterThan' },
            { label: 'Less Than', value: 'lessThan' },
            { label: 'Greater Or Equal', value: 'greaterOrEqual' },
            { label: 'Less Or Equal', value: 'lessOrEqual' },
          ],
          description: 'Comparison operator',
        },
        {
          key: 'compareValue',
          label: 'Compare Value',
          type: 'string',
          defaultValue: '0',
          description: 'Value to compare against',
        },
      ],
      color: [1, 1, 0.3], // Yellow
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    const variableName = this.getConfig<string>('variableName', 'myVariable');
    const operator = this.getConfig<string>('operator', 'equal');
    const compareValueStr = this.getConfig<string>('compareValue', '0');

    // Get variable value (from state for now)
    const currentValue = this.getState<unknown>(`var_${variableName}`, 0);

    // Parse compare value
    let compareValue: number | string | boolean;
    if (!isNaN(parseFloat(compareValueStr))) {
      compareValue = parseFloat(compareValueStr);
    } else if (compareValueStr.toLowerCase() === 'true' || compareValueStr.toLowerCase() === 'false') {
      compareValue = compareValueStr.toLowerCase() === 'true';
    } else {
      compareValue = compareValueStr;
    }

    // Evaluate condition
    let result = false;
    if (typeof currentValue === 'number' && typeof compareValue === 'number') {
      switch (operator) {
        case 'equal':
          result = currentValue === compareValue;
          break;
        case 'notEqual':
          result = currentValue !== compareValue;
          break;
        case 'greaterThan':
          result = currentValue > compareValue;
          break;
        case 'lessThan':
          result = currentValue < compareValue;
          break;
        case 'greaterOrEqual':
          result = currentValue >= compareValue;
          break;
        case 'lessOrEqual':
          result = currentValue <= compareValue;
          break;
      }
    } else {
      // String or boolean comparison
      switch (operator) {
        case 'equal':
          result = currentValue === compareValue;
          break;
        case 'notEqual':
          result = currentValue !== compareValue;
          break;
      }
    }

    // Emit appropriate output
    const outputs = new Map<string, LogicSignal>();
    const outputPort = result ? 'true' : 'false';
    outputs.set(outputPort, {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * IsPlayerNear Condition - Checks if player is within range
 */
export class IsPlayerNearCondition extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'isPlayerNearCondition',
      displayName: 'Is Player Near',
      category: 'condition',
      description: 'Checks if player is within range',
      icon: 'radar',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Check condition',
        },
      ],
      outputs: [
        {
          id: 'true',
          type: 'trigger',
          direction: 'output',
          label: 'True',
          description: 'Player is near',
        },
        {
          id: 'false',
          type: 'trigger',
          direction: 'output',
          label: 'False',
          description: 'Player is not near',
        },
      ],
      parameters: [
        {
          key: 'radius',
          label: 'Detection Radius',
          type: 'number',
          defaultValue: 5,
          min: 0.1,
          max: 100,
          description: 'Detection radius in units',
        },
      ],
      color: [0.8, 1, 0.3], // Yellow-green
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    // TODO: Implement player distance check
    // For now, always return false
    const result = false;

    const outputs = new Map<string, LogicSignal>();
    const outputPort = result ? 'true' : 'false';
    outputs.set(outputPort, {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

/**
 * CheckDistance Condition - Checks distance between two entities
 */
export class CheckDistanceCondition extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'checkDistanceCondition',
      displayName: 'Check Distance',
      category: 'condition',
      description: 'Checks distance between entities',
      icon: 'ruler',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Check condition',
        },
      ],
      outputs: [
        {
          id: 'true',
          type: 'trigger',
          direction: 'output',
          label: 'True',
          description: 'Within distance',
        },
        {
          id: 'false',
          type: 'trigger',
          direction: 'output',
          label: 'False',
          description: 'Outside distance',
        },
      ],
      parameters: [
        {
          key: 'distance',
          label: 'Distance',
          type: 'number',
          defaultValue: 10,
          min: 0.1,
          max: 1000,
          description: 'Distance threshold',
        },
        {
          key: 'operator',
          label: 'Operator',
          type: 'select',
          defaultValue: 'lessThan',
          options: [
            { label: 'Less Than', value: 'lessThan' },
            { label: 'Greater Than', value: 'greaterThan' },
          ],
          description: 'Comparison operator',
        },
      ],
      color: [1, 0.9, 0.3], // Yellow
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    // TODO: Implement distance check
    const result = false;

    const outputs = new Map<string, LogicSignal>();
    const outputPort = result ? 'true' : 'false';
    outputs.set(outputPort, {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }
}

