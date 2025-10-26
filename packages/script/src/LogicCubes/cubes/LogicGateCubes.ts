/**
 * Logic Gate Cubes - Boolean logic operations
 */

import { LogicCube } from './LogicCube';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types';

/**
 * AND Gate - Outputs true when all inputs are triggered
 */
export class ANDGate extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'andGate',
      displayName: 'AND Gate',
      category: 'logic',
      description: 'Outputs when all inputs are triggered',
      icon: 'gate',
      inputs: [
        {
          id: 'inputA',
          type: 'trigger',
          direction: 'input',
          label: 'Input A',
          description: 'First input',
        },
        {
          id: 'inputB',
          type: 'trigger',
          direction: 'input',
          label: 'Input B',
          description: 'Second input',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Output',
          description: 'Fires when both inputs triggered',
        },
      ],
      parameters: [
        {
          key: 'resetAfterOutput',
          label: 'Reset After Output',
          type: 'boolean',
          defaultValue: true,
          description: 'Reset state after outputting',
        },
      ],
      color: [0.7, 0.7, 1], // Light purple
    };
  }

  override onInit(): void {
    this.setState('inputA', false);
    this.setState('inputB', false);
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId === 'inputA') {
      this.setState('inputA', true);
    } else if (portId === 'inputB') {
      this.setState('inputB', true);
    }

    const inputA = this.getState<boolean>('inputA', false);
    const inputB = this.getState<boolean>('inputB', false);

    if (inputA && inputB) {
      const resetAfterOutput = this.getConfig<boolean>('resetAfterOutput', true);
      if (resetAfterOutput) {
        this.setState('inputA', false);
        this.setState('inputB', false);
      }

      const outputs = new Map<string, LogicSignal>();
      outputs.set('output', {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      return outputs;
    }

    return null;
  }
}

/**
 * OR Gate - Outputs when any input is triggered
 */
export class ORGate extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'orGate',
      displayName: 'OR Gate',
      category: 'logic',
      description: 'Outputs when any input is triggered',
      icon: 'gate',
      inputs: [
        {
          id: 'inputA',
          type: 'trigger',
          direction: 'input',
          label: 'Input A',
          description: 'First input',
        },
        {
          id: 'inputB',
          type: 'trigger',
          direction: 'input',
          label: 'Input B',
          description: 'Second input',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Output',
          description: 'Fires when any input triggered',
        },
      ],
      parameters: [],
      color: [0.8, 0.6, 1], // Purple
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId === 'inputA' || portId === 'inputB') {
      const outputs = new Map<string, LogicSignal>();
      outputs.set('output', {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      return outputs;
    }
    return null;
  }
}

/**
 * NOT Gate - Inverts the signal
 */
export class NOTGate extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'notGate',
      displayName: 'NOT Gate',
      category: 'logic',
      description: 'Inverts the input (outputs if NOT triggered within time)',
      icon: 'gate',
      inputs: [
        {
          id: 'input',
          type: 'trigger',
          direction: 'input',
          label: 'Input',
          description: 'Input to invert',
        },
        {
          id: 'check',
          type: 'trigger',
          direction: 'input',
          label: 'Check',
          description: 'Check if input was NOT triggered',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Output',
          description: 'Fires if input was NOT triggered',
        },
      ],
      parameters: [],
      color: [1, 0.6, 0.8], // Pink
    };
  }

  override onInit(): void {
    this.setState('triggered', false);
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId === 'input') {
      this.setState('triggered', true);
      return null;
    } else if (portId === 'check') {
      const triggered = this.getState<boolean>('triggered', false);
      this.setState('triggered', false); // Reset

      if (!triggered) {
        const outputs = new Map<string, LogicSignal>();
        outputs.set('output', {
          type: 'trigger',
          sourceEntityId: this.entity.id,
          timestamp: signal.timestamp,
        });
        return outputs;
      }
    }
    return null;
  }
}

/**
 * Delay Gate - Delays signal by specified time
 */
export class DelayGate extends LogicCube {
  private delayQueue: Array<{ signal: LogicSignal; timeRemaining: number }> = [];

  getMetadata(): LogicCubeMetadata {
    return {
      type: 'delayGate',
      displayName: 'Delay',
      category: 'logic',
      description: 'Delays signal by specified time',
      icon: 'clock',
      inputs: [
        {
          id: 'input',
          type: 'trigger',
          direction: 'input',
          label: 'Input',
          description: 'Input to delay',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Output',
          description: 'Delayed output',
        },
      ],
      parameters: [
        {
          key: 'delay',
          label: 'Delay (seconds)',
          type: 'number',
          defaultValue: 1,
          min: 0,
          max: 60,
          description: 'Delay duration',
        },
      ],
      color: [1, 0.8, 0.5], // Light orange
    };
  }

  override onUpdate(context: LogicExecutionContext): void {
    super.onUpdate(context);

    // Update delay queue
    for (let i = this.delayQueue.length - 1; i >= 0; i--) {
      const item = this.delayQueue[i];
      if (item) {
        item.timeRemaining -= context.deltaTime;
        if (item.timeRemaining <= 0) {
          this.setState('shouldOutput', true);
          this.delayQueue.splice(i, 1);
        }
      }
    }
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId === 'input') {
      const delay = this.getConfig<number>('delay', 1);
      this.delayQueue.push({
        signal,
        timeRemaining: delay,
      });
    }
    return null;
  }

  /**
   * Check if should output and consume flag
   */
  checkAndConsumeOutput(): LogicSignal | null {
    const shouldOutput = this.getState<boolean>('shouldOutput', false);
    if (shouldOutput) {
      this.setState('shouldOutput', false);
      return {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: Date.now(),
      };
    }
    return null;
  }
}

