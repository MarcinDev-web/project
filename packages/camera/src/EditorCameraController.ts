import type { Vec3, Mat4 } from '@engine/core/math';
import { mat4LookAt } from '@engine/core/math';

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
 * - Mouse wheel to adjust movement speed
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

  // Event listeners (for cleanup)
  private readonly boundHandlers = {
    keydown: this.handleKeyDown.bind(this),
    keyup: this.handleKeyUp.bind(this),
    mousedown: this.handleMouseDown.bind(this),
    mouseup: this.handleMouseUp.bind(this),
    mousemove: this.handleMouseMove.bind(this),
    wheel: this.handleWheel.bind(this),
    blur: this.handleBlur.bind(this),
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
  enable(): void {
    if (this.enabled || this.disposed) return;
    console.log('[EditorCameraController] Enabling...');
    this.enabled = true;

    window.addEventListener('keydown', this.boundHandlers.keydown);
    window.addEventListener('keyup', this.boundHandlers.keyup);
    this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
    window.addEventListener('mouseup', this.boundHandlers.mouseup);
    window.addEventListener('mousemove', this.boundHandlers.mousemove);
    this.canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
    window.addEventListener('blur', this.boundHandlers.blur);
    console.log('[EditorCameraController] ✓ Enabled, listening for events');
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
    
    if (this.keysPressed.size === 0) return;

    console.log('[EditorCameraController] Update called, keys:', Array.from(this.keysPressed), 'deltaTime:', deltaTime);

    // Determine speed multiplier
    let speed = this.moveSpeed;
    if (this.keysPressed.has('Shift')) {
      speed *= this.sprintMultiplier;
    } else if (this.keysPressed.has('Alt')) {
      speed *= this.slowMultiplier;
    }

    const moveAmount = speed * deltaTime;
    const movement: Vec3 = [0, 0, 0];

    // WASD movement (horizontal plane) - check both lowercase and original key
    const hasW = Array.from(this.keysPressed).some(k => k.toLowerCase() === 'w');
    const hasS = Array.from(this.keysPressed).some(k => k.toLowerCase() === 's');
    const hasD = Array.from(this.keysPressed).some(k => k.toLowerCase() === 'd');
    const hasA = Array.from(this.keysPressed).some(k => k.toLowerCase() === 'a');
    const hasE = Array.from(this.keysPressed).some(k => k.toLowerCase() === 'e');
    const hasQ = Array.from(this.keysPressed).some(k => k.toLowerCase() === 'q');
    
    if (hasW) {
      movement[0] += this.forward[0] * moveAmount;
      movement[1] += this.forward[1] * moveAmount;
      movement[2] += this.forward[2] * moveAmount;
    }
    if (hasS) {
      movement[0] -= this.forward[0] * moveAmount;
      movement[1] -= this.forward[1] * moveAmount;
      movement[2] -= this.forward[2] * moveAmount;
    }
    if (hasD) {
      movement[0] += this.right[0] * moveAmount;
      movement[1] += this.right[1] * moveAmount;
      movement[2] += this.right[2] * moveAmount;
    }
    if (hasA) {
      movement[0] -= this.right[0] * moveAmount;
      movement[1] -= this.right[1] * moveAmount;
      movement[2] -= this.right[2] * moveAmount;
    }

    // Q/E for vertical movement (world up/down)
    if (hasE) {
      movement[1] += moveAmount;
    }
    if (hasQ) {
      movement[1] -= moveAmount;
    }

    // Apply movement
    const oldPos = [...this.position];
    this.position[0] += movement[0];
    this.position[1] += movement[1];
    this.position[2] += movement[2];
    console.log('[EditorCameraController] Position:', oldPos, '→', this.position, 'movement:', movement);
  }

  /**
   * Get the current view matrix
   */
  getViewMatrix(): Mat4 {
    const target: Vec3 = [
      this.position[0] + this.forward[0],
      this.position[1] + this.forward[1],
      this.position[2] + this.forward[2],
    ];
    mat4LookAt(this.viewMatrix, this.position, target, [0, 1, 0]);
    
    // Debug: log occasionally
    if (Math.random() < 0.01) {
      console.log('[EditorCameraController] getViewMatrix called, position:', this.position, 'forward:', this.forward);
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
    this.updateDirectionVectors();
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
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    const key = event.key.toLowerCase();
    
    // Only capture movement keys
    if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
      console.log('[EditorCameraController] Key pressed:', event.key);
      this.keysPressed.add(event.key);
      event.preventDefault();
      event.stopPropagation(); // Stop event from reaching KeyboardHandler
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.enabled) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
      this.keysPressed.delete(event.key);
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

    // Apply rotation
    this.yaw += deltaX * this.lookSensitivity;
    this.pitch -= deltaY * this.lookSensitivity;
    this.pitch = clamp(this.pitch, -this.pitchLimit, this.pitchLimit);

    this.updateDirectionVectors();
  }

  private handleWheel(event: WheelEvent): void {
    if (!this.enabled) return;

    // Only adjust speed if Ctrl is held
    if (!event.ctrlKey) return;

    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.5 : 0.5;
    this.moveSpeed = clamp(this.moveSpeed + delta, 0.5, 50);
  }

  private handleBlur(): void {
    // Clear all input state when window loses focus
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

