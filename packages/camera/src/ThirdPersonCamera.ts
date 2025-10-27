import type { Vec3, Mat4 } from '@engine/core/math';
import { mat4LookAt, vec3Length, vec3Normalize } from '@engine/core/math';
import type { PhysicsWorld, RaycastHit } from '@engine/world';

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

  // Target position (smoothed)
  private targetPosition: Vec3;

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

  // Direction vectors (cached)
  private readonly forward: Vec3 = [0, 0, -1];
  private readonly right: Vec3 = [1, 0, 0];

  // Event listeners (for cleanup)
  private readonly boundHandlers = {
    mousedown: this.handleMouseDown.bind(this),
    mouseup: this.handleMouseUp.bind(this),
    mousemove: this.handleMouseMove.bind(this),
    blur: this.handleBlur.bind(this),
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

    const pitchRange = config?.pitchRange ?? [-30, 60];
    this.pitchMin = (pitchRange[0] * Math.PI) / 180;
    this.pitchMax = (pitchRange[1] * Math.PI) / 180;

    // Initialize camera behind player
    this.position = [0, this.height, this.distance];
    this.targetPosition = [0, this.height, this.distance];
    this.yaw = 0;
    this.pitch = 0;

    this.updateDirectionVectors();
  }

  /**
   * Enable the camera (attach event listeners)
   */
  enable(): void {
    if (this.enabled || this.disposed) return;
    this.enabled = true;

    this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
    window.addEventListener('mouseup', this.boundHandlers.mouseup);
    window.addEventListener('mousemove', this.boundHandlers.mousemove);
    window.addEventListener('blur', this.boundHandlers.blur);
  }

  /**
   * Disable the camera (detach event listeners)
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown);
    window.removeEventListener('mouseup', this.boundHandlers.mouseup);
    window.removeEventListener('mousemove', this.boundHandlers.mousemove);
    window.removeEventListener('blur', this.boundHandlers.blur);

    this.isMouseDown = false;
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

    // Auto-rotate camera to follow player forward direction if enabled
    if (this.enableAutoRotation) {
      const targetYaw = Math.atan2(playerForward[0], -playerForward[2]);
      const yawDiff = targetYaw - this.yaw;
      
      // Handle wrap-around (shortest path)
      let normalizedDiff = yawDiff;
      if (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
      if (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;
      
      // Smoothly rotate toward target
      const rotationAmount = this.rotationSpeed * deltaTime;
      if (Math.abs(normalizedDiff) > 0.01) {
        this.yaw += clamp(normalizedDiff, -rotationAmount, rotationAmount);
      }
      
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
    this.targetPosition = [...pos] as Vec3;
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
    this.updateDirectionVectors();
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
    
    if (config.pitchRange) {
      this.pitchMin = (config.pitchRange[0] * Math.PI) / 180;
      this.pitchMax = (config.pitchRange[1] * Math.PI) / 180;
      this.pitch = clamp(this.pitch, this.pitchMin, this.pitchMax);
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
    this.canvas.style.cursor = '';
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.enabled || !this.isMouseDown) return;

    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;

    // Apply rotation
    this.yaw += deltaX * this.mouseSensitivity;
    this.pitch -= deltaY * this.mouseSensitivity;
    this.pitch = clamp(this.pitch, this.pitchMin, this.pitchMax);

    this.updateDirectionVectors();
  }

  private handleBlur(): void {
    // Clear all input state when window loses focus
    this.isMouseDown = false;
    if (this.canvas) {
      this.canvas.style.cursor = '';
    }
  }
}

