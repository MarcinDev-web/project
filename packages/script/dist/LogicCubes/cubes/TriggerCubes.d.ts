/**
 * Trigger Cubes - Start execution chains when events occur
 */
import { LogicCube } from './LogicCube';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from '../types';
/**
 * OnClick Trigger - Fires when the entity is clicked
 */
export declare class OnClickTrigger extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(): Map<string, LogicSignal> | null;
    /**
     * Call this method when the entity is clicked (from external event)
     */
    triggerClick(): LogicSignal | null;
}
/**
 * OnTimer Trigger - Fires repeatedly at a specified interval
 */
export declare class OnTimerTrigger extends LogicCube {
    private elapsed;
    getMetadata(): LogicCubeMetadata;
    onInit(): void;
    onUpdate(context: LogicExecutionContext): void;
    onSignalReceived(portId: string): Map<string, LogicSignal> | null;
    /**
     * Check if timer should fire and consume the flag
     */
    checkAndConsumeTimer(): boolean;
}
/**
 * OnGameStart Trigger - Fires once when the game starts
 */
export declare class OnGameStartTrigger extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onInit(): void;
    onUpdate(context: LogicExecutionContext): void;
    onSignalReceived(): Map<string, LogicSignal> | null;
    /**
     * Check if should trigger and consume the flag
     */
    checkAndConsumeTrigger(): boolean;
}
/**
 * OnPlayerEnter Trigger - Fires when player enters trigger zone
 */
export declare class OnPlayerEnterTrigger extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(): Map<string, LogicSignal> | null;
}
/**
 * OnPlayerLeave Trigger - Fires when player leaves trigger zone
 */
export declare class OnPlayerLeaveTrigger extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(): Map<string, LogicSignal> | null;
}
//# sourceMappingURL=TriggerCubes.d.ts.map