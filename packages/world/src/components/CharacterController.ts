import { Component } from './Component.js';
import type { Vec3 } from '@engine/core/math';
import { quatFromAxisAngle, quatToEuler } from '@engine/core/math';
import { PhysicsComponent, RigidbodyType } from './PhysicsComponent.js';
import type { MovementController, MovementInput } from '../movement/MovementInterface.js';

/**
 * Character controller state
 */
export enum CharacterState {
  Idle = 'idle',
  Walking = 'walking',
  Running = 'running',
  Jumping = 'jumping',
  Falling = 'falling',
  Landing = 'landing',
}

/**
 * Character controller configuration
 */
export interface CharacterControllerConfig {
  /** Movement speed (units per second) */
  moveSpeed: number;
  /** Sprint speed multiplier */
  sprintMultiplier: number;
  /** Jump force */
  jumpForce: number;
  /** Gravity multiplier (affects fall speed) */
  gravityMultiplier: number;
  /** Maximum slope angle the character can walk on (degrees) */
  maxSlopeAngle: number;
  /** Step height for climbing stairs */
  stepHeight: number;
  /** Ground check distance below character */
  groundCheckDistance: number;
  /** Air control multiplier (0-1, how much control in air) */
  airControlMultiplier: number;
  /** Rotation speed (radians per second) */
  rotationSpeed: number;
  /** Whether to auto-rotate to movement direction */
  autoRotate: boolean;
  /** Velocity smoothing time constant in seconds (default: 0.1). Lower = more responsive, higher = smoother. */
  velocitySmoothing?: number;
}

/**
 * Default character controller configuration
 */
export const DEFAULT_CHARACTER_CONFIG: CharacterControllerConfig = {
  moveSpeed: 5.0,
  sprintMultiplier: 1.5,
  jumpForce: 8.0,
  gravityMultiplier: 1.0,
  maxSlopeAngle: 45,
  stepHeight: 0.3,
  groundCheckDistance: 0.1,
  airControlMultiplier: 0.3,
  rotationSpeed: 10,
  autoRotate: true,
  velocitySmoothing: 0.1,
};

/**
 * Input state for character controller
 */
export interface CharacterInput {
  /** Movement direction (normalized, relative to camera) */
  moveDirection: Vec3;
  /** Whether sprint is active */
  sprint: boolean;
  /** Whether jump was pressed this frame */
  jump: boolean;
  /** Camera forward direction (for camera-relative movement) */
  cameraForward?: Vec3;
  /** Camera right direction (for camera-relative movement) */
  cameraRight?: Vec3;
}

/**
 * Character Controller Component
 *
 * Provides character movement with physics integration, including:
 * - Walking, running, jumping
 * - Ground detection
 * - Slope handling
 * - Stair climbing
 * - Camera-relative movement
 *
 * Implements MovementController interface for unified movement API.
 */
export class CharacterController extends Component implements MovementController {
  /** Configuration */
  public config: CharacterControllerConfig;

  /** Current character state */
  public state: CharacterState = CharacterState.Idle;

  /** Whether the character is on the ground */
  public isGrounded: boolean = false;

  /** Ground normal vector */
  public groundNormal: Vec3 = [0, 1, 0];

  /** Current velocity */
  public velocity: Vec3 = [0, 0, 0];

  /** Current movement input */
  private moveInput: Vec3 = [0, 0, 0];

  /** Whether sprint is active */
  private isSprinting: boolean = false;

  /** Whether jump was requested */
  private jumpRequested: boolean = false;

  /** Time since last grounded */
  private timeSinceGrounded: number = Infinity;

  /** Coyote time (grace period for jumping after leaving ground) */
  private readonly coyoteTime: number = 0.1;

  /** Jump buffer time (remember jump input for a short time) */
  private readonly jumpBufferTime: number = 0.1;

  /** Time since jump was pressed */
  private timeSinceJumpPressed: number = Infinity;

  /** Reference to physics component */
  private physics: PhysicsComponent | null = null;

  /** Current movement profile */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private currentProfile: any = null; // MovementProfile from @engine/stdlib (using any to avoid circular dependency)

  /** Current rotation angle for smooth interpolation (radians) */
  private currentRotationY: number = 0;

