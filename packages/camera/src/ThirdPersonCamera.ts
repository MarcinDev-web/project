import type { Vec3, Mat4 } from '@engine/core/math';
import { mat4LookAt } from '@engine/core/math';
import type { PhysicsWorld } from '@engine/world';
import { damp } from './utils/Damper';

/**
 * Configuration for ThirdPersonCamera
 */
export interface ThirdPersonCameraConfig {
  /** Distance behind player (default: 3.5) */
  distance?: number;
  /** Height above player pivot (default: 1.2) */
  height?: number;
  /** Right offset for over-shoulder view (default: 0.6) */
  shoulderOffset?: number;
  /** Position lerp speed (default: 5.0) */
  followSpeed?: number;
  /** Auto-rotation speed toward player forward (default: 3.0) */
  rotationSpeed?: number;
  /** Sphere cast radius for collision detection (default: 0.3) */
  collisionRadius?: number;
  /** Pitch range in degrees [min, max] (default: [-30, 60]) */
  pitchRange?: [number, number];
  /** Mouse sensitivity for manual orbit (default: 0.003) */
  mouseSensitivity?: number;
  /** Enable auto-rotation (default: true) */
  enableAutoRotation?: boolean;
  /** Rotation smoothing time constant in seconds (default: 0.04). Lower = more responsive, higher = smoother. */
  rotationSmoothing?: number;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Lerp between two numbers
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Lerp between two Vec3s
 */
function lerpVec3(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
  return out;
}

/**
 * ThirdPersonCamera provides over-the-shoulder camera controls for gameplay.
 *
 * Features:
 * - Fixed offset behind and above player (configurable)
 * - Mouse drag to orbit around player
 * - Auto-rotation: gradually rotates to follow player forward direction
 * - Collision-aware: pulls camera closer when hitting walls
 * - Smooth follow: lerp camera position to target position
 *
 * This is for gameplay third-person perspective.
 */
export class ThirdPersonCamera {
  private readonly canvas: HTMLCanvasElement;
  private readonly physicsWorld: PhysicsWorld | null;
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
  private distance: number;
  private height: number;
  private shoulderOffset: number;
  private followSpeed: number;
  private rotationSpeed: number;
  private collisionRadius: number;
  private pitchMin: number;
  private pitchMax: number;
  private mouseSensitivity: number;
  private enableAutoRotation: boolean;

  // Input state
  private isMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private activePointerId: number | null = null;

  // Direction vectors (cached)
  private readonly forward: Vec3 = [0, 0, -1];
  private readonly right: Vec3 = [1, 0, 0];

  // Event listeners (for cleanup)
  private readonly boundHandlers = {
    pointerdown: this.handlePointerDown.bind(this),
    pointerup: this.handlePointerUp.bind(this),
    pointercancel: this.handlePointerCancel.bind(this),
    mousedown: this.handleMouseDown.bind(this),
    mouseup: this.handleMouseUp.bind(this),
    mousemove: this.handleMouseMove.bind(this),
    blur: this.handleBlur.bind(this),
    pointerlockchange: this.handlePointerLockChange.bind(this),
  };

  private enabled = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, physicsWorld: PhysicsWorld | null, config?: ThirdPersonCameraConfig) {
    this.canvas = canvas;
    this.physicsWorld = physicsWorld;
    this.viewMatrix = new Float32Array(16) as Mat4;

    // Apply configuration
    this.distance = config?.distance ?? 3.5;
    this.height = config?.height ?? 1.2;
    this.shoulderOffset = config?.shoulderOffset ?? 0.6;
    this.followSpeed = config?.followSpeed ?? 5.0;
    this.rotationSpeed = config?.rotationSpeed ?? 3.0;
    this.collisionRadius = config?.collisionRadius ?? 0.3;
    this.mouseSensitivity = config?.mouseSensitivity ?? 0.003;
    this.enableAutoRotation = config?.enableAutoRotation ?? true;
    this.rotationSmoothing = config?.rotationSmoothing ?? 0.04;

    const pitchRange = config?.pitchRange ?? [-30, 60];
    this.pitchMin = (pitchRange[0] * Math.PI) / 180;
    this.pitchMax = (pitchRange[1] * Math.PI) / 180;

    // Initialize camera behind player
    this.position = [0, this.height, this.distance];
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;

    this.updateDirectionVectors();
  }

  /**
   * Enable the camera (attach event listeners)
   */
  enable(): void {
    if (this.enabled || this.disposed) return;
    this.enabled = true;

    this.canvas.addEventListener('pointerdown', this.boundHandlers.pointerdown, { capture: true });
    this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
    window.addEventListener('pointerup', this.boundHandlers.pointerup);
    window.addEventListener('pointercancel', this.boundHandlers.pointercancel);
    window.addEventListener('mouseup', this.boundHandlers.mouseup);
    window.addEventListener('mousemove', this.boundHandlers.mousemove);
    window.addEventListener('blur', this.boundHandlers.blur);
    document.addEventListener('pointerlockchange', this.boundHandlers.pointerlockchange);
  }

