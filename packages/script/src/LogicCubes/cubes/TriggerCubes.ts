/**
 * Trigger Cubes - Start execution chains when events occur
 */

import { LogicCube } from './LogicCube.js';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types.js';

/**
 * OnClick Trigger - Fires when the entity is clicked
 */
export class OnClickTrigger extends LogicCube {
  getMetadata(): LogicCubeMetadata {
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

  onSignalReceived(): Map<string, LogicSignal> | null {
    // This cube doesn't receive signals, it generates them on click
    return null;
  }

  /**
   * Call this method when the entity is clicked (from external event)
   */
  triggerClick(): LogicSignal | null {
    if (!this.enabled || this.isOnCooldown()) {
      return null;
    }

    const cooldownDuration = this.getConfig<number>('cooldown', 0);
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
  private elapsed = 0;

  getMetadata(): LogicCubeMetadata {
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

  override onInit(): void {
    this.elapsed = 0;
  }

  override onUpdate(context: LogicExecutionContext): void {
    super.onUpdate(context);

    if (!this.enabled) return;

    const autoStart = this.getConfig<boolean>('autoStart', true);
    if (!autoStart) return;

    const interval = this.getConfig<number>('interval', 1);
    this.elapsed += context.deltaTime;

    if (this.elapsed >= interval) {
      this.elapsed -= interval;
      // We can't directly emit signals here, but we can use the scene's event bus
      // For now, we'll mark it in state for the system to detect
      this.setState('shouldTrigger', true);
    }
  }

  onSignalReceived(portId: string): Map<string, LogicSignal> | null {
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
  checkAndConsumeTimer(): boolean {
    const shouldTrigger = this.getState<boolean>('shouldTrigger', false);
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
  getMetadata(): LogicCubeMetadata {
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

  override onInit(): void {
    this.setState('triggered', false);
    this.setState('delayElapsed', 0);
  }

  override onUpdate(context: LogicExecutionContext): void {
    super.onUpdate(context);

    if (!this.enabled) return;
    if (this.getState<boolean>('triggered', false)) return;

    const delay = this.getConfig<number>('delay', 0);
    const elapsed = this.getState<number>('delayElapsed', 0);
    const newElapsed = elapsed + context.deltaTime;

    this.setState('delayElapsed', newElapsed);

    if (newElapsed >= delay) {
      this.setState('triggered', true);
      this.setState('shouldTrigger', true);
    }
  }

  onSignalReceived(): Map<string, LogicSignal> | null {
    return null;
  }

  /**
   * Check if should trigger and consume the flag
   */
  checkAndConsumeTrigger(): boolean {
    const shouldTrigger = this.getState<boolean>('shouldTrigger', false);
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
  getMetadata(): LogicCubeMetadata {
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

  onSignalReceived(): Map<string, LogicSignal> | null {
    return null;
  }
}

/**
 * OnPlayerLeave Trigger - Fires when player leaves trigger zone
 */
export class OnPlayerLeaveTrigger extends LogicCube {
  getMetadata(): LogicCubeMetadata {
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

  onSignalReceived(): Map<string, LogicSignal> | null {
    return null;
  }
}

/**
 * OnInteract Trigger - Fires when the entity is interacted with (E key)
 */
export class OnInteractTrigger extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'onInteractTrigger',
      displayName: 'On Interact',
      category: 'trigger',
      description: 'Triggers when player interacts with this entity (E key)',
      icon: 'hand-pointer',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Receives interaction signal from InteractionSystem',
        },
      ],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'On Interact',
          description: 'Fires when interacted with',
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
      color: [0.8, 0.4, 1], // Purple
    };
  }

  override onInit(): void {
    // Listen for interaction signals from InteractionSystem
    // The signal is emitted via scene.events.emit('logic:signal', ...)
    // LogicCubeSystem will route it to this cube's onSignalReceived
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    if (!this.enabled || this.isOnCooldown()) {
      return null;
    }

    const cooldownDuration = this.getConfig<number>('cooldown', 0);
    if (cooldownDuration > 0) {
      this.setCooldown(cooldownDuration);
    }

    // Forward the signal to output
    const outputSignal: LogicSignal = {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp ?? Date.now(),
    };

    const outputs = new Map<string, LogicSignal>();
    outputs.set('output', outputSignal);
    return outputs;
  }
}
