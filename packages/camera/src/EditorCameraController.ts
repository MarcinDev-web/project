import type { Vec3, Mat4 } from '@engine/core/math';
import { mat4LookAt } from '@engine/core/math';
import { damp } from './utils/Damper';

/**
 * Configuration for EditorCameraController
 */
export interface EditorCameraConfig {
  /** Movement speed in units per second (default: 5.0) */
  moveSpeed?: number;
  /** Sprint multiplier when Shift is held (default: 2.0) */
  sprintMultiplier?: number;
  /** Slow multiplier when Alt is held (default: 0.3) */
  slowMultiplier?: number;
  /** Mouse sensitivity for look (radians per pixel, default: 0.003) */
  lookSensitivity?: number;
  /** Maximum pitch angle in radians (default: 89° = ~1.553) */
  pitchLimit?: number;
  /** Initial camera position (default: [0, 2, 5]) */
  initialPosition?: Vec3;
  /** Initial yaw in radians (default: 0) */
  initialYaw?: number;
  /** Initial pitch in radians (default: 0) */
  initialPitch?: number;
  /** Rotation smoothing time constant in seconds (default: 0.05). Lower = more responsive, higher = smoother. */
  rotationSmoothing?: number;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * EditorCameraController provides free-fly camera controls for the editor.
 *
 * Features:
 * - WASD movement (with Shift to sprint, Alt to slow down)
 * - Right mouse button + drag for look
 * - Q/E for vertical movement (up/down)
 * - Space/C as intuitive alternatives for up/down
 * - Mouse wheel to zoom (move forward/backward)
 * - Ctrl+Mouse wheel to adjust movement speed
 * - No collision, can fly through anything
 *
 * This is NOT for gameplay - it's for editor navigation.
 */
export class EditorCameraController {
  private readonly canvas: HTMLCanvasElement;
  private readonly viewMatrix: Mat4;

  // Camera state
  private position: Vec3;
  private yaw: number;
  private pitch: number;
  
  // Smoothed rotation targets (for exponential smoothing)
  private targetYaw: number;
  private targetPitch: number;
  private rotationSmoothing: number;

  // Configuration
  private moveSpeed: number;
  private readonly sprintMultiplier: number;
  private readonly slowMultiplier: number;
  private readonly lookSensitivity: number;
  private readonly pitchLimit: number;

  // Input state
  private readonly keysPressed = new Set<string>();
  private isRightMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Direction vectors (cached)
  private readonly forward: Vec3 = [0, 0, -1];
  private readonly right: Vec3 = [1, 0, 0];
  private readonly up: Vec3 = [0, 1, 0];

  // Scratch buffers (reused to avoid allocations in hot path)
  private readonly scratch = {
    movement: new Float32Array(3) as unknown as Vec3,
    target: new Float32Array(3) as unknown as Vec3,
  };

  // Lazy update flag for view matrix
  private viewMatrixDirty = true;

  // Event listeners (for cleanup)
  private readonly boundHandlers = {
    keydown: this.handleKeyDown.bind(this),
    keyup: this.handleKeyUp.bind(this),
    mousedown: this.handleMouseDown.bind(this),
    mouseup: this.handleMouseUp.bind(this),
    mousemove: this.handleMouseMove.bind(this),
    wheel: this.handleWheel.bind(this),
    blur: this.handleBlur.bind(this),
    focus: this.handleFocus.bind(this),
  };

  private enabled = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, config?: EditorCameraConfig) {
    this.canvas = canvas;
    this.viewMatrix = new Float32Array(16) as Mat4;

    // Apply configuration
    this.position = config?.initialPosition ? [...config.initialPosition] as Vec3 : [0, 2, 5];
    this.yaw = config?.initialYaw ?? 0;
    this.pitch = config?.initialPitch ?? 0;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.moveSpeed = config?.moveSpeed ?? 5.0;
    this.sprintMultiplier = config?.sprintMultiplier ?? 2.0;
    this.slowMultiplier = config?.slowMultiplier ?? 0.3;
    this.lookSensitivity = config?.lookSensitivity ?? 0.003;
    this.pitchLimit = config?.pitchLimit ?? (Math.PI / 2 - 0.05);
    this.rotationSmoothing = config?.rotationSmoothing ?? 0.05;

    this.updateDirectionVectors();
  }

