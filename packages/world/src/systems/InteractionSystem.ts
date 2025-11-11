/**
 * InteractionSystem - Manages player interactions with interactable objects
 *
 * Detects interactable objects via raycast from camera, displays prompts,
 * handles E key input, and integrates with LogicCubes.
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { InteractableComponent } from '../components/InteractableComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { MaterialComponent } from '../components/MaterialComponent.js';
import { Raycaster, type Ray } from './Raycaster.js';
import { InteractionPromptUI, type InteractionPromptUIStyle } from './InteractionPromptUI.js';
import type { Mat4, Vec3 } from '@engine/core/math';
import type { RgbaColor } from '../utils/colors.js';

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
export class InteractionSystem {
  private readonly scene: Scene;
  private readonly raycaster: Raycaster;
  private readonly promptUI: InteractionPromptUI;
  private readonly config: InteractionSystemConfig;
  private currentInteractable: Entity | null = null;
  private previousInteractable: Entity | null = null;
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private mouseDownHandler: ((event: Event) => void) | null = null;
  private gamepadPollInterval: number | null = null;
  private lastGamepadButtonState = false;
  // Canvas is stored for potential future use (e.g., coordinate transformations)
  private canvas: HTMLCanvasElement | null = null;

  /** Highlight state storage - stores original emissive values */
  private highlightState = new Map<Entity, { emissiveColor: RgbaColor; emissiveIntensity: number }>();

  /** Default highlight color (cyan/blue) */
  private readonly defaultHighlightColor: RgbaColor = [0.2, 0.8, 1.0, 1.0];
  /** Default highlight intensity */
  private readonly defaultHighlightIntensity = 0.3;

  /** Scratch vectors reused to avoid allocations */
  private readonly scratchVec: Vec3 = [0, 0, 0];
  // Scratch matrix reserved for future use (e.g., view matrix calculations)
  private readonly scratchViewMatrix: Mat4 = new Float32Array(16) as Mat4;

  constructor(scene: Scene, config?: InteractionSystemConfig) {
    this.scene = scene;
    this.raycaster = new Raycaster();
    this.promptUI = new InteractionPromptUI();
    this.config = {
      interactionKey: 'KeyE',
      maxRange: 10.0,
      detectionMode: 'raycast',
      detectionRadius: 2.0,
      enableGamepad: true,
      gamepadButton: 0,
      ...config,
    };
    this.canvas = config?.canvas ?? null;
    // Mark reserved variables as used (for future use)
    void this.canvas;
    void this.scratchViewMatrix;
    // Mark gamepad variables as used (used in setupInputHandling)
    void this.gamepadPollInterval;
    void this.lastGamepadButtonState;

    this.setupInputHandling();
    this.setupMouseHandling();
    if (this.config.enableGamepad !== false) {
      this.setupGamepadHandling();
    }
    this.promptUI.initialize(undefined, config?.promptStyle);
  }

  /**
   * Update the interaction system (call each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!(deltaTime > 0)) return;

    // Update cooldowns for all interactable components
    const interactableEntities = this.scene.queryEntities(InteractableComponent);
    for (const entity of interactableEntities) {
      const component = entity.getComponent(InteractableComponent);
      if (component) {
        component.updateCooldown(deltaTime);
      }
    }

    // Perform raycast detection
    const detectedEntity = this.detectInteractable();

    // Update prompt UI
    if (detectedEntity) {
      const component = detectedEntity.getComponent(InteractableComponent);
      if (component) {
        if (component.isAvailable()) {
          // Show prompt with cooldown info if on cooldown
          const cooldownRemaining = component.cooldownRemaining > 0 ? component.cooldownRemaining : undefined;
          this.promptUI.show(component.promptText, cooldownRemaining);
          this.currentInteractable = detectedEntity;
        } else {
          // Show prompt even when on cooldown, but with cooldown info
          if (component.enabled) {
            this.promptUI.show(component.promptText, component.cooldownRemaining);
            this.currentInteractable = detectedEntity;
          } else {
            this.promptUI.hide();
            this.currentInteractable = null;
          }
        }
      } else {
        this.promptUI.hide();
        this.currentInteractable = null;
      }
    } else {
      this.promptUI.hide();
      this.currentInteractable = null;
    }

    // Update highlights
    this.updateHighlights();
  }

  /**
   * Detects the closest interactable object based on detection mode
   * @returns The closest interactable entity, or null if none found
   */
  private detectInteractable(): Entity | null {
    const mode = this.config.detectionMode || 'raycast';

    switch (mode) {
      case 'sphere':
        return this.detectInteractableSphere();
      case 'hybrid':
        // Try raycast first, fallback to sphere if no hit
        const raycastResult = this.detectInteractableRaycast();
        return raycastResult || this.detectInteractableSphere();
      case 'raycast':
      default:
        return this.detectInteractableRaycast();
    }
  }

  /**
   * Detects the closest interactable object in front of the camera using raycast
   * @returns The closest interactable entity, or null if none found
   */
  private detectInteractableRaycast(): Entity | null {
    const camera = this.scene.primaryCamera;
    if (!camera) return null;

    const cameraComponent = camera.getComponent(CameraComponent);
    if (!cameraComponent) return null;

    // Get camera position and forward direction
    const cameraPos = camera.transform.getWorldPosition();
    const cameraForward = camera.transform.getForward(this.scratchVec);

    // Create ray from camera forward
    const ray: Ray = {
      origin: [cameraPos[0], cameraPos[1], cameraPos[2]],
      direction: [cameraForward[0], cameraForward[1], cameraForward[2]],
    };

    // Get all interactable entities
    const interactableEntities = this.scene.queryEntities(InteractableComponent);

    if (interactableEntities.length === 0) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    // Perform raycast to find closest hit
    const hit = this.raycaster.raycastClosest(ray, interactableEntities);

    if (!hit) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    const hitEntity = hit.entity;
    const component = hitEntity.getComponent(InteractableComponent);
    if (!component) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    // Check if within interaction range
    const maxRange = Math.max(component.interactionRange, this.config.maxRange ?? 10.0);
    if (hit.distance > maxRange) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    // Check if enabled and available
    if (!component.enabled || !component.isAvailable()) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    this.raycaster.recycleRay(ray);
    return hitEntity;
  }

  /**
   * Detects the closest interactable object using sphere cast (distance check)
   * @returns The closest interactable entity, or null if none found
   */
  private detectInteractableSphere(): Entity | null {
    const camera = this.scene.primaryCamera;
    if (!camera) return null;

    const cameraComponent = camera.getComponent(CameraComponent);
    if (!cameraComponent) return null;

    // Get camera position
    const cameraPos = camera.transform.getWorldPosition();

    // Get all interactable entities
    const interactableEntities = this.scene.queryEntities(InteractableComponent);

    if (interactableEntities.length === 0) {
      return null;
    }

    const detectionRadius = this.config.detectionRadius ?? 2.0;
    let closestEntity: Entity | null = null;
    let closestDistance = Infinity;

    // Check distance to each interactable entity
    for (const entity of interactableEntities) {
      const component = entity.getComponent(InteractableComponent);
      if (!component || !component.enabled || !component.isAvailable()) {
        continue;
      }

      // Get entity position
      const entityPos = entity.transform.getWorldPosition();

      // Calculate distance
      const dx = entityPos[0] - cameraPos[0];
      const dy = entityPos[1] - cameraPos[1];
      const dz = entityPos[2] - cameraPos[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Check if within detection radius
      const maxRange = Math.max(component.interactionRange, this.config.maxRange ?? 10.0);
      const effectiveRadius = Math.min(detectionRadius, maxRange);

      if (distance <= effectiveRadius && distance < closestDistance) {
        closestDistance = distance;
        closestEntity = entity;
      }
    }

    return closestEntity;
  }

  /**
   * Setup keyboard input handling
   */
  private setupInputHandling(): void {
    this.keyDownHandler = (event: KeyboardEvent) => {
      if (event.code === this.config.interactionKey) {
        this.handleInteraction();
      }
    };

    window.addEventListener('keydown', this.keyDownHandler);
  }

  /**
   * Setup mouse input handling for left-click interaction
   */
  private setupMouseHandling(): void {
    this.mouseDownHandler = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      // Only handle left mouse button (button 0)
      if (mouseEvent.button !== 0) return;

      // Perform raycast from mouse position to detect clicked block
      const clickedEntity = this.detectInteractableFromMouse(mouseEvent.clientX, mouseEvent.clientY);
      
      if (clickedEntity) {
        // Trigger interaction with clicked entity
        this.triggerInteraction(clickedEntity);
      }
    };

    const targetElement = this.canvas ?? document;
    targetElement.addEventListener('mousedown', this.mouseDownHandler);
  }

  /**
   * Detect interactable entity from mouse click position
   * @param mouseX - Mouse X coordinate in screen space (clientX)
   * @param mouseY - Mouse Y coordinate in screen space (clientY)
   * @returns The clicked interactable entity, or null if none found
   */
  private detectInteractableFromMouse(mouseX: number, mouseY: number): Entity | null {
    const camera = this.scene.primaryCamera;
    if (!camera) return null;

    const cameraComponent = camera.getComponent(CameraComponent);
    if (!cameraComponent) return null;

    // Get canvas dimensions and offset
    const canvas = this.canvas;
    let canvasWidth: number;
    let canvasHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (canvas) {
      canvasWidth = canvas.width;
      canvasHeight = canvas.height;
      // Get canvas position relative to viewport
      const rect = canvas.getBoundingClientRect();
      offsetX = rect.left;
      offsetY = rect.top;
    } else {
      canvasWidth = window.innerWidth;
      canvasHeight = window.innerHeight;
    }

    // Convert mouse coordinates to canvas-relative coordinates
    const canvasX = mouseX - offsetX;
    const canvasY = mouseY - offsetY;

    // Get camera matrices
    const aspect = canvasWidth / canvasHeight;
    const viewMatrix = cameraComponent.getViewMatrix(camera, this.scratchViewMatrix);
    const projectionMatrix = new Float32Array(16) as Mat4;
    cameraComponent.getProjectionMatrix(projectionMatrix, aspect);

    // Create ray from mouse position
    const ray = this.raycaster.createRayFromScreen(
      canvasX,
      canvasY,
      canvasWidth,
      canvasHeight,
      viewMatrix,
      projectionMatrix
    );

    // Get all interactable entities
    const interactableEntities = this.scene.queryEntities(InteractableComponent);

    if (interactableEntities.length === 0) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    // Perform raycast to find clicked entity
    const hit = this.raycaster.raycastClosest(ray, interactableEntities);

    if (!hit) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    const hitEntity = hit.entity;
    const component = hitEntity.getComponent(InteractableComponent);
    if (!component) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    // Check if within interaction range
    const maxRange = Math.max(component.interactionRange, this.config.maxRange ?? 10.0);
    if (hit.distance > maxRange) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    // Check if enabled and available
    if (!component.enabled || !component.isAvailable()) {
      this.raycaster.recycleRay(ray);
      return null;
    }

    this.raycaster.recycleRay(ray);
    return hitEntity;
  }

  /**
   * Setup gamepad input handling
   */
  private setupGamepadHandling(): void {
    // Poll gamepad state every frame (gamepad API requires polling)
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return;

      // Use first connected gamepad
      for (let i = 0; i < gamepads.length; i++) {
        const gamepad = gamepads[i];
        if (!gamepad || !gamepad.connected) continue;

        const buttonIndex = this.config.gamepadButton ?? 0;
        const button = gamepad.buttons[buttonIndex];
        if (!button) continue;

        const isPressed = button.pressed || button.value > 0.5;

        // Detect button press (edge detection)
        if (isPressed && !this.lastGamepadButtonState) {
          this.handleInteraction();
        }

        this.lastGamepadButtonState = isPressed;
        break; // Use first connected gamepad only
      }
    };

    // Poll at 60fps (every ~16ms)
    this.gamepadPollInterval = window.setInterval(pollGamepad, 16);
  }

  /**
   * Handle interaction input (E key pressed)
   */
  private handleInteraction(): void {
    if (!this.currentInteractable) return;

    const component = this.currentInteractable.getComponent(InteractableComponent);
    if (!component || !component.isAvailable()) return;

    // Start cooldown
    component.startCooldown();

    // Emit logic signal for LogicCubes integration
    this.scene.events.emit('logic:signal', {
      targetEntityId: this.currentInteractable.id,
      targetPort: 'trigger',
      signal: {
        type: 'trigger',
        sourceEntityId: this.currentInteractable.id,
        timestamp: Date.now(),
      },
    });

    // Emit interaction event for other systems
    this.scene.events.emit('interaction:triggered', {
      entity: this.currentInteractable,
      component,
    });
  }

  /**
   * Get the currently detected interactable entity
   * @returns The current interactable entity, or null if none
   */
  getCurrentInteractable(): Entity | null {
    return this.currentInteractable;
  }

  /**
   * Manually trigger an interaction with an entity
   * Useful for testing or programmatic interactions
   * @param entity - Entity to interact with
   * @returns true if interaction was successful
   */
  triggerInteraction(entity: Entity): boolean {
    const component = entity.getComponent(InteractableComponent);
    if (!component || !component.isAvailable()) {
      return false;
    }

    component.startCooldown();

    // Emit logic signal
    this.scene.events.emit('logic:signal', {
      targetEntityId: entity.id,
      targetPort: 'trigger',
      signal: {
        type: 'trigger',
        sourceEntityId: entity.id,
        timestamp: Date.now(),
      },
    });

    // Emit interaction event
    this.scene.events.emit('interaction:triggered', {
      entity,
      component,
    });

    return true;
  }

  /**
   * Set the prompt style configuration.
   * @param style - Style configuration to apply
   */
  setPromptStyle(style: InteractionPromptUIStyle): void {
    this.promptUI.setStyle(style);
  }

  /**
   * Get the current prompt style configuration.
   * @returns Current style configuration
   */
  getPromptStyle(): InteractionPromptUIStyle {
    return this.promptUI.getStyle();
  }

  /**
   * Update highlights based on current interactable entity
   */
  private updateHighlights(): void {
    // Remove highlight from previous entity if changed
    if (this.previousInteractable && this.previousInteractable !== this.currentInteractable) {
      this.setHighlight(this.previousInteractable, false);
    }

    // Add highlight to current entity
    if (this.currentInteractable) {
      this.setHighlight(this.currentInteractable, true);
    }

    this.previousInteractable = this.currentInteractable;
  }

  /**
   * Set highlight state for an entity
   * @param entity - Entity to highlight/unhighlight
   * @param enabled - Whether to enable highlight
   */
  setHighlight(entity: Entity, enabled: boolean): void {
    const material = entity.getComponent(MaterialComponent);
    if (!material) return;

    if (enabled) {
      // Store original values if not already stored
      if (!this.highlightState.has(entity)) {
        this.highlightState.set(entity, {
          emissiveColor: [...material.emissiveColor],
          emissiveIntensity: material.emissiveIntensity,
        });
      }

      // Apply highlight
      material.emissiveColor = [...this.defaultHighlightColor];
      material.emissiveIntensity = this.defaultHighlightIntensity;
    } else {
      // Restore original values if stored
      const original = this.highlightState.get(entity);
      if (original) {
        material.emissiveColor = [...original.emissiveColor];
        material.emissiveIntensity = original.emissiveIntensity;
        this.highlightState.delete(entity);
      } else {
        // No original stored, reset to default
        material.emissiveColor = [0, 0, 0, 1];
        material.emissiveIntensity = 0;
      }
    }
  }

  /**
   * Update highlight intensity for an entity
   * @param entity - Entity to update
   * @param intensity - New intensity (0-1)
   */
  updateHighlight(entity: Entity, intensity: number): void {
    const material = entity.getComponent(MaterialComponent);
    if (!material) return;

    // Ensure entity is highlighted first
    if (!this.highlightState.has(entity)) {
      this.setHighlight(entity, true);
    }

    // Update intensity
    material.emissiveIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Cleanup and dispose of the system
   */
  dispose(): void {
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
    }

    if (this.mouseDownHandler) {
      const targetElement = this.canvas ?? document;
      targetElement.removeEventListener('mousedown', this.mouseDownHandler);
      this.mouseDownHandler = null;
    }

    if (this.gamepadPollInterval !== null) {
      window.clearInterval(this.gamepadPollInterval);
      this.gamepadPollInterval = null;
    }

    // Restore all highlights
    for (const entity of this.highlightState.keys()) {
      this.setHighlight(entity, false);
    }
    this.highlightState.clear();

    this.promptUI.dispose();
    this.currentInteractable = null;
    this.previousInteractable = null;
  }
}

