/**
 * Action Cubes - Perform actions when triggered
 */
import { LogicCube } from './LogicCube';
import type { LogicCubeMetadata, LogicSignal } from './types';
/**
 * SendMessage Action - Sends a message via event bus
 */
export declare class SendMessageAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * SetVariable Action - Sets a variable value
 */
export declare class SetVariableAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * SpawnEntity Action - Spawns an entity
 */
export declare class SpawnEntityAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
/**
 * DestroyEntity Action - Destroys an entity
 */
export declare class DestroyEntityAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string): Map<string, LogicSignal> | null;
}
/**
 * Log Action - Logs a message to console (useful for debugging)
 */
export declare class LogAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null;
}
//# sourceMappingURL=ActionCubes.d.ts.map