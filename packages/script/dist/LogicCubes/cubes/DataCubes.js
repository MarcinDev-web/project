/**
 * Data Cubes - Store and manipulate data
 */
import { LogicCube } from './LogicCube';
/**
 * Variable Data - Stores a variable
 */
export class VariableData extends LogicCube {
    getMetadata() {
        return {
            type: 'variableData',
            displayName: 'Variable',
            category: 'data',
            description: 'Stores a variable value',
            icon: 'database',
            inputs: [
                {
                    id: 'set',
                    type: 'trigger',
                    direction: 'input',
                    label: 'Set',
                    description: 'Set the variable',
                },
                {
                    id: 'get',
                    type: 'trigger',
                    direction: 'input',
                    label: 'Get',
                    description: 'Get the variable',
                },
            ],
            outputs: [
                {
                    id: 'value',
                    type: 'data',
                    direction: 'output',
                    label: 'Value',
                    description: 'Variable value',
                    dataType: 'any',
                },
                {
                    id: 'onSet',
                    type: 'trigger',
                    direction: 'output',
                    label: 'On Set',
                    description: 'Fires after setting',
                },
            ],
            parameters: [
                {
                    key: 'variableName',
                    label: 'Name',
                    type: 'string',
                    defaultValue: 'myVariable',
                    description: 'Variable name',
                },
                {
                    key: 'initialValue',
                    label: 'Initial Value',
                    type: 'string',
                    defaultValue: '0',
                    description: 'Starting value',
                },
            ],
            color: [0.3, 0.8, 1], // Blue
        };
    }
    onInit() {
        const initialValue = this.getConfig('initialValue', '0');
        this.setState('value', initialValue);
    }
    onSignalReceived(portId, signal) {
        if (portId === 'set') {
            // Set value from signal data
            if (signal.data !== undefined) {
                this.setState('value', signal.data);
            }
            const outputs = new Map();
            outputs.set('onSet', {
                type: 'trigger',
                sourceEntityId: this.entity.id,
                timestamp: signal.timestamp,
            });
            return outputs;
        }
        else if (portId === 'get') {
            // Return current value
            const value = this.getState('value', '0');
            const outputs = new Map();
            outputs.set('value', {
                type: 'data',
                data: value,
                sourceEntityId: this.entity.id,
                timestamp: signal.timestamp,
            });
            return outputs;
        }
        return null;
    }
}
/**
 * Counter Data - Counts up/down
 */
export class CounterData extends LogicCube {
    getMetadata() {
        return {
            type: 'counterData',
            displayName: 'Counter',
            category: 'data',
            description: 'Counts up or down',
            icon: 'hash',
            inputs: [
                {
                    id: 'increment',
                    type: 'trigger',
                    direction: 'input',
                    label: 'Increment',
                    description: 'Add to counter',
                },
                {
                    id: 'decrement',
                    type: 'trigger',
                    direction: 'input',
                    label: 'Decrement',
                    description: 'Subtract from counter',
                },
                {
                    id: 'reset',
                    type: 'trigger',
                    direction: 'input',
                    label: 'Reset',
                    description: 'Reset to initial value',
                },
            ],
            outputs: [
                {
                    id: 'value',
                    type: 'data',
                    direction: 'output',
                    label: 'Value',
                    description: 'Current count',
                    dataType: 'number',
                },
                {
                    id: 'onChange',
                    type: 'trigger',
                    direction: 'output',
                    label: 'On Change',
                    description: 'Fires when count changes',
                },
            ],
            parameters: [
                {
                    key: 'initialValue',
                    label: 'Initial Value',
                    type: 'number',
                    defaultValue: 0,
                    description: 'Starting count',
                },
                {
                    key: 'step',
                    label: 'Step',
                    type: 'number',
                    defaultValue: 1,
                    description: 'Amount to increment/decrement',
                },
            ],
            color: [0.5, 0.7, 1], // Light blue
        };
    }
    onInit() {
        const initialValue = this.getConfig('initialValue', 0);
        this.setState('count', initialValue);
    }
    onSignalReceived(portId, signal) {
        const step = this.getConfig('step', 1);
        let count = this.getState('count', 0);
        if (portId === 'increment') {
            count += step;
            this.setState('count', count);
        }
        else if (portId === 'decrement') {
            count -= step;
            this.setState('count', count);
        }
        else if (portId === 'reset') {
            count = this.getConfig('initialValue', 0);
            this.setState('count', count);
        }
        else {
            return null;
        }
        const outputs = new Map();
        outputs.set('value', {
            type: 'data',
            data: count,
            sourceEntityId: this.entity.id,
            timestamp: signal.timestamp,
        });
        outputs.set('onChange', {
            type: 'trigger',
            sourceEntityId: this.entity.id,
            timestamp: signal.timestamp,
        });
        return outputs;
    }
}
/**
 * Timer Data - Tracks elapsed time
 */
export class TimerData extends LogicCube {
    elapsed = 0;
    getMetadata() {
        return {
            type: 'timerData',
            displayName: 'Timer',
            category: 'data',
            description: 'Tracks elapsed time',
            icon: 'stopwatch',
            inputs: [
                {
                    id: 'start',
                    type: 'trigger',
                    direction: 'input',
                    label: 'Start',
                    description: 'Start timer',
                },
                {
                    id: 'stop',
                    type: 'trigger',
                    direction: 'input',
                    label: 'Stop',
                    description: 'Stop timer',
                },
                {
                    id: 'reset',
                    type: 'trigger',
                    direction: 'input',
                    label: 'Reset',
                    description: 'Reset timer',
                },
            ],
            outputs: [
                {
                    id: 'elapsed',
                    type: 'data',
                    direction: 'output',
                    label: 'Elapsed',
                    description: 'Time elapsed in seconds',
                    dataType: 'number',
                },
                {
                    id: 'onComplete',
                    type: 'trigger',
                    direction: 'output',
                    label: 'On Complete',
                    description: 'Fires when duration reached',
                },
            ],
            parameters: [
                {
                    key: 'duration',
                    label: 'Duration (seconds)',
                    type: 'number',
                    defaultValue: 10,
                    min: 0.1,
                    max: 3600,
                    description: 'Timer duration',
                },
                {
                    key: 'autoStart',
                    label: 'Auto Start',
                    type: 'boolean',
                    defaultValue: false,
                    description: 'Start automatically',
                },
            ],
            color: [1, 0.7, 0.3], // Orange
        };
    }
    onInit() {
        const autoStart = this.getConfig('autoStart', false);
        this.setState('running', autoStart);
        this.elapsed = 0;
    }
    onUpdate(context) {
        super.onUpdate(context);
        const running = this.getState('running', false);
        if (!running)
            return;
        this.elapsed += context.deltaTime;
        const duration = this.getConfig('duration', 10);
        if (this.elapsed >= duration) {
            this.setState('running', false);
            this.setState('shouldComplete', true);
        }
    }
    onSignalReceived(portId, signal) {
        if (portId === 'start') {
            this.setState('running', true);
        }
        else if (portId === 'stop') {
            this.setState('running', false);
        }
        else if (portId === 'reset') {
            this.elapsed = 0;
            this.setState('running', false);
        }
        const outputs = new Map();
        outputs.set('elapsed', {
            type: 'data',
            data: this.elapsed,
            sourceEntityId: this.entity.id,
            timestamp: signal.timestamp,
        });
        return outputs;
    }
    /**
     * Check if timer completed and consume flag
     */
    checkAndConsumeComplete() {
        const shouldComplete = this.getState('shouldComplete', false);
        if (shouldComplete) {
            this.setState('shouldComplete', false);
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=DataCubes.js.map