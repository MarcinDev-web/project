/**
 * Condition Cubes - Evaluate conditions and route signals
 */
import { LogicCube } from './LogicCube';
import type { LogicCubeMetadata, LogicSignal } from '../types';
/**
 * CompareVariable Condition - Compares a variable to a value
 */
export declare class CompareVariableCondition extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * IsPlayerNear Condition - Checks if player is within range
 */
export declare class IsPlayerNearCondition extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * CheckDistance Condition - Checks distance between two entities
 */
export declare class CheckDistanceCondition extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
//# sourceMappingURL=ConditionCubes.d.ts.map