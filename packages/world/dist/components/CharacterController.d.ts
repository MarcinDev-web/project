import { Component } from './Component';
import type { Vec3 } from '@engine/core/math';
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
 * Character Controller Component
 *
 * Provides character movement with physics integration, including:
 * - Walking, running, jumping
 * - Ground detection
 * - Slope handling
 * - Stair climbing
 * - Camera-relative movement
 */
export declare class CharacterController extends Component {
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
     * Set movement input
     */
    setInput(input: CharacterInput): void;
    /**
     * Update character controller (called each frame)
     */
    update(deltaTime: number): void;
    /**
     * Update character state based on current conditions
     */
    private updateState;
    /**
     * Apply movement forces/velocity
     */
    private applyMovement;
    /**
     * Apply custom gravity
     */
    private applyCustomGravity;
    /**
     * Handle jump input and mechanics
     */
    private handleJump;
    /**
     * Auto-rotate character to face movement direction
     */
    private autoRotateToMovement;
    /**
     * Get camera-relative movement direction
     */
    private getCameraRelativeDirectionOut;
    /**
     * Helper: Normalize a vector
     */
    private normalizeInto;
    /**
     * Teleport character to a position
     */
    teleport(position: Vec3): void;
    /**
     * Add velocity to character (e.g., from external forces)
     */
    addVelocity(velocity: Vec3): void;
    /**
     * Clone this component
     */
    clone(): CharacterController;
    /**
     * Serialize the component
     */
    serialize(): any;
    /**
     * Deserialize the component
     */
    static deserialize(data: any): CharacterController;
}
//# sourceMappingURL=CharacterController.d.ts.map