/**
 * UI Cubes - Logic cubes for UI element interactions
 */
import { LogicCube } from './LogicCube';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types';
/**
 * UIButtonClick Trigger - Fires when a UI button is clicked
 */
export declare class UIButtonClickTrigger extends LogicCube {
    private clickHandler;
    getMetadata(): LogicCubeMetadata;
    onInit(): void;
    onDestroy(): void;
    private setupClickHandler;
    private removeClickHandler;
    onSignalReceived(_portId: string, _signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null;
}
/**
 * UIShowElement Action - Show or hide a UI element
 */
export declare class UIShowElementAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null;
}
/**
 * UISetText Action - Set text content of a UI element
 */
export declare class UISetTextAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null;
}
/**
 * UISetImage Action - Set image URL of a UI image element
 */
export declare class UISetImageAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null;
}
/**
 * UISetValue Action - Set value of a UI slider/progress/input element
 */
export declare class UISetValueAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null;
}
/**
 * UIEnableElement Action - Enable or disable a UI element
 */
export declare class UIEnableElementAction extends LogicCube {
    getMetadata(): LogicCubeMetadata;
    onSignalReceived(portId: string, signal: LogicSignal, _context: LogicExecutionContext): Map<string, LogicSignal> | null;
}
//# sourceMappingURL=UICubes.d.ts.map