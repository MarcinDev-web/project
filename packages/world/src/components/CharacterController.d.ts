import { Component } from './Component.js';
import type { Vec3 } from '@engine/core/math';
import type { MovementController, MovementInput } from '../movement/MovementInterface.js';
import type { MovementProfile } from '../movement/MovementProfile.js';
/**
 * Character controller state
 */
export declare enum CharacterState {
    Idle = "idle",
    Walking = "walking",
    Running = "running",
    Jumping = "jumping",
    Falling = "falling",
    Landing = "landing"
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
    /** Speed multiplier for external effects (e.g., speed zones). Applied on top of base moveSpeed. */
    speedMultiplier?: number;
}
/**
 * Default character controller configuration
 */
export declare const DEFAULT_CHARACTER_CONFIG: CharacterControllerConfig;
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
 * Serialized data for CharacterController component
 */
export interface CharacterControllerData {
    type: string;
    config: CharacterControllerConfig;
    state: CharacterState;
    isGrounded: boolean;
    velocity: Vec3;
    profileId?: string;
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
export declare class CharacterController extends Component implements MovementController {
    /** Configuration */
    config: CharacterControllerConfig;
    /** Current character state */
    state: CharacterState;
    /** Whether the character is on the ground */
    isGrounded: boolean;
    /** Ground normal vector */
    groundNormal: Vec3;
    /** Current velocity */
    velocity: Vec3;
    /** Current movement input */
    private moveInput;
    /** Whether sprint is active */
    private isSprinting;
    /** Whether jump was requested */
    private jumpRequested;
    /** Time since last grounded */
    private timeSinceGrounded;
    /** Coyote time (grace period for jumping after leaving ground) */
    private readonly coyoteTime;
    /** Jump buffer time (remember jump input for a short time) */
    private readonly jumpBufferTime;
    /** Time since jump was pressed */
    private timeSinceJumpPressed;
    /** Reference to physics component */
    private physics;
    /** Current movement profile */
    private currentProfile;
    /** Current rotation angle for smooth interpolation (radians) */
    private currentRotationY;
    /** Original moveSpeed value (tracked for restoration after speed zone effects) */
    private originalMoveSpeed;
    constructor(config?: Partial<CharacterControllerConfig>);
    /**
     * Get the type of this component
     */
    getType(): string;
    /**
     * Called when component is added to entity
     */
    protected onAttach(): void;
    /**
     * Initialize physics component if not already done
     */
    private ensurePhysicsComponent;
    /**
     * Set movement input (MovementController interface)
     * Accepts MovementInput and converts to CharacterInput internally
     */
    setInput(input: MovementInput | CharacterInput): void;
    /**
     * Set movement input using MovementInput (unified interface)
     */
    private setMovementInput;
    /**
     * Set movement input using CharacterInput (original interface)
     */
    private setCharacterInput;
    /**
     * Update character controller (called each frame)
     */
    update(deltaTime: number): void;
    /**
     * Update internal timers
     */
    private updateTimers;
    /**
     * Apply custom gravity when configured
     */
    private applyGravity;
    /**
     * Apply air damping to upward velocity
     */
    private applyAirDamping;
    /**
     * Update character rotation to face movement direction
     */
    private updateRotation;
    /**
     * Reset jump request flag
     */
    private resetJumpRequest;
    /**
     * Update character state based on current conditions
     */
    private updateState;
    /**
     * Sync velocity to physics component
     */
    private syncVelocityToPhysics;
    /**
     * Apply movement forces/velocity with smooth interpolation
     */
    private applyMovement;
    /**
     * Frame-rate independent exponential damping factor
     * Computes alpha for exponential smoothing: 1 - e^(-dt/tau)
     */
    private expDecayAlpha;
    /**
     * Apply custom gravity
     */
    private applyCustomGravity;
    /**
     * Handle jump input and mechanics
     */
    private handleJump;
    /**
     * Auto-rotate character to face movement direction with smooth interpolation
     */
    private autoRotateToMovement;
    /**
     * Converts camera-relative input to world-space movement direction.
     *
     * This method transforms input from camera space (where forward/backward/left/right
     * are relative to camera orientation) to world space (absolute X/Z coordinates).
     *
     * Input format:
     * - input[0]: left/right movement (-1 to 1, negative = left, positive = right)
     * - input[1]: up/down movement (typically 0 for ground movement)
     * - input[2]: forward/backward movement (-1 to 1, negative = backward, positive = forward)
     *
     * Camera directions:
     * - cameraForward: direction camera is facing (normalized)
     * - cameraRight: direction to camera's right (normalized)
     *
     * Formula:
     * worldDir = forwardNorm * input[2] + rightNorm * input[0]
     *
     * Where:
     * - forwardNorm: cameraForward projected onto horizontal plane (Y=0) and normalized
     * - rightNorm: cameraRight projected onto horizontal plane (Y=0) and normalized
     *
     * Example:
     * - Input [0, 0, 1] (forward) with cameraForward [0, 0, -1] → worldDir [0, 0, -1]
     * - Input [1, 0, 0] (right) with cameraRight [1, 0, 0] → worldDir [1, 0, 0]
     * - Input [0.707, 0, 0.707] (diagonal) → combines forward and right components
     *
     * @param out - Output vector (will be modified)
     * @param input - Camera-relative input vector [left/right, up/down, forward/backward]
     * @param cameraForward - Camera forward direction (normalized)
     * @param cameraRight - Camera right direction (normalized)
     */
    private getCameraRelativeDirectionOut;
    /**
     * Helper: Normalize a vector
     */
    private normalizeInto;
    /**
     * Get current velocity (MovementController interface)
     */
    getVelocity(): Vec3;
    /**
     * Get current position (MovementController interface)
     */
    getPosition(): Vec3;
    /**
     * Teleport character to a position
     */
    teleport(position: Vec3): void;
    /**
     * Add velocity to character (e.g., from external forces)
     */
    addVelocity(velocity: Vec3): void;
    /**
     * Set speed multiplier (e.g., from speed zones)
     * Stores original moveSpeed if not already stored
     */
    setSpeedMultiplier(multiplier: number): void;
    /**
     * Reset speed multiplier to 1.0 and restore original moveSpeed
     */
    resetSpeedMultiplier(): void;
    /**
     * Apply a movement profile to this controller
     *
     * @param profile - Movement profile to apply
     * @throws Error if profile is invalid or missing required fields
     */
    applyProfile(profile: MovementProfile): void;
    /**
     * Get the current movement profile
     *
     * @returns Current profile or null if none applied
     */
    getCurrentProfile(): MovementProfile | null;
    /**
     * Clone this component
     */
    clone(): CharacterController;
    /**
     * Serialize the component
     */
    serialize(): CharacterControllerData;
    /**
     * Deserialize the component
     */
    static deserialize(data: CharacterControllerData): CharacterController;
}
//# sourceMappingURL=CharacterController.d.ts.map