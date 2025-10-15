import { mat4LookAt } from '../../math';
import type { Mat4, Vec3 } from '../../math';

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

  private eyeHeight: number;
  private sensitivity: number;
  private pitchLimit: number;
  private invertY = false;

  private pointerLockActive = false;
  private pendingPointerLock = false;

  constructor(canvas: HTMLCanvasElement, options?: {
    eyeHeight?: number;
    sensitivity?: number;
    pitchLimit?: number;
  }) {
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

  setSensitivity(value: number): void {
    this.sensitivity = value;
  }

  setEyeHeight(value: number): void {
    this.eyeHeight = value;
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
  }

  enable(): void {
    if (this.pointerLockActive) return;
    this.pendingPointerLock = true;
    try {
      this.canvas.requestPointerLock();
    } catch {
      this.pendingPointerLock = false;
    }
  }

  disable(): void {
    this.pendingPointerLock = false;
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
    this.updateDirectionVectors();
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

  /** Called once per frame to ensure pointer lock state. */
  update(): void {
    if (this.pendingPointerLock && !this.pointerLockActive && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  }

  private handlePointerLockChange(): void {
    const locked = document.pointerLockElement === this.canvas;
    if (locked === this.pointerLockActive) return;
    this.pointerLockActive = locked;
    this.pendingPointerLock = false;

    if (locked) {
      document.addEventListener('mousemove', this.handleMouseMove);
    } else {
      document.removeEventListener('mousemove', this.handleMouseMove);
    }
  }

  private handlePointerLockError(): void {
    this.pendingPointerLock = false;
    this.pointerLockActive = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.pointerLockActive) return;
    const movementX = event.movementX ?? 0;
    const movementY = event.movementY ?? 0;
    this.yaw += movementX * this.sensitivity;
    const pitchDelta = movementY * this.sensitivity;
    if (this.invertY) {
      this.pitch = clamp(this.pitch + pitchDelta, -this.pitchLimit, this.pitchLimit);
    } else {
      this.pitch = clamp(this.pitch - pitchDelta, -this.pitchLimit, this.pitchLimit);
    }
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
