/**
 * Logic Gate Cubes - Boolean logic operations
 */
import { LogicCube } from './LogicCube.js';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types.js';
/**
 * AND Gate - Outputs true when all inputs are triggered
 */
export declare class ANDGate extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onInit(): void;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * OR Gate - Outputs when any input is triggered
 */
export declare class ORGate extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * NOT Gate - Inverts the signal
 */
export declare class NOTGate extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onInit(): void;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * Delay Gate - Delays signal by specified time
 */
export declare class DelayGate extends LogicCube {
    private delayQueue;
    getMetadata(): LogicCubeMetadata;
    onUpdate(context: LogicExecutionContext): void;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
    /**
     * Check if should output and consume flag
     */
    checkAndConsumeOutput(): LogicSignal | null;
}
//# sourceMappingURL=LogicGateCubes.d.ts.map