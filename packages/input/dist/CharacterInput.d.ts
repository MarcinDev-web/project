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
 * Now uses Enhanced Input Abstraction internally but maintains backward compatibility.
 *
 * For new code, consider using UnifiedInputManager directly.
 */
export declare class CharacterInputHandler {
    private inputManager;
    private keyboardSource;
    /** Whether input is enabled */
    private _enabled;
    /** Camera forward direction (for camera-relative movement) */
    private cameraForward;
    /** Camera right direction (for camera-relative movement) */
    private cameraRight;
    constructor();
    /**
     * Set key bindings (backward compatibility)
     */
    setBindings(bindings: InputBindings): void;
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
     * @deprecated Use dispose() instead
     */
    destroy(): void;
    /**
     * Dispose of the input handler
     */
    dispose(): void;
}
/**
 * Gamepad input handler for character controller
 *
 * Now uses Enhanced Input Abstraction internally but maintains backward compatibility.
 * For new code, consider using GamepadInputSource or UnifiedInputManager directly.
 */
export declare class CharacterGamepadHandler {
    private gamepadSource;
    private inputManager;
    constructor(gamepadIndex?: number);
    /** Dead zone for analog sticks */
    get deadZone(): number;
    set deadZone(value: number);
    /** Sprint threshold for trigger */
    get sprintThreshold(): number;
    set sprintThreshold(value: number);
    /** Button mappings (standard gamepad layout) */
    get buttons(): {
        jump: number;
        sprint: number;
    };
    set buttons(value: {
        jump: number;
        sprint: number;
    });
    /** Axis mappings */
    get axes(): {
        moveX: number;
        moveY: number;
    };
    set axes(value: {
        moveX: number;
        moveY: number;
    });
    /**
     * Get current character input state from gamepad
     */
    getInput(): CharacterInput | null;
    /**
     * Check if gamepad is connected
     */
    isConnected(): boolean;
    /**
     * Dispose of the gamepad handler
     */
    dispose(): void;
}
//# sourceMappingURL=CharacterInput.d.ts.map