  constructor(config: Partial<CharacterControllerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CHARACTER_CONFIG, ...config };
  }

  /**
   * Get the type of this component
   */
  getType(): string {
    return 'CharacterController';
  }

  /**
   * Called when component is added to entity
   */
  protected onAttach(): void {
    super.onAttach();
    // Ensure physics exists on attach for tests expecting immediate availability
    this.ensurePhysicsComponent();
  }

  /**
   * Initialize physics component if not already done
   */
  private ensurePhysicsComponent(): void {
    if (this.physics) return;

    const entity = this.entity;
    if (!entity) return;

    // Get or create physics component
    this.physics = entity.getComponent(PhysicsComponent);

    if (!this.physics) {
      // Create physics component with character settings
      this.physics = new PhysicsComponent();
      this.physics.rigidbodyType = RigidbodyType.Dynamic;
      this.physics.mass = 70; // Average human mass
      this.physics.useGravity = true;
      this.physics.linearDrag = 5; // High drag for responsive control

      // Add capsule collider for character
      this.physics.addCapsuleCollider(0.5, 2.0); // Radius 0.5, height 2.0

      // Freeze rotation to prevent character from tipping over
      this.physics.freezeRotationX = true;
      this.physics.freezeRotationZ = true;

      entity.addComponent(this.physics);
    }

    // Override gravity if needed
    if (this.config.gravityMultiplier !== 1.0) {
      this.physics.useGravity = false; // We'll apply custom gravity
    }
  }

  /**
   * Set movement input (MovementController interface)
   * Accepts MovementInput and converts to CharacterInput internally
   */
  setInput(input: MovementInput | CharacterInput): void {
    // Handle MovementInput (unified interface)
    if ('cameraForward' in input && input.cameraForward !== undefined) {
      // CharacterInput with camera directions
      this.setCharacterInput(input);
    } else {
      // MovementInput - convert to CharacterInput
      this.setMovementInput(input as MovementInput);
    }
  }

  /**
   * Set movement input using MovementInput (unified interface)
   */
  private setMovementInput(input: MovementInput): void {
    // Store movement direction (normalize)
    this.normalizeInto(this.moveInput, input.moveDirection);

    // No camera-relative movement for basic MovementInput
    // Movement direction is already in world space

    this.isSprinting = input.sprint ?? false;

    if (input.jump) {
      this.jumpRequested = true;
      this.timeSinceJumpPressed = 0;
    }
  }

  /**
   * Set movement input using CharacterInput (original interface)
   */
  private setCharacterInput(input: CharacterInput): void {
    // Store movement direction
    this.normalizeInto(this.moveInput, input.moveDirection);

    // Apply camera-relative movement if camera directions provided
    if (input.cameraForward && input.cameraRight) {
      this.getCameraRelativeDirectionOut(
        this.moveInput,
        input.moveDirection,
        input.cameraForward,
        input.cameraRight
      );
    }

    this.isSprinting = input.sprint;

    if (input.jump) {
      this.jumpRequested = true;
      this.timeSinceJumpPressed = 0;
    }
  }

  /**
   * Update character controller (called each frame)
   */
  update(deltaTime: number): void {
    // Ensure physics component exists
    this.ensurePhysicsComponent();

    if (!this.physics || !this.entity) return;

    // Update timers
    this.timeSinceGrounded += deltaTime;
    this.timeSinceJumpPressed += deltaTime;

    // Ground detection is expected to be provided by CharacterControllerSystem.
    // Do not override isGrounded here to allow tests and external systems to control it.

    // Apply movement
    this.applyMovement(deltaTime);

    // Apply custom gravity when configured (base gravity is handled by physics engine in integration tests)
    if (this.config.gravityMultiplier !== 1.0) {
      this.applyCustomGravity(deltaTime);
    }

    // Handle jumping
    this.handleJump();

    // Ensure upward velocity decays when in air to prevent repeated jump force application affecting velocity
    if (!this.isGrounded && this.velocity[1] > 0) {
      // Frame-rate aware damping so velocity decreases slightly on subsequent frames
      const damping = Math.pow(0.98, deltaTime * 60);
      this.velocity[1] *= damping;
      if (this.physics) {
        this.physics.velocity[1] = this.velocity[1];
      }
    }

    // Update state after movement and jump handling so state reflects latest velocities
    this.updateState();

    // Auto-rotate to movement direction if enabled
    if (this.config.autoRotate) {
      this.autoRotateToMovement(deltaTime);
    }

    // Reset jump request
    this.jumpRequested = false;
  }

  /**
   * Update character state based on current conditions
   */
  private updateState(): void {
    if (this.isGrounded) {
      const horizontalSpeed = Math.sqrt(
        this.velocity[0] * this.velocity[0] + this.velocity[2] * this.velocity[2]
      );

      if (horizontalSpeed < 0.1) {
        this.state = CharacterState.Idle;
      } else if (this.isSprinting) {
        this.state = CharacterState.Running;
      } else {
        this.state = CharacterState.Walking;
      }
    } else {
      if (this.velocity[1] > 0.1) {
        this.state = CharacterState.Jumping;
      } else {
        this.state = CharacterState.Falling;
      }
    }
  }

  /**
   * Sync velocity to physics component
   */
  private syncVelocityToPhysics(): void {
    if (!this.physics) return;
    this.physics.velocity[0] = this.velocity[0];
    this.physics.velocity[1] = this.velocity[1];
    this.physics.velocity[2] = this.velocity[2];
  }

  /**
   * Apply movement forces/velocity with smooth interpolation
   */
  private applyMovement(deltaTime: number): void {
    if (!this.physics) return;

    // Calculate target speed
    const baseSpeed = this.config.moveSpeed;
    const speed = this.isSprinting ? baseSpeed * this.config.sprintMultiplier : baseSpeed;

    // Calculate target velocity
    const targetVelocity: Vec3 = [
      this.moveInput[0] * speed,
      this.velocity[1], // Keep vertical velocity
      this.moveInput[2] * speed,
    ];

    // Apply air control multiplier when not grounded
    const controlMultiplier = this.isGrounded ? 1.0 : this.config.airControlMultiplier;

    // Smoothly interpolate to target velocity using exponential damping
    // Adjust smoothing time constant based on air control
    const smoothingTau = (this.config.velocitySmoothing ?? 0.1) / controlMultiplier;
    const alpha = this.expDecayAlpha(smoothingTau, deltaTime);

    this.velocity[0] += (targetVelocity[0] - this.velocity[0]) * alpha;
    this.velocity[2] += (targetVelocity[2] - this.velocity[2]) * alpha;

    // Update physics velocity
    // Note: Position integration is handled automatically by PhysicsSystem.integrateVelocities()
    // in fixedUpdate(). Manual integration here would cause double integration.
    this.syncVelocityToPhysics();
  }

  /**
   * Frame-rate independent exponential damping factor
   * Computes alpha for exponential smoothing: 1 - e^(-dt/tau)
   */
  private expDecayAlpha(tau: number, dt: number): number {
    const MIN_TAU = 1e-5;
    const safeTau = Math.max(MIN_TAU, Number.isFinite(tau) ? tau : MIN_TAU);
    const safeDt = Math.max(0, Number.isFinite(dt) ? dt : 0);
    const alpha = 1 - Math.exp(-safeDt / safeTau);
    // Numerical guard
    return alpha > 1 ? 1 : alpha < 0 ? 0 : alpha;
  }

  /**
   * Apply custom gravity
   */
  private applyCustomGravity(deltaTime: number): void {
    if (!this.physics) return;

    const gravity = -9.81 * this.config.gravityMultiplier;
    this.velocity[1] += gravity * deltaTime;
    this.syncVelocityToPhysics();
  }

  /**
   * Handle jump input and mechanics
   */
  private handleJump(): void {
    if (!this.physics) return;

    // Check if we can jump (grounded or within coyote time, and jump buffered)
    const canJump =
      (this.isGrounded || this.timeSinceGrounded < this.coyoteTime) &&
      this.timeSinceJumpPressed <= this.jumpBufferTime;

    if (this.jumpRequested && canJump) {
      // Apply jump force
      this.velocity[1] = this.config.jumpForce;
      this.syncVelocityToPhysics();

      this.isGrounded = false;
      this.timeSinceGrounded = this.coyoteTime; // Prevent double jump
      this.timeSinceJumpPressed = Infinity; // Consume jump input
    }

    // Sync velocity from physics (in case of collisions)
    this.velocity[0] = this.physics.velocity[0];
    this.velocity[1] = this.physics.velocity[1];
    this.velocity[2] = this.physics.velocity[2];
  }

  /**
   * Auto-rotate character to face movement direction with smooth interpolation
   */
  private autoRotateToMovement(deltaTime?: number): void {
    const entity = this.entity;
    if (!entity) return;

    // Only rotate if moving
    if (this.moveInput[0] === 0 && this.moveInput[2] === 0) return;

    // Calculate target rotation
    const targetAngle = Math.atan2(this.moveInput[0], this.moveInput[2]);

    // Get current rotation from transform
    const currentEuler = quatToEuler(entity.transform.rotation);
    this.currentRotationY = currentEuler[1]; // Y-axis rotation (yaw)

    // Use deltaTime from update() if available, otherwise estimate
    const dt = deltaTime ?? 1 / 60; // Default to 60 FPS if not provided

    // Smoothly interpolate rotation angle using exponential damping
    const rotationTau = 1.0 / this.config.rotationSpeed; // Convert speed to time constant
    const alpha = this.expDecayAlpha(rotationTau, dt);
    this.currentRotationY += (targetAngle - this.currentRotationY) * alpha;

    // Apply smooth rotation directly from smoothed angle (Y-axis only)
    const smoothedQuat = quatFromAxisAngle([0, 1, 0], this.currentRotationY);
    entity.transform.rotation = smoothedQuat;
  }

  /**
   * Get camera-relative movement direction
   */
  private getCameraRelativeDirectionOut(
    out: Vec3,
    input: Vec3,
    cameraForward: Vec3,
    cameraRight: Vec3
  ): void {
    // Project camera forward onto horizontal plane
    const forward: Vec3 = [cameraForward[0], 0, cameraForward[2]];
    const right: Vec3 = [cameraRight[0], 0, cameraRight[2]];

    // Normalize
    const forwardNorm: Vec3 = [0, 0, 0];
    const rightNorm: Vec3 = [0, 0, 0];
    this.normalizeInto(forwardNorm, forward);
    this.normalizeInto(rightNorm, right);

    // Calculate movement direction
    out[0] = forwardNorm[0] * input[2] + rightNorm[0] * input[0];
    out[1] = 0;
    out[2] = forwardNorm[2] * input[2] + rightNorm[2] * input[0];
    this.normalizeInto(out, out);
  }

  /**
   * Helper: Normalize a vector
   */
  private normalizeInto(out: Vec3, v: Vec3): void {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (length < 1e-6) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      return;
    }
    const inv = 1 / length;
    out[0] = v[0] * inv;
    out[1] = v[1] * inv;
    out[2] = v[2] * inv;
  }

  /**
   * Get current velocity (MovementController interface)
   */
  getVelocity(): Vec3 {
    return [...this.velocity] as Vec3;
  }

  /**
   * Get current position (MovementController interface)
   */
  getPosition(): Vec3 {
    const entity = this.entity;
    if (entity) {
      const pos = entity.transform.position;
      return [pos[0], pos[1], pos[2]] as Vec3;
    }
    return [0, 0, 0] as Vec3;
  }

  /**
   * Teleport character to a position
   */
  teleport(position: Vec3): void {
    const entity = this.entity;
    if (entity) {
      // Use setter to properly update position (getter returns a copy)
      entity.transform.position = [position[0], position[1], position[2]];
      this.velocity[0] = 0;
      this.velocity[1] = 0;
      this.velocity[2] = 0;
      if (this.physics) {
        this.physics.velocity[0] = 0;
        this.physics.velocity[1] = 0;
        this.physics.velocity[2] = 0;
      }
    }
  }

  /**
   * Add velocity to character (e.g., from external forces)
   */
  addVelocity(velocity: Vec3): void {
    this.velocity[0] += velocity[0];
    this.velocity[1] += velocity[1];
    this.velocity[2] += velocity[2];

    this.syncVelocityToPhysics();
  }

  /**
   * Apply a movement profile to this controller
   *
   * @param profile - Movement profile to apply
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyProfile(profile: any): void {
    // MovementProfile from @engine/stdlib (using any to avoid circular dependency)
    // Apply config from profile
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    this.config = { ...profile.config };

    // Apply extensions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (profile.extensions) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      for (const ext of profile.extensions) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (ext.onApply) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ext.onApply(this);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (ext.modifyConfig) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          this.config = ext.modifyConfig(this.config);
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.currentProfile = profile;

    // Update physics gravity if needed
    this.ensurePhysicsComponent();
    if (this.physics && this.config.gravityMultiplier !== 1.0) {
      this.physics.useGravity = false; // We'll apply custom gravity
    }
  }

  /**
   * Get the current movement profile
   *
   * @returns Current profile or null if none applied
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents
  getCurrentProfile(): any | null {
    // MovementProfile from @engine/stdlib (using any to avoid circular dependency)
    return this.currentProfile;
  }

  /**
   * Clone this component
   */
  clone(): CharacterController {
    const clone = new CharacterController(this.config);
    clone.state = this.state;
    if (this.currentProfile) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      clone.currentProfile = this.currentProfile;
    }
    return clone;
  }

  /**
   * Serialize the component
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {
      type: this.getType(),
      config: this.config,
      state: this.state,
      isGrounded: this.isGrounded,
      velocity: this.velocity,
    };

    // Include profile ID if profile is applied
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (this.currentProfile?.id) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      result.profileId = this.currentProfile.id;
    }

    return result;
  }

  /**
   * Deserialize the component
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static deserialize(data: any): CharacterController {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const controller = new CharacterController(data.config);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    controller.state = data.state;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    controller.isGrounded = data.isGrounded;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    controller.velocity = data.velocity;

    // Load profile if profileId is provided
    // Note: This requires @engine/stdlib to be available at runtime
    // Profile loading is deferred to runtime to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.profileId) {
      // Profile will be loaded by CharacterControllerSystem.update()
      // This is a placeholder - actual loading happens in CharacterControllerSystem
      // or similar higher-level system that has access to MovementProfileRegistry
      // Store placeholder that will be recognized by ensureProfileLoaded()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      controller.currentProfile = { id: data.profileId, name: '' } as any;
    }

    return controller;
  }
}
