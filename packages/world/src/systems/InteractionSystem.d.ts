/**
 * InteractionSystem - Manages player interactions with interactable objects
 *
 * Detects interactable objects via raycast from camera, displays prompts,
 * handles E key input, and integrates with LogicCubes.
 */
import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { type InteractionPromptUIStyle } from './InteractionPromptUI.js';
/**
 * Configuration for InteractionSystem
 */
export interface InteractionSystemConfig {
    /** Maximum interaction range (overrides component's interactionRange if larger) */
    maxRange?: number;
    /** Key code for interaction (default: 'KeyE') */
    interactionKey?: string;
    /** Canvas element for screen dimensions (optional, uses window dimensions if not provided) */
    canvas?: HTMLCanvasElement;
    /** Style configuration for interaction prompt */
    promptStyle?: InteractionPromptUIStyle;
    /** Detection mode: 'raycast' (forward ray), 'sphere' (radius check), 'hybrid' (raycast with sphere fallback) */
    detectionMode?: 'raycast' | 'sphere' | 'hybrid';
    /** Detection radius for sphere cast mode (default: 2.0 units) */
    detectionRadius?: number;
    /** Enable gamepad support (default: true) */
    enableGamepad?: boolean;
    /** Gamepad button index for interaction (default: 0 - A/X button) */
    gamepadButton?: number;
}
/**
 * InteractionSystem manages player interactions with interactable objects
 */
export declare class InteractionSystem {
    private readonly scene;
    private readonly raycaster;
    private readonly promptUI;
    private readonly config;
    private currentInteractable;
    private previousInteractable;
    private keyDownHandler;
    private mouseDownHandler;
    private gamepadPollInterval;
    private lastGamepadButtonState;
    private canvas;
    /** Highlight state storage - stores original emissive values */
    private highlightState;
    /** Default highlight color (cyan/blue) */
    private readonly defaultHighlightColor;
    /** Default highlight intensity */
    private readonly defaultHighlightIntensity;
    /** Scratch vectors reused to avoid allocations */
    private readonly scratchVec;
    private readonly scratchViewMatrix;
    constructor(scene: Scene, config?: InteractionSystemConfig);
    /**
     * Update the interaction system (call each frame)
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void;
    /**
     * Detects the closest interactable object based on detection mode
     * @returns The closest interactable entity, or null if none found
     */
    private detectInteractable;
    /**
     * Detects the closest interactable object in front of the camera using raycast
     * @returns The closest interactable entity, or null if none found
     */
    private detectInteractableRaycast;
    /**
     * Detects the closest interactable object using sphere cast (distance check)
     * @returns The closest interactable entity, or null if none found
     */
    private detectInteractableSphere;
    /**
     * Setup keyboard input handling
     */
    private setupInputHandling;
    /**
     * Setup mouse input handling for left-click interaction
     */
    private setupMouseHandling;
    /**
     * Detect interactable entity from mouse click position
     * @param mouseX - Mouse X coordinate in screen space (clientX)
     * @param mouseY - Mouse Y coordinate in screen space (clientY)
     * @returns The clicked interactable entity, or null if none found
     */
    private detectInteractableFromMouse;
    /**
     * Setup gamepad input handling
     */
    private setupGamepadHandling;
    /**
     * Handle interaction input (E key pressed)
     */
    private handleInteraction;
    /**
     * Get the currently detected interactable entity
     * @returns The current interactable entity, or null if none
     */
    getCurrentInteractable(): Entity | null;
    /**
     * Manually trigger an interaction with an entity
     * Useful for testing or programmatic interactions
     * @param entity - Entity to interact with
     * @returns true if interaction was successful
     */
    triggerInteraction(entity: Entity): boolean;
    /**
     * Set the prompt style configuration.
     * @param style - Style configuration to apply
     */
    setPromptStyle(style: InteractionPromptUIStyle): void;
    /**
     * Get the current prompt style configuration.
     * @returns Current style configuration
     */
    getPromptStyle(): InteractionPromptUIStyle;
    /**
     * Update highlights based on current interactable entity
     */
    private updateHighlights;
    /**
     * Set highlight state for an entity
     * @param entity - Entity to highlight/unhighlight
     * @param enabled - Whether to enable highlight
     */
    setHighlight(entity: Entity, enabled: boolean): void;
    /**
     * Update highlight intensity for an entity
     * @param entity - Entity to update
     * @param intensity - New intensity (0-1)
     */
    updateHighlight(entity: Entity, intensity: number): void;
    /**
     * Cleanup and dispose of the system
     */
    dispose(): void;
}
//# sourceMappingURL=InteractionSystem.d.ts.map