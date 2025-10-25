/**
 * Trigger Cubes - Start execution chains when events occur
 */
import { LogicCube } from './LogicCube';
/**
 * OnClick Trigger - Fires when the entity is clicked
 */
export class OnClickTrigger extends LogicCube {
    getMetadata() {
        return {
            type: 'onClickTrigger',
            displayName: 'On Click',
            category: 'trigger',
            description: 'Triggers when this entity is clicked',
            icon: 'cursor',
            inputs: [],
            outputs: [
                {
                    id: 'output',
                    type: 'trigger',
                    direction: 'output',
                    label: 'On Click',
                    description: 'Fires when clicked',
                },
            ],
            parameters: [
                {
                    key: 'cooldown',
                    label: 'Cooldown (seconds)',
                    type: 'number',
                    defaultValue: 0,
                    min: 0,
                    max: 60,
                    description: 'Minimum time between triggers',
                },
            ],
            color: [1, 0.8, 0.2], // Yellow
        };
    }
    onSignalReceived() {
        // This cube doesn't receive signals, it generates them on click
        return null;
    }
    /**
     * Call this method when the entity is clicked (from external event)
     */
    triggerClick() {
        if (!this.enabled || this.isOnCooldown()) {
            return null;
        }
        const cooldownDuration = this.getConfig('cooldown', 0);
        if (cooldownDuration > 0) {
            this.setCooldown(cooldownDuration);
        }
        return {
            type: 'trigger',
            sourceEntityId: this.entity.id,
            timestamp: Date.now(),
        };
    }
}
/**
 * OnTimer Trigger - Fires repeatedly at a specified interval
 */
export class OnTimerTrigger extends LogicCube {
    elapsed = 0;
    getMetadata() {
        return {
            type: 'onTimerTrigger',
            displayName: 'On Timer',
            category: 'trigger',
            description: 'Triggers repeatedly at a specified interval',
            icon: 'clock',
            inputs: [],
            outputs: [
                {
                    id: 'output',
                    type: 'trigger',
                    direction: 'output',
                    label: 'On Timer',
                    description: 'Fires every interval',
                },
            ],
            parameters: [
                {
                    key: 'interval',
                    label: 'Interval (seconds)',
                    type: 'number',
                    defaultValue: 1,
                    min: 0.1,
                    max: 3600,
                    description: 'Time between triggers',
                },
                {
                    key: 'autoStart',
                    label: 'Auto Start',
                    type: 'boolean',
                    defaultValue: true,
                    description: 'Start timer automatically',
                },
            ],
            color: [1, 0.6, 0.2], // Orange
        };
    }
    onInit() {
        this.elapsed = 0;
    }
    onUpdate(context) {
        super.onUpdate(context);
        if (!this.enabled)
            return;
        const autoStart = this.getConfig('autoStart', true);
        if (!autoStart)
            return;
        const interval = this.getConfig('interval', 1);
        this.elapsed += context.deltaTime;
        if (this.elapsed >= interval) {
            this.elapsed -= interval;
            // We can't directly emit signals here, but we can use the scene's event bus
            // For now, we'll mark it in state for the system to detect
            this.setState('shouldTrigger', true);
        }
    }
    onSignalReceived(portId) {
        // Timer can be reset/started via signals if needed
        if (portId === 'reset') {
            this.elapsed = 0;
            return null;
        }
        return null;
    }
    /**
     * Check if timer should fire and consume the flag
     */
    checkAndConsumeTimer() {
        const shouldTrigger = this.getState('shouldTrigger', false);
        if (shouldTrigger) {
            this.setState('shouldTrigger', false);
            return true;
        }
        return false;
    }
}
/**
 * OnGameStart Trigger - Fires once when the game starts
 */
export class OnGameStartTrigger extends LogicCube {
    getMetadata() {
        return {
            type: 'onGameStartTrigger',
            displayName: 'On Game Start',
            category: 'trigger',
            description: 'Triggers once when the game starts',
            icon: 'play',
            inputs: [],
            outputs: [
                {
                    id: 'output',
                    type: 'trigger',
                    direction: 'output',
                    label: 'On Start',
                    description: 'Fires when game starts',
                },
            ],
            parameters: [
                {
                    key: 'delay',
                    label: 'Delay (seconds)',
                    type: 'number',
                    defaultValue: 0,
                    min: 0,
                    max: 60,
                    description: 'Delay before triggering',
                },
            ],
            color: [0.2, 1, 0.2], // Green
        };
    }
    onInit() {
        this.setState('triggered', false);
        this.setState('delayElapsed', 0);
    }
    onUpdate(context) {
        super.onUpdate(context);
        if (!this.enabled)
            return;
        if (this.getState('triggered', false))
            return;
        const delay = this.getConfig('delay', 0);
        const elapsed = this.getState('delayElapsed', 0);
        const newElapsed = elapsed + context.deltaTime;
        this.setState('delayElapsed', newElapsed);
        if (newElapsed >= delay) {
            this.setState('triggered', true);
            this.setState('shouldTrigger', true);
        }
    }
    onSignalReceived() {
        return null;
    }
    /**
     * Check if should trigger and consume the flag
     */
    checkAndConsumeTrigger() {
        const shouldTrigger = this.getState('shouldTrigger', false);
        if (shouldTrigger) {
            this.setState('shouldTrigger', false);
            return true;
        }
        return false;
    }
}
/**
 * OnPlayerEnter Trigger - Fires when player enters trigger zone
 */
export class OnPlayerEnterTrigger extends LogicCube {
    getMetadata() {
        return {
            type: 'onPlayerEnterTrigger',
            displayName: 'On Player Enter',
            category: 'trigger',
            description: 'Triggers when player enters the zone',
            icon: 'user',
            inputs: [],
            outputs: [
                {
                    id: 'output',
                    type: 'trigger',
                    direction: 'output',
                    label: 'On Enter',
                    description: 'Fires when player enters',
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
            color: [0.5, 0.5, 1], // Light blue
        };
    }
    onSignalReceived() {
        return null;
    }
}
/**
 * OnPlayerLeave Trigger - Fires when player leaves trigger zone
 */
export class OnPlayerLeaveTrigger extends LogicCube {
    getMetadata() {
        return {
            type: 'onPlayerLeaveTrigger',
            displayName: 'On Player Leave',
            category: 'trigger',
            description: 'Triggers when player leaves the zone',
            icon: 'user',
            inputs: [],
            outputs: [
                {
                    id: 'output',
                    type: 'trigger',
                    direction: 'output',
                    label: 'On Leave',
                    description: 'Fires when player leaves',
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
            color: [0.5, 0.5, 1], // Light blue
        };
    }
    onSignalReceived() {
        return null;
    }
}
//# sourceMappingURL=TriggerCubes.js.map