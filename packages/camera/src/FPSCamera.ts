import { mat4LookAt } from '@engine/core/math';
import type { Mat4, Vec3 } from '@engine/core/math';
import { damp } from './utils/Damper';
import { clamp, type IFPSCameraCollisionProvider } from './types';

/** Estimated frame time for immediate response smoothing (~120fps) */
const IMMEDIATE_RESPONSE_DELTA = 0.008;

/**
 * Camera shake definition for effects like recoil or explosions
 */
interface CameraShake {
  intensity: number; // Maximum intensity
  duration: number; // Duration in seconds
  decay: number; // Decay rate (0-1, higher = faster decay)
  timer: number; // Remaining time
  seed: number; // Seed for random noise
}

/**
 * FPSCamera provides first-person camera controls with pointer lock support.
 *
 * Features:
 * - Track yaw/pitch orientation using mouse movement
 * - Request/release pointer lock on demand
 * - Produce view matrix from tracked orientation and player position
 * - Expose forward/right direction vectors for movement input
 * - Camera roll (rotation around forward axis)
 * - Camera shake system (for recoil, explosions, etc.)
 * - Head bob effect (for walking/running)
 * - Collision detection (prevent camera from penetrating geometry)
 * - Dynamic FOV effects (sprint/aim with smooth transitions)
 *
 * @example
 * ```typescript
 * const camera = new FPSCamera(canvas, {
 *   eyeHeight: 1.6,
 *   sensitivity: 0.0025,
 *   headBobEnabled: true,
 * });
 *
 * camera.enable();
 * camera.update(deltaTime, playerVelocity);
 *
 * // Add shake effect (e.g., on weapon fire)
 * camera.addShake(0.1, 0.2, 0.5);
 *
 * // Set camera roll (e.g., for damage effect)
 * camera.setRoll(0.1);
 *
 * // Enable collision detection with PhysicsWorld
 * import { FPSRaycastCollision } from '@engine/camera';
 * const collisionProvider = new FPSRaycastCollision({
 *   physics: physicsWorld,
 *   radius: 0.2,
 *   backoff: 0.03,
 * });
 * camera.setCollisionProvider(collisionProvider);
 * camera.setCollisionEnabled(true);
 *
 * // Set FOV multiplier based on player state (sprint/aim)
 * if (isSprinting) {
 *   camera.setFovMultiplier(camera.getSprintMultiplier());
 * } else if (isAiming) {
 *   camera.setFovMultiplier(camera.getAimMultiplier());
 * } else {
 *   camera.setFovMultiplier(1.0); // Normal
 * }
 *
 * const viewMatrix = camera.getViewMatrix(playerPosition);
 * // CameraDirector automatically uses camera.getFov() for projection matrix
 * ```
 */
export class FPSCamera {
  private readonly canvas: HTMLCanvasElement;
  private readonly viewMatrix: Mat4;
  private readonly forward: Vec3 = [0, 0, -1];
  private readonly right: Vec3 = [1, 0, 0];

  // Temporary vectors reused in getViewMatrix to avoid allocations
  private readonly tempEye: Vec3 = [0, 0, 0];
  private readonly tempTarget: Vec3 = [0, 0, 0];
  private readonly tempUp: Vec3 = [0, 1, 0];
  private static readonly TEMP_UP: Vec3 = [0, 1, 0];

  private yaw = 0;
  private pitch = 0;
  
  // Smoothed rotation targets (for exponential smoothing)
  private targetYaw: number;
  private targetPitch: number;
  private rotationSmoothing: number;

  // Camera roll (rotation around forward axis)
  private targetRoll = 0;
  private currentRoll = 0;
  private rollSmoothing: number;

  // Camera shake system
  private activeShakes: CameraShake[] = [];
  private readonly shakeOffset: Vec3 = [0, 0, 0];
  private readonly shakeRotation: Vec3 = [0, 0, 0]; // [pitch, yaw, roll]

  // Head bob system
  private headBobEnabled = false;
  private headBobIntensity = 0.02;
  private headBobSpeed = 10.0;
  private headBobTimer = 0;
  private readonly headBobOffset: Vec3 = [0, 0, 0];

  // Collision detection system
  private collisionEnabled = false;
  private collisionRadius = 0.2;
  private collisionProvider: IFPSCameraCollisionProvider | null = null;
  private readonly tempForward: Vec3 = [0, 0, -1]; // Temporary forward for collision

