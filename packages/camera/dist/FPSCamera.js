import { mat4LookAt } from '@engine/core/math';
/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
/**
 * FPSCamera provides first-person camera controls with pointer lock support.
 *
 * Responsibilities:
 * - Track yaw/pitch orientation using mouse movement
 * - Request/release pointer lock on demand
 * - Produce view matrix from tracked orientation and player position
 * - Expose forward/right direction vectors for movement input
 */
export class FPSCamera {
    canvas;
    viewMatrix;
    forward = [0, 0, -1];
    right = [1, 0, 0];
    yaw = 0;
    pitch = 0;
    eyeHeight;
    sensitivity;
    pitchLimit;
    invertY = false;
    pointerLockActive = false;
    pendingPointerLock = false;
    constructor(canvas, options) {
        this.canvas = canvas;
        this.eyeHeight = options?.eyeHeight ?? 1.6;
        this.sensitivity = options?.sensitivity ?? 0.0025;
        this.pitchLimit = options?.pitchLimit ?? (Math.PI / 2 - 0.05);
        this.viewMatrix = new Float32Array(16);
        this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
        this.handlePointerLockError = this.handlePointerLockError.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
        document.addEventListener('pointerlockerror', this.handlePointerLockError);
    }
    setSensitivity(value) {
        this.sensitivity = value;
    }
    setEyeHeight(value) {
        this.eyeHeight = value;
    }
    setPitchLimit(value) {
        this.pitchLimit = value;
        this.pitch = clamp(this.pitch, -this.pitchLimit, this.pitchLimit);
        this.updateDirectionVectors();
    }
    setInvertY(value) {
        this.invertY = value;
    }
    dispose() {
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
        document.removeEventListener('pointerlockerror', this.handlePointerLockError);
        document.removeEventListener('mousemove', this.handleMouseMove);
    }
    enable() {
        if (this.pointerLockActive)
            return;
        this.pendingPointerLock = true;
        try {
            this.canvas.requestPointerLock();
        }
        catch {
            this.pendingPointerLock = false;
        }
    }
    disable() {
        this.pendingPointerLock = false;
        if (!this.pointerLockActive)
            return;
        try {
            document.exitPointerLock();
        }
        catch {
            // ignore pointer lock exit errors
        }
    }
    setYawPitch(yaw, pitch) {
        this.yaw = yaw;
        this.pitch = clamp(pitch, -this.pitchLimit, this.pitchLimit);
        this.updateDirectionVectors();
    }
    getYawPitch() {
        return { yaw: this.yaw, pitch: this.pitch };
    }
    /** Returns the view matrix for the given player world position. */
    getViewMatrix(playerPosition) {
        const eyeX = playerPosition[0];
        const eyeY = playerPosition[1] + this.eyeHeight;
        const eyeZ = playerPosition[2];
        const targetX = eyeX + this.forward[0];
        const targetY = eyeY + this.forward[1];
        const targetZ = eyeZ + this.forward[2];
        mat4LookAt(this.viewMatrix, [eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 1, 0]);
        return this.viewMatrix;
    }
    getForwardDirection() {
        return this.forward;
    }
    getRightDirection() {
        return this.right;
    }
    /** Called once per frame to ensure pointer lock state. */
    update() {
        if (this.pendingPointerLock && !this.pointerLockActive && document.pointerLockElement !== this.canvas) {
            this.canvas.requestPointerLock();
        }
    }
    handlePointerLockChange() {
        const locked = document.pointerLockElement === this.canvas;
        if (locked === this.pointerLockActive)
            return;
        this.pointerLockActive = locked;
        this.pendingPointerLock = false;
        if (locked) {
            document.addEventListener('mousemove', this.handleMouseMove);
        }
        else {
            document.removeEventListener('mousemove', this.handleMouseMove);
        }
    }
    handlePointerLockError() {
        this.pendingPointerLock = false;
        this.pointerLockActive = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
    }
    handleMouseMove(event) {
        if (!this.pointerLockActive)
            return;
        const movementX = event.movementX ?? 0;
        const movementY = event.movementY ?? 0;
        this.yaw += movementX * this.sensitivity;
        const pitchDelta = movementY * this.sensitivity;
        if (this.invertY) {
            this.pitch = clamp(this.pitch + pitchDelta, -this.pitchLimit, this.pitchLimit);
        }
        else {
            this.pitch = clamp(this.pitch - pitchDelta, -this.pitchLimit, this.pitchLimit);
        }
        this.updateDirectionVectors();
    }
    updateDirectionVectors() {
        const cosPitch = Math.cos(this.pitch);
        this.forward[0] = Math.sin(this.yaw) * cosPitch;
        this.forward[1] = Math.sin(this.pitch);
        this.forward[2] = Math.cos(this.yaw) * cosPitch * -1;
        // Right vector is cross(forward, up)
        this.right[0] = Math.cos(this.yaw);
        this.right[1] = 0;
        this.right[2] = Math.sin(this.yaw);
    }
}
//# sourceMappingURL=FPSCamera.js.map