  /**
   * Enable the controller (attach event listeners)
   */
  enable(): void {
    if (this.enabled || this.disposed) return;
    this.enabled = true;
    this.viewMatrixDirty = true; // Ensure matrix is recalculated after enable

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
  disable(): void {
    if (!this.enabled) return;
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
  dispose(): void {
    this.disable();
    this.disposed = true;
  }

  /**
   * Update camera based on input state (call every frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!this.enabled) return;
    
    // Smooth rotation towards target (even when not moving)
    this.yaw = damp(this.yaw, this.targetYaw, this.rotationSmoothing, deltaTime);
    this.pitch = damp(this.pitch, this.targetPitch, this.rotationSmoothing, deltaTime);
    
    // Update direction vectors if rotation changed
    if (Math.abs(this.yaw - this.targetYaw) > 1e-6 || Math.abs(this.pitch - this.targetPitch) > 1e-6) {
      this.updateDirectionVectors();
      this.viewMatrixDirty = true;
    }
    
    if (this.keysPressed.size === 0) return;

    // Determine speed multiplier
    let speed = this.moveSpeed;
    if (this.keysPressed.has('Shift')) {
      speed *= this.sprintMultiplier;
    } else if (this.keysPressed.has('Alt')) {
      speed *= this.slowMultiplier;
    }

    const moveAmount = speed * deltaTime;
    
    // Reset scratch buffer for movement
    this.scratch.movement[0] = 0;
    this.scratch.movement[1] = 0;
    this.scratch.movement[2] = 0;

    // Accumulate WASD movement directions (before normalization)
    let forwardAmount = 0;
    let rightAmount = 0;

    if (this.keysPressed.has('w') || this.keysPressed.has('W')) {
      forwardAmount += 1;
    }
    if (this.keysPressed.has('s') || this.keysPressed.has('S')) {
      forwardAmount -= 1;
    }
    if (this.keysPressed.has('d') || this.keysPressed.has('D')) {
      rightAmount += 1;
    }
    if (this.keysPressed.has('a') || this.keysPressed.has('A')) {
      rightAmount -= 1;
    }

    // Normalize diagonal movement to ensure consistent speed
    const horizontalLength = Math.hypot(forwardAmount, rightAmount);
    if (horizontalLength > 1e-6) {
      // Normalize to unit vector, then apply moveAmount
      const inv = 1 / horizontalLength;
      forwardAmount *= inv;
      rightAmount *= inv;
    }

    // Apply normalized horizontal movement
    this.scratch.movement[0] += (this.forward[0] * forwardAmount + this.right[0] * rightAmount) * moveAmount;
    this.scratch.movement[1] += (this.forward[1] * forwardAmount + this.right[1] * rightAmount) * moveAmount;
    this.scratch.movement[2] += (this.forward[2] * forwardAmount + this.right[2] * rightAmount) * moveAmount;

    // Q/E or Space/C for vertical movement (world up/down)
    if (
      this.keysPressed.has('e') ||
      this.keysPressed.has('E') ||
      this.keysPressed.has(' ') /* Space */ ||
      this.keysPressed.has('space')
    ) {
      this.scratch.movement[1] += moveAmount;
    }
    if (
      this.keysPressed.has('q') ||
      this.keysPressed.has('Q') ||
      this.keysPressed.has('c') ||
      this.keysPressed.has('C')
    ) {
      this.scratch.movement[1] -= moveAmount;
    }

    // Apply movement
    this.position[0] += this.scratch.movement[0];
    this.position[1] += this.scratch.movement[1];
    this.position[2] += this.scratch.movement[2];
    
    // Mark view matrix as dirty after position change
    this.viewMatrixDirty = true;
  }

  /**
   * Get the current view matrix.
   * 
   * @warning This method returns a mutable reference to the internal matrix.
   * Modifying the returned matrix will affect future calculations.
   * If you need an immutable copy, clone the returned matrix: `new Float32Array(matrix)`
   * 
   * @returns Mutable reference to the view matrix (Mat4)
   */
  getViewMatrix(): Mat4 {
    if (this.viewMatrixDirty) {
      // Calculate target in scratch buffer
      this.scratch.target[0] = this.position[0] + this.forward[0];
      this.scratch.target[1] = this.position[1] + this.forward[1];
      this.scratch.target[2] = this.position[2] + this.forward[2];
      
      mat4LookAt(this.viewMatrix, this.position, this.scratch.target, [0, 1, 0]);
      this.viewMatrixDirty = false;
    }
    return this.viewMatrix;
  }

  /**
   * Get current camera position
   */
  getPosition(): Vec3 {
    return [...this.position] as Vec3;
  }

  /**
   * Set camera position
   */
  setPosition(pos: Vec3): void {
    this.position = [...pos] as Vec3;
    this.viewMatrixDirty = true;
  }

