import type { Vec3 } from '@engine/core/math';
import type { CharacterInput } from '@engine/world';
export interface InputBindings {
    movement: {
        forward: string[];
        backward: string[];
        left: string[];
        right: string[];
    };
    actions: {
        jump: string[];
        sprint: string[];
        interact: string[];
    };
}
/**
 * Keyboard input handler for character controller
 *
 * Provides keyboard-based input for character movement.
 * Can be extended with gamepad, touch, or other input methods.
 */
export declare class CharacterInputHandler {
    /** Key states */
    private keys;
    /** Key bindings */
    private bindings;
    /** Whether input is enabled */
    private enabled;
    /** Camera forward direction (for camera-relative movement) */
    private cameraForward;
    /** Camera right direction (for camera-relative movement) */
    private cameraRight;
    constructor();
    setBindings(bindings: InputBindings): void;
    /**
     * Setup keyboard event listeners
     */
    private setupEventListeners;
    /**
     * Handle key down event
     */
    private handleKeyDown;
    /**
     * Handle key up event
     */
    private handleKeyUp;
    /**
     * Check if any key in a binding is pressed
     */
    private isKeyPressed;
    /**
     * Set camera directions for camera-relative movement
     */
    setCameraDirections(forward: Vec3, right: Vec3): void;
    /**
     * Get current character input state
     */
    getInput(): CharacterInput;
    /**
     * Enable input handling
     */
    enable(): void;
    /**
     * Disable input handling
     */
    disable(): void;
    /**
     * Check if input is enabled
     */
    isEnabled(): boolean;
    /**
     * Clear all key states
     */
    clear(): void;
    /**
     * Cleanup event listeners
     */
    destroy(): void;
}
/**
 * Gamepad input handler for character controller
 */
export declare class CharacterGamepadHandler {
    /** Gamepad index */
    private gamepadIndex;
    /** Dead zone for analog sticks */
    deadZone: number;
    /** Sprint threshold for trigger */
    sprintThreshold: number;
    /** Button mappings (standard gamepad layout) */
    buttons: {
        jump: number;
        sprint: number;
    };
    /** Axis mappings */
    axes: {
        moveX: number;
        moveY: number;
    };
    constructor(gamepadIndex?: number);
    /**
     * Get connected gamepad
     */
    private getGamepad;
    /**
     * Apply dead zone to axis value
     */
    private applyDeadZone;
    /**
     * Get current character input state from gamepad
     */
    getInput(): CharacterInput | null;
    /**
     * Check if gamepad is connected
     */
    isConnected(): boolean;
}
//# sourceMappingURL=CharacterInput.d.ts.map