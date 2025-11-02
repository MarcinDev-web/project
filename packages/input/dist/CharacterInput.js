import { KeyboardInputSource } from './sources/KeyboardInputSource';
import { GamepadInputSource } from './sources/GamepadInputSource';
import { UnifiedInputManager, InputCombinationStrategy } from './UnifiedInputManager';
import { InputSourcePriority } from './InputSource';
/**
 * Keyboard input handler for character controller
 *
 * Provides keyboard-based input for character movement.
 * Now uses Enhanced Input Abstraction internally but maintains backward compatibility.
 *
 * For new code, consider using UnifiedInputManager directly.
 */
export class CharacterInputHandler {
    inputManager;
    keyboardSource;
    /** Whether input is enabled */
    _enabled = true;
    /** Camera forward direction (for camera-relative movement) */
    cameraForward = [0, 0, -1];
    /** Camera right direction (for camera-relative movement) */
    cameraRight = [1, 0, 0];
    constructor() {
        // Use Enhanced Input Abstraction internally
        this.inputManager = new UnifiedInputManager();
        this.keyboardSource = new KeyboardInputSource('keyboard', InputSourcePriority.NORMAL);
        this.inputManager.addSource(this.keyboardSource);
        this.inputManager.setCombinationStrategy(InputCombinationStrategy.HIGHEST_PRIORITY);
    }
    /**
     * Set key bindings (backward compatibility)
     */
    setBindings(bindings) {
        const mapping = {
            movement: {
                forward: bindings.movement.forward,
                backward: bindings.movement.backward,
                left: bindings.movement.left,
                right: bindings.movement.right,
            },
            actions: {
                jump: bindings.actions.jump,
                sprint: bindings.actions.sprint,
                interact: bindings.actions.interact,
            },
        };
        this.keyboardSource.setMapping(mapping);
    }
    /**
     * Set camera directions for camera-relative movement
     */
    setCameraDirections(forward, right) {
        this.cameraForward = [...forward];
        this.cameraRight = [...right];
        this.inputManager.setCameraDirections(forward, right);
    }
    /**
     * Get current character input state
     */
    getInput() {
        const input = this.inputManager.getInput();
        // If no input from manager, return default with camera directions
        if (!input) {
            return {
                moveDirection: [0, 0, 0],
                sprint: false,
                jump: false,
                cameraForward: this.cameraForward,
                cameraRight: this.cameraRight,
            };
        }
        // Ensure camera directions are set
        return {
            ...input,
            cameraForward: input.cameraForward ?? this.cameraForward,
            cameraRight: input.cameraRight ?? this.cameraRight,
        };
    }
    /**
     * Enable input handling
     */
    enable() {
        this._enabled = true;
        this.inputManager.enableAll();
    }
    /**
     * Disable input handling
     */
    disable() {
        this._enabled = false;
        this.inputManager.disableAll();
    }
    /**
     * Check if input is enabled
     */
    isEnabled() {
        return this._enabled;
    }
    /**
     * Clear all key states
     */
    clear() {
        this.keyboardSource.clear();
    }
    /**
     * Cleanup event listeners
     * @deprecated Use dispose() instead
     */
    destroy() {
        this.dispose();
    }
    /**
     * Dispose of the input handler
     */
    dispose() {
        this.inputManager.dispose();
    }
}
/**
 * Gamepad input handler for character controller
 *
 * Now uses Enhanced Input Abstraction internally but maintains backward compatibility.
 * For new code, consider using GamepadInputSource or UnifiedInputManager directly.
 */
export class CharacterGamepadHandler {
    gamepadSource;
    inputManager;
    constructor(gamepadIndex = 0) {
        // Use Enhanced Input Abstraction internally
        this.inputManager = new UnifiedInputManager();
        this.gamepadSource = new GamepadInputSource(gamepadIndex, `gamepad-${gamepadIndex}`, InputSourcePriority.NORMAL);
        this.inputManager.addSource(this.gamepadSource);
        this.inputManager.setCombinationStrategy(InputCombinationStrategy.HIGHEST_PRIORITY);
    }
    /** Dead zone for analog sticks */
    get deadZone() {
        return this.gamepadSource.getMapping().deadZone;
    }
    set deadZone(value) {
        this.gamepadSource.setMapping({ deadZone: value });
    }
    /** Sprint threshold for trigger */
    get sprintThreshold() {
        return this.gamepadSource.getMapping().sprintThreshold;
    }
    set sprintThreshold(value) {
        this.gamepadSource.setMapping({ sprintThreshold: value });
    }
    /** Button mappings (standard gamepad layout) */
    get buttons() {
        const mapping = this.gamepadSource.getMapping();
        return {
            jump: mapping.buttons.jump,
            sprint: mapping.buttons.sprint,
        };
    }
    set buttons(value) {
        this.gamepadSource.setMapping({
            buttons: {
                ...this.gamepadSource.getMapping().buttons,
                ...value,
            },
        });
    }
    /** Axis mappings */
    get axes() {
        const mapping = this.gamepadSource.getMapping();
        return {
            moveX: mapping.axes.moveX,
            moveY: mapping.axes.moveY,
        };
    }
    set axes(value) {
        this.gamepadSource.setMapping({
            axes: {
                ...this.gamepadSource.getMapping().axes,
                ...value,
            },
        });
    }
    /**
     * Get current character input state from gamepad
     */
    getInput() {
        return this.inputManager.getInput();
    }
    /**
     * Check if gamepad is connected
     */
    isConnected() {
        return this.gamepadSource.connected;
    }
    /**
     * Dispose of the gamepad handler
     */
    dispose() {
        this.inputManager.dispose();
    }
}
//# sourceMappingURL=CharacterInput.js.map