  /**
   * Get current yaw and pitch
   */
  getOrientation(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  /**
   * Set yaw and pitch
   */
  setOrientation(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = clamp(pitch, -this.pitchLimit, this.pitchLimit);
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.updateDirectionVectors();
    this.viewMatrixDirty = true;
  }
  
  /**
   * Set rotation smoothing time constant in seconds
   * Lower values = more responsive but less smooth
   * Higher values = smoother but slower response
   */
  setRotationSmoothing(tau: number): void {
    if (tau > 0 && Number.isFinite(tau)) {
      this.rotationSmoothing = tau;
    }
  }
  
  /**
   * Get rotation smoothing time constant
   */
  getRotationSmoothing(): number {
    return this.rotationSmoothing;
  }

  /**
   * Get forward direction vector
   */
  getForward(): Vec3 {
    return [...this.forward] as Vec3;
  }

  /**
   * Get right direction vector
   */
  getRight(): Vec3 {
    return [...this.right] as Vec3;
  }

  /**
   * Get current move speed
   */
  getMoveSpeed(): number {
    return this.moveSpeed;
  }

  /**
   * Set move speed
   */
  setMoveSpeed(speed: number): void {
    if (speed > 0 && Number.isFinite(speed)) {
      this.moveSpeed = speed;
    }
  }

  /**
   * Check if controller is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ========== Event Handlers ==========

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't capture if typing in input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable === true) {
      return;
    }

    const key = event.key;
    
    // Track modifier keys for speed adjustments
    if (key === 'Shift') {
      this.keysPressed.add('Shift');
      event.preventDefault();
      return;
    }
    if (key === 'Alt') {
      this.keysPressed.add('Alt');
      event.preventDefault();
      return;
    }
    
    // Only capture movement keys (store both lowercase and original case for compatibility)
    const keyLower = key.toLowerCase();
    const isSpace = key === ' ';
    const isVerticalKey = keyLower === 'q' || keyLower === 'e' || keyLower === 'c' || isSpace;
    const isMovementKey = keyLower === 'w' || keyLower === 'a' || keyLower === 's' || keyLower === 'd';
    // Gate vertical movement (Q/E) to when RMB-look is active to reduce conflicts with editor shortcuts
    if (isMovementKey || (isVerticalKey && this.isRightMouseDown)) {
      this.keysPressed.add(key); // Store original key for Shift/Alt detection
      this.keysPressed.add(keyLower); // Store lowercase for movement detection
      event.preventDefault();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.enabled) return;
    const key = event.key;
    
    // Remove modifier keys
    if (key === 'Shift') {
      this.keysPressed.delete('Shift');
      event.preventDefault();
      return;
    }
    if (key === 'Alt') {
      this.keysPressed.delete('Alt');
      event.preventDefault();
      return;
    }
    
    const keyLower = key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e', 'c'].includes(keyLower) || key === ' ') {
      // Remove both original and lowercase versions
      this.keysPressed.delete(key);
      this.keysPressed.delete(keyLower);
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.enabled || event.button !== 2) return; // Right mouse button = 2
    event.preventDefault();
    this.isRightMouseDown = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.canvas.style.cursor = 'grabbing';
  }

  private handleMouseUp(event: MouseEvent): void {
    if (!this.enabled || event.button !== 2) return;
    this.isRightMouseDown = false;
    this.canvas.style.cursor = '';
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.enabled || !this.isRightMouseDown) return;

    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;

    // Update target rotation (will be smoothed in update())
    this.targetYaw += deltaX * this.lookSensitivity;
    this.targetPitch -= deltaY * this.lookSensitivity;
    this.targetPitch = clamp(this.targetPitch, -this.pitchLimit, this.pitchLimit);
    
    // Apply smoothing immediately for responsive feel during mouse movement
    // Use small deltaTime estimate for immediate smoothing
    const immediateDelta = 0.008; // ~120fps estimate for immediate response
    this.yaw = damp(this.yaw, this.targetYaw, this.rotationSmoothing, immediateDelta);
    this.pitch = damp(this.pitch, this.targetPitch, this.rotationSmoothing, immediateDelta);
    
    this.updateDirectionVectors();
    this.viewMatrixDirty = true;
  }

  private handleWheel(event: WheelEvent): void {
    if (!this.enabled) return;

    event.preventDefault();

    // Ctrl+Wheel: Adjust movement speed
    if (event.ctrlKey) {
      const delta = event.deltaY > 0 ? -0.5 : 0.5;
      this.moveSpeed = clamp(this.moveSpeed + delta, 0.5, 50);
      // Note: speed change doesn't affect view matrix, so no dirty flag needed
      return;
    }

    // Wheel (without Ctrl): Zoom by moving camera forward/backward
    // Use exponential zoom for more natural and responsive feel
    const deltaNormalized = event.deltaMode === 0 /* DOM_DELTA_PIXEL */ 
      ? (event.deltaY ?? 0) / 50  // Reduced divisor for more sensitivity
      : (event.deltaY ?? 0);
    
    // Exponential zoom: move camera along forward direction
    // Scale movement based on distance from origin for consistent feel at all distances
    const zoomSpeed = 0.4; // Significantly increased sensitivity
    const distanceFromOrigin = Math.hypot(this.position[0], this.position[1], this.position[2]);
    // Base movement amount scales with distance (closer = smaller steps, farther = larger steps)
    const baseMovement = Math.max(0.2, distanceFromOrigin * 0.08);
    const scale = Math.exp(-deltaNormalized * zoomSpeed);
    const zoomAmount = baseMovement * (1 - scale);
    
    // Move camera along forward direction
    this.position[0] += this.forward[0] * zoomAmount;
    this.position[1] += this.forward[1] * zoomAmount;
    this.position[2] += this.forward[2] * zoomAmount;
    this.viewMatrixDirty = true;
  }

  private handleBlur(): void {
    // Clear all input state when window loses focus
    // This prevents stuck keys when window loses focus while a key is held
    this.keysPressed.clear();
    this.isRightMouseDown = false;
    if (this.canvas) {
      this.canvas.style.cursor = '';
    }
  }

  private handleFocus(): void {
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

  private updateDirectionVectors(): void {
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

