/**
 * Keyboard input handler for character controller
 *
 * Provides keyboard-based input for character movement.
 * Can be extended with gamepad, touch, or other input methods.
 */
export class CharacterInputHandler {
    /** Key states */
    keys = new Map();
    /** Key bindings */
    bindings = {
        forward: ['KeyW', 'ArrowUp'],
        backward: ['KeyS', 'ArrowDown'],
        left: ['KeyA', 'ArrowLeft'],
        right: ['KeyD', 'ArrowRight'],
        jump: ['Space'],
        sprint: ['ShiftLeft', 'ShiftRight'],
        interact: ['KeyE'],
        use: ['Mouse0'],
    };
    /** Whether input is enabled */
    enabled = true;
    /** Camera forward direction (for camera-relative movement) */
    cameraForward = [0, 0, -1];
    /** Camera right direction (for camera-relative movement) */
    cameraRight = [1, 0, 0];
    constructor() {
        this.setupEventListeners();
    }
    setBindings(bindings) {
        this.bindings.forward = bindings.movement.forward;
        this.bindings.backward = bindings.movement.backward;
        this.bindings.left = bindings.movement.left;
        this.bindings.right = bindings.movement.right;
        this.bindings.jump = bindings.actions.jump;
        this.bindings.sprint = bindings.actions.sprint;
        this.bindings.interact = bindings.actions.interact;
        this.bindings.use = bindings.actions.interact ?? this.bindings.use;
    }
    /**
     * Setup keyboard event listeners
     */
    setupEventListeners() {
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    /**
     * Handle key down event
     */
    handleKeyDown(event) {
        if (!this.enabled)
            return;
        this.keys.set(event.code, true);
    }
    /**
     * Handle key up event
     */
    handleKeyUp(event) {
        this.keys.set(event.code, false);
    }
    /**
     * Check if any key in a binding is pressed
     */
    isKeyPressed(keys) {
        return keys.some(key => this.keys.get(key) === true);
    }
    /**
     * Set camera directions for camera-relative movement
     */
    setCameraDirections(forward, right) {
        this.cameraForward = [...forward];
        this.cameraRight = [...right];
    }
    /**
     * Get current character input state
     */
    getInput() {
        // Calculate movement direction
        let x = 0;
        let z = 0;
        if (this.isKeyPressed(this.bindings.forward))
            z += 1;
        if (this.isKeyPressed(this.bindings.backward))
            z -= 1;
        if (this.isKeyPressed(this.bindings.left))
            x -= 1;
        if (this.isKeyPressed(this.bindings.right))
            x += 1;
        // Normalize diagonal movement
        const length = Math.sqrt(x * x + z * z);
        if (length > 0) {
            x /= length;
            z /= length;
        }
        return {
            moveDirection: [x, 0, z],
            sprint: this.isKeyPressed(this.bindings.sprint),
            jump: this.isKeyPressed(this.bindings.jump),
            cameraForward: this.cameraForward,
            cameraRight: this.cameraRight,
        };
    }
    /**
     * Enable input handling
     */
    enable() {
        this.enabled = true;
    }
    /**
     * Disable input handling
     */
    disable() {
        this.enabled = false;
        this.keys.clear();
    }
    /**
     * Check if input is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Clear all key states
     */
    clear() {
        this.keys.clear();
    }
    /**
     * Cleanup event listeners
     */
    destroy() {
        window.removeEventListener('keydown', this.handleKeyDown.bind(this));
        window.removeEventListener('keyup', this.handleKeyUp.bind(this));
        this.keys.clear();
    }
}
/**
 * Gamepad input handler for character controller
 */
export class CharacterGamepadHandler {
    /** Gamepad index */
    gamepadIndex = 0;
    /** Dead zone for analog sticks */
    deadZone = 0.15;
    /** Sprint threshold for trigger */
    sprintThreshold = 0.5;
    /** Button mappings (standard gamepad layout) */
    buttons = {
        jump: 0, // A button
        sprint: 7, // Right trigger
    };
    /** Axis mappings */
    axes = {
        moveX: 0, // Left stick X
        moveY: 1, // Left stick Y
    };
    constructor(gamepadIndex = 0) {
        this.gamepadIndex = gamepadIndex;
    }
    /**
     * Get connected gamepad
     */
    getGamepad() {
        const gamepads = navigator.getGamepads();
        return gamepads[this.gamepadIndex] || null;
    }
    /**
     * Apply dead zone to axis value
     */
    applyDeadZone(value) {
        if (Math.abs(value) < this.deadZone)
            return 0;
        // Re-map from [deadZone, 1] to [0, 1]
        const sign = Math.sign(value);
        const normalized = (Math.abs(value) - this.deadZone) / (1 - this.deadZone);
        return sign * normalized;
    }
    /**
     * Get current character input state from gamepad
     */
    getInput() {
        const gamepad = this.getGamepad();
        if (!gamepad)
            return null;
        // Get stick input
        const x = this.applyDeadZone(gamepad.axes[this.axes.moveX] ?? 0);
        const y = this.applyDeadZone(gamepad.axes[this.axes.moveY] ?? 0);
        // Get button input
        const jump = gamepad.buttons[this.buttons.jump]?.pressed ?? false;
        const sprintValue = gamepad.buttons[this.buttons.sprint]?.value ?? 0;
        const sprint = sprintValue > this.sprintThreshold;
        return {
            moveDirection: [x, 0, -y], // Invert Y for forward/backward
            sprint,
            jump,
            cameraForward: [0, 0, -1],
            cameraRight: [1, 0, 0],
        };
    }
    /**
     * Check if gamepad is connected
     */
    isConnected() {
        return this.getGamepad() !== null;
    }
}
//# sourceMappingURL=CharacterInput.js.map