  /**
   * Disable the camera (detach event listeners)
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    this.canvas.removeEventListener('pointerdown', this.boundHandlers.pointerdown, true);
    this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown);
    window.removeEventListener('pointerup', this.boundHandlers.pointerup);
    window.removeEventListener('pointercancel', this.boundHandlers.pointercancel);
    window.removeEventListener('mouseup', this.boundHandlers.mouseup);
    window.removeEventListener('mousemove', this.boundHandlers.mousemove);
    window.removeEventListener('blur', this.boundHandlers.blur);
    document.removeEventListener('pointerlockchange', this.boundHandlers.pointerlockchange);

    this.isMouseDown = false;
    this.activePointerId = null;
  }

  /**
   * Dispose of the camera (cleanup)
   */
  dispose(): void {
    this.disable();
    this.disposed = true;
  }

  /**
   * Update camera based on player position and rotation
   * @param playerPosition - World position of the player
   * @param playerForward - Forward direction of the player (for auto-rotation)
   * @param deltaTime - Time since last frame in seconds
   */
  update(playerPosition: Vec3, playerForward: Vec3, deltaTime: number): void {
    if (!this.enabled) return;

    // Smooth rotation towards target
    this.yaw = damp(this.yaw, this.targetYaw, this.rotationSmoothing, deltaTime);
    this.pitch = damp(this.pitch, this.targetPitch, this.rotationSmoothing, deltaTime);
    
    // Auto-rotate camera to follow player forward direction if enabled
    if (this.enableAutoRotation) {
      const targetYaw = Math.atan2(playerForward[0], -playerForward[2]);
      const yawDiff = targetYaw - this.targetYaw;
      
      // Handle wrap-around (shortest path)
      let normalizedDiff = yawDiff;
      if (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
      if (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;
      
      // Smoothly rotate toward target
      const rotationAmount = this.rotationSpeed * deltaTime;
      if (Math.abs(normalizedDiff) > 0.01) {
        this.targetYaw += clamp(normalizedDiff, -rotationAmount, rotationAmount);
      }
    }
    
    // Update direction vectors if rotation changed
    if (Math.abs(this.yaw - this.targetYaw) > 1e-6 || Math.abs(this.pitch - this.targetPitch) > 1e-6) {
      this.updateDirectionVectors();
    }

    // Calculate desired camera position
    const desiredPosition = this.calculateDesiredPosition(playerPosition);

    // Check for collisions and adjust position
    const finalPosition = this.resolveCollision(playerPosition, desiredPosition);

    // Smooth follow
    const lerpFactor = clamp(this.followSpeed * deltaTime, 0, 1);
    lerpVec3(this.position, this.position, finalPosition, lerpFactor);
  }

  /**
   * Get the current view matrix
   */
  getViewMatrix(playerPosition: Vec3): Mat4 {
    const target: Vec3 = [
      playerPosition[0],
      playerPosition[1] + this.height * 0.7, // Look slightly above player pivot
      playerPosition[2],
    ];
    
    mat4LookAt(this.viewMatrix, this.position, target, [0, 1, 0]);
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
    this.pitch = clamp(pitch, this.pitchMin, this.pitchMax);
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

  /**
   * Get configuration
   */
  getConfig(): Required<ThirdPersonCameraConfig> {
    return {
      distance: this.distance,
      height: this.height,
      shoulderOffset: this.shoulderOffset,
      followSpeed: this.followSpeed,
      rotationSpeed: this.rotationSpeed,
      collisionRadius: this.collisionRadius,
      pitchRange: [
        (this.pitchMin * 180) / Math.PI,
        (this.pitchMax * 180) / Math.PI,
      ],
      mouseSensitivity: this.mouseSensitivity,
      enableAutoRotation: this.enableAutoRotation,
      rotationSmoothing: this.rotationSmoothing,
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ThirdPersonCameraConfig>): void {
    if (config.distance !== undefined) this.distance = config.distance;
    if (config.height !== undefined) this.height = config.height;
    if (config.shoulderOffset !== undefined) this.shoulderOffset = config.shoulderOffset;
    if (config.followSpeed !== undefined) this.followSpeed = config.followSpeed;
    if (config.rotationSpeed !== undefined) this.rotationSpeed = config.rotationSpeed;
    if (config.collisionRadius !== undefined) this.collisionRadius = config.collisionRadius;
    if (config.mouseSensitivity !== undefined) this.mouseSensitivity = config.mouseSensitivity;
    if (config.enableAutoRotation !== undefined) this.enableAutoRotation = config.enableAutoRotation;
    if (config.rotationSmoothing !== undefined) this.rotationSmoothing = config.rotationSmoothing;
    
    if (config.pitchRange) {
      this.pitchMin = (config.pitchRange[0] * Math.PI) / 180;
      this.pitchMax = (config.pitchRange[1] * Math.PI) / 180;
      this.pitch = clamp(this.pitch, this.pitchMin, this.pitchMax);
      this.targetPitch = this.pitch;
    }
  }

  /**
   * Check if camera is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ========== Private Methods ==========

  private calculateDesiredPosition(playerPosition: Vec3): Vec3 {
    // Calculate camera offset based on yaw, pitch, distance, and shoulder offset
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);

    // Offset behind player
    const behindX = sinYaw * cosPitch * this.distance;
    const behindY = sinPitch * this.distance;
    const behindZ = -cosYaw * cosPitch * this.distance;

    // Shoulder offset (perpendicular to forward direction)
    const shoulderX = cosYaw * this.shoulderOffset;
    const shoulderZ = sinYaw * this.shoulderOffset;

    return [
      playerPosition[0] - behindX + shoulderX,
      playerPosition[1] + this.height - behindY,
      playerPosition[2] - behindZ + shoulderZ,
    ] as Vec3;
  }

  private resolveCollision(playerPosition: Vec3, desiredPosition: Vec3): Vec3 {
    if (!this.physicsWorld) {
      return desiredPosition;
    }

    // Raycast from player to desired camera position
    const direction: Vec3 = [
      desiredPosition[0] - playerPosition[0],
      desiredPosition[1] - playerPosition[1],
      desiredPosition[2] - playerPosition[2],
    ];

    const distanceToCamera = Math.sqrt(
      direction[0] * direction[0] +
      direction[1] * direction[1] +
      direction[2] * direction[2]
    );

    if (distanceToCamera < 0.01) {
      return desiredPosition;
    }

    // Normalize direction
    const dirNorm: Vec3 = [
      direction[0] / distanceToCamera,
      direction[1] / distanceToCamera,
      direction[2] / distanceToCamera,
    ];

    // Cast ray from player to camera
    const hit = this.physicsWorld.raycast(
      playerPosition,
      dirNorm,
      {
        maxDistance: distanceToCamera + this.collisionRadius,
        ignoreEntities: [],
        hitTriggers: false,
      }
    );

    if (hit && hit.distance < distanceToCamera) {
      // Pull camera closer to avoid clipping through walls
      const safeDist = Math.max(hit.distance - this.collisionRadius, 0.5); // Minimum distance of 0.5
      return [
        playerPosition[0] + dirNorm[0] * safeDist,
        playerPosition[1] + dirNorm[1] * safeDist,
        playerPosition[2] + dirNorm[2] * safeDist,
      ] as Vec3;
    }

    return desiredPosition;
  }

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
  }

  // ========== Event Handlers ==========

  private handlePointerDown(event: PointerEvent): void {
    if (!this.enabled || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.activePointerId = event.pointerId;
    this.handleMouseDown(event);
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.enabled || event.button !== 0) return; // Left mouse button = 0
    event.preventDefault();
    this.isMouseDown = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.canvas.style.cursor = 'grabbing';
  }

  private handleMouseUp(event: MouseEvent): void {
    if (!this.enabled || event.button !== 0) return;
    this.isMouseDown = false;
    this.activePointerId = null;
    this.canvas.style.cursor = '';
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.enabled || event.button !== 0) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.activePointerId = null;
    this.handleMouseUp(event);
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.enabled) return;

    const pointerLocked = this.isPointerLocked();
    if (!pointerLocked && !this.isMouseDown) return;

    let deltaX: number;
    let deltaY: number;

    if (pointerLocked && typeof event.movementX === 'number' && typeof event.movementY === 'number') {
      deltaX = event.movementX;
      deltaY = event.movementY;
    } else {
      deltaX = event.clientX - this.lastMouseX;
      deltaY = event.clientY - this.lastMouseY;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }

    if (deltaX === 0 && deltaY === 0) return;

    // Update target rotation (will be smoothed in update())
    this.targetYaw += deltaX * this.mouseSensitivity;
    this.targetPitch -= deltaY * this.mouseSensitivity;
    this.targetPitch = clamp(this.targetPitch, this.pitchMin, this.pitchMax);
    
    // Apply smoothing immediately for responsive feel during mouse movement
    const immediateDelta = 0.008; // ~120fps estimate for immediate response
    this.yaw = damp(this.yaw, this.targetYaw, this.rotationSmoothing, immediateDelta);
    this.pitch = damp(this.pitch, this.targetPitch, this.rotationSmoothing, immediateDelta);

    this.updateDirectionVectors();
  }

  private handleBlur(): void {
    // Clear all input state when window loses focus
    this.isMouseDown = false;
    this.activePointerId = null;
    if (this.canvas) {
      this.canvas.style.cursor = '';
    }
  }

  private handlePointerCancel(event: PointerEvent): void {
    if (!this.enabled) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.activePointerId = null;
    this.isMouseDown = false;
    if (this.canvas) {
      this.canvas.style.cursor = '';
    }
  }

  private isPointerLocked(): boolean {
    return typeof document !== 'undefined' && document.pointerLockElement === this.canvas;
  }

  private handlePointerLockChange(): void {
    if (!this.enabled) return;
    if (!this.isPointerLocked()) {
      this.isMouseDown = false;
      this.activePointerId = null;
      if (this.canvas) {
        this.canvas.style.cursor = '';
      }
    }
  }
}