  // FOV effects system
  private baseFov: number;
  private currentFov: number;
  private targetFov: number;
  private fovSmoothing: number;
  private fovMultiplier = 1.0;
  private sprintMultiplier = 1.1;
  private aimMultiplier = 0.7;

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
    /** Roll smoothing time constant in seconds (default: 0.05). Lower = more responsive, higher = smoother. */
    rollSmoothing?: number;
    /** Enable head bob effect (default: false) */
    headBobEnabled?: boolean;
    /** Head bob intensity (default: 0.02) */
    headBobIntensity?: number;
    /** Head bob speed multiplier (default: 10.0) */
    headBobSpeed?: number;
    /** Base FOV in radians (default: ~72° = 1.2566) */
    baseFov?: number;
    /** FOV smoothing time constant in seconds (default: 0.1). Lower = more responsive, higher = smoother. */
    fovSmoothing?: number;
    /** Sprint FOV multiplier (default: 1.1 = +10%) */
    sprintMultiplier?: number;
    /** Aim FOV multiplier (default: 0.7 = -30%) */
    aimMultiplier?: number;
  }) {
    this.canvas = canvas;
    this.eyeHeight = options?.eyeHeight ?? 1.6;
    this.sensitivity = options?.sensitivity ?? 0.0025;
    this.pitchLimit = options?.pitchLimit ?? (Math.PI / 2 - 0.05);
    this.rotationSmoothing = options?.rotationSmoothing ?? 0.03;
    this.rollSmoothing = options?.rollSmoothing ?? 0.05;
    this.headBobEnabled = options?.headBobEnabled ?? false;
    this.headBobIntensity = options?.headBobIntensity ?? 0.02;
    this.headBobSpeed = options?.headBobSpeed ?? 10.0;
    
    // FOV system initialization
    this.baseFov = options?.baseFov ?? (72 * Math.PI) / 180; // Default 72 degrees
    this.fovSmoothing = options?.fovSmoothing ?? 0.1;
    this.sprintMultiplier = options?.sprintMultiplier ?? 1.1;
    this.aimMultiplier = options?.aimMultiplier ?? 0.7;
    this.currentFov = this.baseFov;
    this.targetFov = this.baseFov;
    
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
    if (tau <= 0 || !Number.isFinite(tau)) {
      console.warn(`FPSCamera: Invalid rotationSmoothing value: ${tau}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.rotationSmoothing = tau;
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

  /**
   * Set camera roll angle in radians (rotation around forward axis)
   */
  setRoll(roll: number): void {
    this.targetRoll = roll;
  }

  /**
   * Get current camera roll angle in radians
   */
  getRoll(): number {
    return this.currentRoll;
  }

  /**
   * Set roll smoothing time constant in seconds
   */
  setRollSmoothing(tau: number): void {
    if (tau <= 0 || !Number.isFinite(tau)) {
      console.warn(`FPSCamera: Invalid rollSmoothing value: ${tau}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.rollSmoothing = tau;
  }

  /**
   * Add a camera shake effect (e.g., for recoil or explosions)
   * @param intensity Maximum shake intensity
   * @param duration Duration in seconds
   * @param decay Decay rate (0-1, higher = faster decay, default: 0.5)
   */
  addShake(intensity: number, duration: number, decay: number = 0.5): void {
    if (intensity <= 0 || duration <= 0 || !Number.isFinite(intensity) || !Number.isFinite(duration)) {
      console.warn(`FPSCamera: Invalid shake parameters. Ignoring.`);
      return;
    }
    this.activeShakes.push({
      intensity,
      duration,
      decay: clamp(decay, 0, 1),
      timer: duration,
      seed: Math.random() * 1000,
    });
  }

  /**
   * Clear all active camera shakes
   */
  clearShakes(): void {
    this.activeShakes.length = 0;
    this.shakeOffset[0] = 0;
    this.shakeOffset[1] = 0;
    this.shakeOffset[2] = 0;
    this.shakeRotation[0] = 0;
    this.shakeRotation[1] = 0;
    this.shakeRotation[2] = 0;
  }

  /**
   * Get number of active camera shakes
   */
  getShakeCount(): number {
    return this.activeShakes.length;
  }

  /**
   * Enable or disable head bob effect
   */
  setHeadBobEnabled(enabled: boolean): void {
    this.headBobEnabled = enabled;
    if (!enabled) {
      this.headBobTimer = 0;
      this.headBobOffset[0] = 0;
      this.headBobOffset[1] = 0;
      this.headBobOffset[2] = 0;
    }
  }

  /**
   * Set head bob intensity
   */
  setHeadBobIntensity(intensity: number): void {
    if (intensity < 0 || !Number.isFinite(intensity)) {
      console.warn(`FPSCamera: Invalid headBobIntensity value: ${intensity}. Must be >= 0 and finite. Ignoring.`);
      return;
    }
    this.headBobIntensity = intensity;
  }

  /**
   * Set head bob speed multiplier
   */
  setHeadBobSpeed(speed: number): void {
    if (speed <= 0 || !Number.isFinite(speed)) {
      console.warn(`FPSCamera: Invalid headBobSpeed value: ${speed}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.headBobSpeed = speed;
  }

  /**
   * Get current head bob offset (for debugging)
   */
  getHeadBobOffset(): Readonly<Vec3> {
    return this.headBobOffset;
  }

  /**
   * Enable or disable collision detection
   */
  setCollisionEnabled(enabled: boolean): void {
    this.collisionEnabled = enabled;
  }

  /**
   * Set collision radius (eye sphere radius)
   */
  setCollisionRadius(radius: number): void {
    if (radius <= 0 || !Number.isFinite(radius)) {
      console.warn(`FPSCamera: Invalid collisionRadius value: ${radius}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.collisionRadius = radius;
  }

  /**
   * Get collision radius
   */
  getCollisionRadius(): number {
    return this.collisionRadius;
  }

  /**
   * Set collision provider (null to disable)
   */
  setCollisionProvider(provider: IFPSCameraCollisionProvider | null): void {
    // Dispose old provider if it has dispose method
    if (this.collisionProvider?.dispose) {
      this.collisionProvider.dispose();
    }
    this.collisionProvider = provider;
  }

  /**
   * Set base FOV in radians
   */
  setBaseFov(fov: number): void {
    if (fov <= 0 || !Number.isFinite(fov)) {
      console.warn(`FPSCamera: Invalid baseFov value: ${fov}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.baseFov = fov;
    // Recalculate target FOV with current multiplier
    this.targetFov = this.baseFov * this.fovMultiplier;
    // Also update currentFov immediately if multiplier is 1.0 (no smoothing needed for base change)
    if (this.fovMultiplier === 1.0) {
      this.currentFov = this.baseFov;
    }
  }

  /**
   * Get current FOV in radians (for CameraDirector projection matrix)
   */
  getFov(): number {
    return this.currentFov;
  }

  /**
   * Set FOV multiplier (1.0 = normal, >1.0 = wider, <1.0 = narrower)
   */
  setFovMultiplier(multiplier: number): void {
    if (multiplier <= 0 || !Number.isFinite(multiplier)) {
      console.warn(`FPSCamera: Invalid fovMultiplier value: ${multiplier}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.fovMultiplier = multiplier;
    this.targetFov = this.baseFov * this.fovMultiplier;
  }

  /**
   * Get current FOV multiplier
   */
  getFovMultiplier(): number {
    return this.fovMultiplier;
  }

  /**
   * Set sprint FOV multiplier (default: 1.1 = +10%)
   */
  setSprintMultiplier(multiplier: number): void {
    if (multiplier <= 0 || !Number.isFinite(multiplier)) {
      console.warn(`FPSCamera: Invalid sprintMultiplier value: ${multiplier}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.sprintMultiplier = multiplier;
  }

  /**
   * Get sprint FOV multiplier
   */
  getSprintMultiplier(): number {
    return this.sprintMultiplier;
  }

  /**
   * Set aim FOV multiplier (default: 0.7 = -30%)
   */
  setAimMultiplier(multiplier: number): void {
    if (multiplier <= 0 || !Number.isFinite(multiplier)) {
      console.warn(`FPSCamera: Invalid aimMultiplier value: ${multiplier}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.aimMultiplier = multiplier;
  }

  /**
   * Get aim FOV multiplier
   */
  getAimMultiplier(): number {
    return this.aimMultiplier;
  }

  /**
   * Set FOV smoothing time constant in seconds
   */
  setFovSmoothing(tau: number): void {
    if (tau <= 0 || !Number.isFinite(tau)) {
      console.warn(`FPSCamera: Invalid fovSmoothing value: ${tau}. Must be > 0 and finite. Ignoring.`);
      return;
    }
    this.fovSmoothing = tau;
  }

  /** Returns the view matrix for the given player world position. */
  getViewMatrix(playerPosition: Vec3): Mat4 {
    // Reuse temporary vectors to avoid allocations in hot path
    // Base eye position
    this.tempEye[0] = playerPosition[0];
    this.tempEye[1] = playerPosition[1] + this.eyeHeight;
    this.tempEye[2] = playerPosition[2];

    // Apply head bob offset
    if (this.headBobEnabled) {
      this.tempEye[0] += this.headBobOffset[0];
      this.tempEye[1] += this.headBobOffset[1];
      this.tempEye[2] += this.headBobOffset[2];
    }

    // Apply shake offset
    this.tempEye[0] += this.shakeOffset[0];
    this.tempEye[1] += this.shakeOffset[1];
    this.tempEye[2] += this.shakeOffset[2];

    // Calculate forward direction with shake rotation applied
    const effectiveYaw = this.yaw + this.shakeRotation[1];
    const effectivePitch = this.pitch + this.shakeRotation[0];
    const cosPitch = Math.cos(effectivePitch);
    const forwardX = Math.sin(effectiveYaw) * cosPitch;
    const forwardY = Math.sin(effectivePitch);
    const forwardZ = Math.cos(effectiveYaw) * cosPitch * -1;

    // Store forward for collision detection
    this.tempForward[0] = forwardX;
    this.tempForward[1] = forwardY;
    this.tempForward[2] = forwardZ;

    // Apply collision detection if enabled
    if (this.collisionEnabled && this.collisionProvider) {
      this.collisionProvider.resolveEye(this.tempEye, this.tempEye, this.tempForward);
    }

    // Target position
    this.tempTarget[0] = this.tempEye[0] + forwardX;
    this.tempTarget[1] = this.tempEye[1] + forwardY;
    this.tempTarget[2] = this.tempEye[2] + forwardZ;

    // Calculate up vector with roll applied
    if (Math.abs(this.currentRoll) > 1e-6) {
      const cosRoll = Math.cos(this.currentRoll);
      const sinRoll = Math.sin(this.currentRoll);
      // Rotate up vector around forward axis
      this.tempUp[0] = sinRoll;
      this.tempUp[1] = cosRoll;
      this.tempUp[2] = 0;
    } else {
      this.tempUp[0] = FPSCamera.TEMP_UP[0];
      this.tempUp[1] = FPSCamera.TEMP_UP[1];
      this.tempUp[2] = FPSCamera.TEMP_UP[2];
    }

    mat4LookAt(this.viewMatrix, this.tempEye, this.tempTarget, this.tempUp);
    return this.viewMatrix;
  }

  /**
   * Returns the forward direction vector.
   * Note: Returns a reference to internal array. Do not mutate.
   */
  getForwardDirection(): Readonly<Vec3> {
    return this.forward;
  }

  /**
   * Returns the right direction vector.
   * Note: Returns a reference to internal array. Do not mutate.
   */
  getRightDirection(): Readonly<Vec3> {
    return this.right;
  }

  /** Called once per frame to ensure pointer lock state and smooth rotation. */
  update(deltaTime?: number, playerVelocity?: Vec3): void {
    if (this.pendingPointerLock && !this.pointerLockActive && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
    
    const validDelta = deltaTime !== undefined && deltaTime > 0 && Number.isFinite(deltaTime);
    
    // Smooth rotation towards target if pointer lock is active
    if (this.pointerLockActive && validDelta) {
      this.yaw = damp(this.yaw, this.targetYaw, this.rotationSmoothing, deltaTime);
      this.pitch = damp(this.pitch, this.targetPitch, this.rotationSmoothing, deltaTime);
      
      // Update direction vectors if rotation changed
      if (Math.abs(this.yaw - this.targetYaw) > 1e-6 || Math.abs(this.pitch - this.targetPitch) > 1e-6) {
        this.updateDirectionVectors();
      }
    }

    // Update camera roll
    if (validDelta) {
      this.currentRoll = damp(this.currentRoll, this.targetRoll, this.rollSmoothing, deltaTime);
    }

    // Update camera shake
    if (validDelta) {
      this.updateCameraShake(deltaTime);
    }

    // Update head bob
    if (this.headBobEnabled && validDelta) {
      this.updateHeadBob(deltaTime, playerVelocity);
    }

    // Update FOV smoothing
    if (validDelta) {
      this.currentFov = damp(this.currentFov, this.targetFov, this.fovSmoothing, deltaTime);
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
    this.yaw = damp(this.yaw, this.targetYaw, this.rotationSmoothing, IMMEDIATE_RESPONSE_DELTA);
    this.pitch = damp(this.pitch, this.targetPitch, this.rotationSmoothing, IMMEDIATE_RESPONSE_DELTA);
    
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

  /**
   * Update camera shake system
   */
  private updateCameraShake(deltaTime: number): void {
    // Reset shake accumulators
    this.shakeOffset[0] = 0;
    this.shakeOffset[1] = 0;
    this.shakeOffset[2] = 0;
    this.shakeRotation[0] = 0;
    this.shakeRotation[1] = 0;
    this.shakeRotation[2] = 0;

    // Update and accumulate all active shakes
    for (let i = this.activeShakes.length - 1; i >= 0; i--) {
      const shake = this.activeShakes[i];
      if (!shake) continue;
      
      shake.timer -= deltaTime;

      if (shake.timer <= 0) {
        // Remove expired shake
        this.activeShakes.splice(i, 1);
        continue;
      }

      // Calculate current intensity with decay
      const progress = shake.timer / shake.duration;
      const currentIntensity = shake.intensity * Math.pow(progress, 1 / (shake.decay + 0.001));

      // Generate noise using seed-based pseudo-random
      const time = shake.duration - shake.timer;
      const noiseX = this.seededNoise(shake.seed + time * 10.0);
      const noiseY = this.seededNoise(shake.seed + 100 + time * 10.0);
      const noiseZ = this.seededNoise(shake.seed + 200 + time * 10.0);
      const noisePitch = this.seededNoise(shake.seed + 300 + time * 10.0);
      const noiseYaw = this.seededNoise(shake.seed + 400 + time * 10.0);
      const noiseRoll = this.seededNoise(shake.seed + 500 + time * 10.0);

      // Accumulate shake offset
      this.shakeOffset[0] += noiseX * currentIntensity * 0.5;
      this.shakeOffset[1] += noiseY * currentIntensity * 0.5;
      this.shakeOffset[2] += noiseZ * currentIntensity * 0.5;

      // Accumulate shake rotation (in radians)
      this.shakeRotation[0] += noisePitch * currentIntensity * 0.1;
      this.shakeRotation[1] += noiseYaw * currentIntensity * 0.1;
      this.shakeRotation[2] += noiseRoll * currentIntensity * 0.05;
    }
  }

  /**
   * Generate seeded pseudo-random noise value between -1 and 1
   */
  private seededNoise(seed: number): number {
    // Simple hash-based noise
    const x = Math.sin(seed) * 10000;
    return (x - Math.floor(x)) * 2 - 1;
  }

  /**
   * Update head bob system
   */
  private updateHeadBob(deltaTime: number, playerVelocity?: Vec3): void {
    if (!playerVelocity) {
      // No velocity, reset bob
      this.headBobTimer = 0;
      this.headBobOffset[0] = 0;
      this.headBobOffset[1] = 0;
      this.headBobOffset[2] = 0;
      return;
    }

    // Calculate horizontal speed (XZ plane)
    const horizontalSpeed = Math.sqrt(playerVelocity[0] * playerVelocity[0] + playerVelocity[2] * playerVelocity[2]);
    
    if (horizontalSpeed < 0.01) {
      // Not moving, decay bob
      this.headBobTimer *= 0.9;
    } else {
      // Update timer based on speed
      this.headBobTimer += horizontalSpeed * this.headBobSpeed * deltaTime;
    }

    // Calculate bob offset using sine/cosine waves
    const bobY = Math.sin(this.headBobTimer) * this.headBobIntensity;
    const bobX = Math.cos(this.headBobTimer * 0.5) * this.headBobIntensity * 0.5;
    const bobZ = Math.sin(this.headBobTimer * 0.5) * this.headBobIntensity * 0.3;

    // Apply intensity scaling based on speed
    const speedFactor = Math.min(horizontalSpeed / 5.0, 1.0);
    
    this.headBobOffset[0] = bobX * speedFactor;
    this.headBobOffset[1] = bobY * speedFactor;
    this.headBobOffset[2] = bobZ * speedFactor;
  }
}

