import { mat4LookAt } from '@engine/core/math';
import type { Mat4, Vec3 } from '@engine/core/math';
import { damp } from './utils/Damper';

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
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
  private readonly canvas: HTMLCanvasElement;
  private readonly viewMatrix: Mat4;
  private readonly forward: Vec3 = [0, 0, -1];
  private readonly right: Vec3 = [1, 0, 0];

  private yaw = 0;
  private pitch = 0;
  
  // Smoothed rotation targets (for exponential smoothing)
  private targetYaw: number;
  private targetPitch: number;
  private rotationSmoothing: number;

  private eyeHeight: number;
  private sensitivity: number;
  private pitchLimit: number;
  private invertY = false;

  private pointerLockActive = false;
  private pendingPointerLock = false;
  private pointerDownHandler: ((event: PointerEvent) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, options?: {
    eyeHeight?: number;
    sensitivity?: number;
    pitchLimit?: number;
    /** Rotation smoothing time constant in seconds (default: 0.03). Lower = more responsive, higher = smoother. */
    rotationSmoothing?: number;
  }) {
    this.canvas = canvas;
    this.eyeHeight = options?.eyeHeight ?? 1.6;
    this.sensitivity = options?.sensitivity ?? 0.0025;
    this.pitchLimit = options?.pitchLimit ?? (Math.PI / 2 - 0.05);
    this.rotationSmoothing = options?.rotationSmoothing ?? 0.03;
    this.viewMatrix = new Float32Array(16);
    
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;

    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handlePointerLockError = this.handlePointerLockError.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);

    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
  }

  setSensitivity(value: number): void {
    this.sensitivity = value;
  }

  setEyeHeight(value: number): void {
    this.eyeHeight = value;
  }

  getEyeHeight(): number {
    return this.eyeHeight;
  }

  setPitchLimit(value: number): void {
    this.pitchLimit = value;
    this.pitch = clamp(this.pitch, -this.pitchLimit, this.pitchLimit);
    this.updateDirectionVectors();
  }

  setInvertY(value: boolean): void {
    this.invertY = value;
  }

  dispose(): void {
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
    document.removeEventListener('mousemove', this.handleMouseMove);
    if (this.pointerDownHandler) {
      this.canvas.removeEventListener('pointerdown', this.pointerDownHandler, true);
      this.pointerDownHandler = null;
    }
  }

  enable(): void {
    if (this.pointerLockActive) return;
    this.pendingPointerLock = true;
    if (!this.pointerDownHandler) {
      this.pointerDownHandler = this.handlePointerDown;
      this.canvas.addEventListener('pointerdown', this.pointerDownHandler, { capture: true });
    }
    try {
      this.canvas.requestPointerLock();
    } catch {
      this.pendingPointerLock = false;
    }
  }

  disable(): void {
    this.pendingPointerLock = false;
    if (this.pointerDownHandler) {
      this.canvas.removeEventListener('pointerdown', this.pointerDownHandler, true);
      this.pointerDownHandler = null;
    }
    if (!this.pointerLockActive) return;
    try {
      document.exitPointerLock();
    } catch {
      // ignore pointer lock exit errors
    }
  }

  setYawPitch(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = clamp(pitch, -this.pitchLimit, this.pitchLimit);
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.updateDirectionVectors();
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

  getYawPitch(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  /** Returns the view matrix for the given player world position. */
  getViewMatrix(playerPosition: Vec3): Mat4 {
    const eyeX = playerPosition[0];
    const eyeY = playerPosition[1] + this.eyeHeight;
    const eyeZ = playerPosition[2];

    const targetX = eyeX + this.forward[0];
    const targetY = eyeY + this.forward[1];
    const targetZ = eyeZ + this.forward[2];

    mat4LookAt(this.viewMatrix, [eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 1, 0]);
    return this.viewMatrix;
  }

  getForwardDirection(): Vec3 {
    return this.forward;
  }

  getRightDirection(): Vec3 {
    return this.right;
  }

  /** Called once per frame to ensure pointer lock state and smooth rotation. */
  update(deltaTime?: number): void {
    if (this.pendingPointerLock && !this.pointerLockActive && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
    
    // Smooth rotation towards target if pointer lock is active
    if (this.pointerLockActive && deltaTime !== undefined) {
      this.yaw = damp(this.yaw, this.targetYaw, this.rotationSmoothing, deltaTime);
      this.pitch = damp(this.pitch, this.targetPitch, this.rotationSmoothing, deltaTime);
      
      // Update direction vectors if rotation changed
      if (Math.abs(this.yaw - this.targetYaw) > 1e-6 || Math.abs(this.pitch - this.targetPitch) > 1e-6) {
        this.updateDirectionVectors();
      }
    }
  }

  private handlePointerLockChange(): void {
    const locked = document.pointerLockElement === this.canvas;
    if (locked === this.pointerLockActive) return;
    this.pointerLockActive = locked;
    this.pendingPointerLock = false;

    if (!locked && !this.pointerDownHandler) {
      this.pointerDownHandler = this.handlePointerDown;
      this.canvas.addEventListener('pointerdown', this.pointerDownHandler, { capture: true });
    }

    if (locked) {
      document.addEventListener('mousemove', this.handleMouseMove);
      if (this.pointerDownHandler) {
        this.canvas.removeEventListener('pointerdown', this.pointerDownHandler, true);
        this.pointerDownHandler = null;
      }
    } else {
      document.removeEventListener('mousemove', this.handleMouseMove);
    }
  }

  private handlePointerLockError(): void {
    this.pendingPointerLock = false;
    this.pointerLockActive = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.pointerLockActive && !this.pendingPointerLock) {
      this.pendingPointerLock = true;
      try {
        this.canvas.requestPointerLock();
      } catch {
        this.pendingPointerLock = false;
      }
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.pointerLockActive) return;
    const movementX = event.movementX ?? 0;
    const movementY = event.movementY ?? 0;
    
    // Update target rotation (will be smoothed in update())
    this.targetYaw += movementX * this.sensitivity;
    const pitchDelta = movementY * this.sensitivity;
    if (this.invertY) {
      this.targetPitch = clamp(this.targetPitch + pitchDelta, -this.pitchLimit, this.pitchLimit);
    } else {
      this.targetPitch = clamp(this.targetPitch - pitchDelta, -this.pitchLimit, this.pitchLimit);
    }
    
    // Apply smoothing immediately for responsive feel during mouse movement
    const immediateDelta = 0.008; // ~120fps estimate for immediate response
    this.yaw = damp(this.yaw, this.targetYaw, this.rotationSmoothing, immediateDelta);
    this.pitch = damp(this.pitch, this.targetPitch, this.rotationSmoothing, immediateDelta);
    
    this.updateDirectionVectors();
  }

  private updateDirectionVectors(): void {
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

