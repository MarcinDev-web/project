/**
 * Data Cubes - Store and manipulate data
 */
import { LogicCube } from './LogicCube';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types';
/**
 * Variable Data - Stores a variable
 */
export declare class VariableData extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onInit(): void;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * Counter Data - Counts up/down
 */
export declare class CounterData extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onInit(): void;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * Timer Data - Tracks elapsed time
 */
export declare class TimerData extends LogicCube {
    private elapsed;
    getMetadata(): LogicCubeMetadata;
    onInit(): void;
    onUpdate(context: LogicExecutionContext): void;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
    /**
     * Check if timer completed and consume flag
     */
    checkAndConsumeComplete(): boolean;
}
//# sourceMappingURL=DataCubes.d.ts.map