import { mat4LookAt } from '@engine/core/math';
/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
/**
 * EditorCameraController provides free-fly camera controls for the editor.
 *
 * Features:
 * - WASD movement (with Shift to sprint, Alt to slow down)
 * - Right mouse button + drag for look
 * - Q/E for vertical movement (up/down)
 * - Mouse wheel to zoom (move forward/backward)
 * - Ctrl+Mouse wheel to adjust movement speed
 * - No collision, can fly through anything
 *
 * This is NOT for gameplay - it's for editor navigation.
 */
export class EditorCameraController {
    canvas;
    viewMatrix;
    // Camera state
    position;
    yaw;
    pitch;
    // Configuration
    moveSpeed;
    sprintMultiplier;
    slowMultiplier;
    lookSensitivity;
    pitchLimit;
    // Input state
    keysPressed = new Set();
    isRightMouseDown = false;
    lastMouseX = 0;
    lastMouseY = 0;
    // Direction vectors (cached)
    forward = [0, 0, -1];
    right = [1, 0, 0];
    up = [0, 1, 0];
    // Event listeners (for cleanup)
    boundHandlers = {
        keydown: this.handleKeyDown.bind(this),
        keyup: this.handleKeyUp.bind(this),
        mousedown: this.handleMouseDown.bind(this),
        mouseup: this.handleMouseUp.bind(this),
        mousemove: this.handleMouseMove.bind(this),
        wheel: this.handleWheel.bind(this),
        blur: this.handleBlur.bind(this),
        focus: this.handleFocus.bind(this),
    };
    enabled = false;
    disposed = false;
    constructor(canvas, config) {
        this.canvas = canvas;
        this.viewMatrix = new Float32Array(16);
        // Apply configuration
        this.position = config?.initialPosition ? [...config.initialPosition] : [0, 2, 5];
        this.yaw = config?.initialYaw ?? 0;
        this.pitch = config?.initialPitch ?? 0;
        this.moveSpeed = config?.moveSpeed ?? 5.0;
        this.sprintMultiplier = config?.sprintMultiplier ?? 2.0;
        this.slowMultiplier = config?.slowMultiplier ?? 0.3;
        this.lookSensitivity = config?.lookSensitivity ?? 0.003;
        this.pitchLimit = config?.pitchLimit ?? (Math.PI / 2 - 0.05);
        this.updateDirectionVectors();
    }
    /**
     * Enable the controller (attach event listeners)
     */
    enable() {
        if (this.enabled || this.disposed)
            return;
        this.enabled = true;
        window.addEventListener('keydown', this.boundHandlers.keydown);
        window.addEventListener('keyup', this.boundHandlers.keyup);
        this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
        window.addEventListener('mouseup', this.boundHandlers.mouseup);
        window.addEventListener('mousemove', this.boundHandlers.mousemove);
        this.canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
        window.addEventListener('blur', this.boundHandlers.blur);
        window.addEventListener('focus', this.boundHandlers.focus);
    }
    /**
     * Disable the controller (detach event listeners)
     */
    disable() {
        if (!this.enabled)
            return;
        this.enabled = false;
        window.removeEventListener('keydown', this.boundHandlers.keydown);
        window.removeEventListener('keyup', this.boundHandlers.keyup);
        this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown);
        window.removeEventListener('mouseup', this.boundHandlers.mouseup);
        window.removeEventListener('mousemove', this.boundHandlers.mousemove);
        this.canvas.removeEventListener('wheel', this.boundHandlers.wheel);
        window.removeEventListener('blur', this.boundHandlers.blur);
        window.removeEventListener('focus', this.boundHandlers.focus);
        this.keysPressed.clear();
        this.isRightMouseDown = false;
    }
    /**
     * Dispose of the controller (cleanup)
     */
    dispose() {
        this.disable();
        this.disposed = true;
    }
    /**
     * Update camera based on input state (call every frame)
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        if (!this.enabled)
            return;
        if (this.keysPressed.size === 0)
            return;
        // Determine speed multiplier
        let speed = this.moveSpeed;
        if (this.keysPressed.has('Shift')) {
            speed *= this.sprintMultiplier;
        }
        else if (this.keysPressed.has('Alt')) {
            speed *= this.slowMultiplier;
        }
        const moveAmount = speed * deltaTime;
        const movement = [0, 0, 0];
        // WASD movement (horizontal plane) - using Set for O(1) lookup
        if (this.keysPressed.has('w') || this.keysPressed.has('W')) {
            movement[0] += this.forward[0] * moveAmount;
            movement[1] += this.forward[1] * moveAmount;
            movement[2] += this.forward[2] * moveAmount;
        }
        if (this.keysPressed.has('s') || this.keysPressed.has('S')) {
            movement[0] -= this.forward[0] * moveAmount;
            movement[1] -= this.forward[1] * moveAmount;
            movement[2] -= this.forward[2] * moveAmount;
        }
        if (this.keysPressed.has('d') || this.keysPressed.has('D')) {
            movement[0] += this.right[0] * moveAmount;
            movement[1] += this.right[1] * moveAmount;
            movement[2] += this.right[2] * moveAmount;
        }
        if (this.keysPressed.has('a') || this.keysPressed.has('A')) {
            movement[0] -= this.right[0] * moveAmount;
            movement[1] -= this.right[1] * moveAmount;
            movement[2] -= this.right[2] * moveAmount;
        }
        // Q/E for vertical movement (world up/down)
        if (this.keysPressed.has('e') || this.keysPressed.has('E')) {
            movement[1] += moveAmount;
        }
        if (this.keysPressed.has('q') || this.keysPressed.has('Q')) {
            movement[1] -= moveAmount;
        }
        // Apply movement
        this.position[0] += movement[0];
        this.position[1] += movement[1];
        this.position[2] += movement[2];
    }
    /**
     * Get the current view matrix
     */
    getViewMatrix() {
        const target = [
            this.position[0] + this.forward[0],
            this.position[1] + this.forward[1],
            this.position[2] + this.forward[2],
        ];
        mat4LookAt(this.viewMatrix, this.position, target, [0, 1, 0]);
        return this.viewMatrix;
    }
    /**
     * Get current camera position
     */
    getPosition() {
        return [...this.position];
    }
    /**
     * Set camera position
     */
    setPosition(pos) {
        this.position = [...pos];
    }
    /**
     * Get current yaw and pitch
     */
    getOrientation() {
        return { yaw: this.yaw, pitch: this.pitch };
    }
    /**
     * Set yaw and pitch
     */
    setOrientation(yaw, pitch) {
        this.yaw = yaw;
        this.pitch = clamp(pitch, -this.pitchLimit, this.pitchLimit);
        this.updateDirectionVectors();
    }
    /**
     * Get forward direction vector
     */
    getForward() {
        return [...this.forward];
    }
    /**
     * Get right direction vector
     */
    getRight() {
        return [...this.right];
    }
    /**
     * Get current move speed
     */
    getMoveSpeed() {
        return this.moveSpeed;
    }
    /**
     * Set move speed
     */
    setMoveSpeed(speed) {
        if (speed > 0 && Number.isFinite(speed)) {
            this.moveSpeed = speed;
        }
    }
    /**
     * Check if controller is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    // ========== Event Handlers ==========
    handleKeyDown(event) {
        if (!this.enabled)
            return;
        // Don't capture if typing in input/textarea
        const target = event.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }
        const key = event.key;
        // Only capture movement keys (store both lowercase and original case for compatibility)
        const keyLower = key.toLowerCase();
        if (['w', 'a', 's', 'd', 'q', 'e'].includes(keyLower)) {
            this.keysPressed.add(key); // Store original key for Shift/Alt detection
            this.keysPressed.add(keyLower); // Store lowercase for movement detection
            event.preventDefault();
            event.stopPropagation(); // Stop event from reaching KeyboardHandler
        }
    }
    handleKeyUp(event) {
        if (!this.enabled)
            return;
        const key = event.key;
        const keyLower = key.toLowerCase();
        if (['w', 'a', 's', 'd', 'q', 'e'].includes(keyLower)) {
            // Remove both original and lowercase versions
            this.keysPressed.delete(key);
            this.keysPressed.delete(keyLower);
            event.preventDefault();
            event.stopPropagation();
        }
    }
    handleMouseDown(event) {
        if (!this.enabled || event.button !== 2)
            return; // Right mouse button = 2
        event.preventDefault();
        this.isRightMouseDown = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.canvas.style.cursor = 'grabbing';
    }
    handleMouseUp(event) {
        if (!this.enabled || event.button !== 2)
            return;
        this.isRightMouseDown = false;
        this.canvas.style.cursor = '';
    }
    handleMouseMove(event) {
        if (!this.enabled || !this.isRightMouseDown)
            return;
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        // Apply rotation
        this.yaw += deltaX * this.lookSensitivity;
        this.pitch -= deltaY * this.lookSensitivity;
        this.pitch = clamp(this.pitch, -this.pitchLimit, this.pitchLimit);
        this.updateDirectionVectors();
    }
    handleWheel(event) {
        if (!this.enabled)
            return;
        event.preventDefault();
        // Ctrl+Wheel: Adjust movement speed
        if (event.ctrlKey) {
            const delta = event.deltaY > 0 ? -0.5 : 0.5;
            this.moveSpeed = clamp(this.moveSpeed + delta, 0.5, 50);
            return;
        }
        // Wheel (without Ctrl): Zoom by moving camera forward/backward
        // Normalize delta across devices/browsers and apply exponential movement
        const deltaNormalized = event.deltaMode === 0 /* DOM_DELTA_PIXEL */
            ? (event.deltaY ?? 0) / 100
            : (event.deltaY ?? 0);
        // Move camera along forward direction (zoom effect)
        // Scale movement based on current distance from origin for intuitive feel
        const zoomSpeed = 0.1; // units per wheel step
        const distanceFromOrigin = Math.hypot(this.position[0], this.position[1], this.position[2]);
        const zoomScale = Math.max(0.1, Math.min(1.0, distanceFromOrigin / 10)); // Scale 0.1-1.0 based on distance
        const zoomAmount = -deltaNormalized * zoomSpeed * zoomScale;
        // Move camera along forward direction
        this.position[0] += this.forward[0] * zoomAmount;
        this.position[1] += this.forward[1] * zoomAmount;
        this.position[2] += this.forward[2] * zoomAmount;
    }
    handleBlur() {
        // Clear all input state when window loses focus
        // This prevents stuck keys when window loses focus while a key is held
        this.keysPressed.clear();
        this.isRightMouseDown = false;
        if (this.canvas) {
            this.canvas.style.cursor = '';
        }
    }
    handleFocus() {
        // Clear all input state when window regains focus
        // This fixes the issue where a key might be stuck if keyup event was missed
        // during blur/focus transition
        this.keysPressed.clear();
        this.isRightMouseDown = false;
        if (this.canvas) {
            this.canvas.style.cursor = '';
        }
    }
    // ========== Private Helpers ==========
    updateDirectionVectors() {
        const cosPitch = Math.cos(this.pitch);
        const sinPitch = Math.sin(this.pitch);
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);
        // Forward vector
        this.forward[0] = sinYaw * cosPitch;
        this.forward[1] = sinPitch;
        this.forward[2] = -cosYaw * cosPitch;
        // Right vector (perpendicular to forward in horizontal plane)
        this.right[0] = cosYaw;
        this.right[1] = 0;
        this.right[2] = sinYaw;
        // Up is always world up
        this.up[0] = 0;
        this.up[1] = 1;
        this.up[2] = 0;
    }
}
//# sourceMappingURL=EditorCameraController.js.map