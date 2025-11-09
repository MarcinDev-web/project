import { Component } from './Component.js';
import { registerComponent } from './registry.js';

export interface InteractableComponentJSON {
  enabled?: boolean;
  interactionRange?: number;
  promptText?: string;
  cooldown?: number;
}

/**
 * InteractableComponent marks an entity as interactable by the player.
 *
 * Usage:
 * - Add this component to entities that players can interact with
 * - Set promptText to customize the interaction prompt
 * - Set interactionRange to control maximum interaction distance
 * - Set cooldown to prevent rapid repeated interactions
 * - InteractionSystem will detect and handle interactions with entities having this component
 */
export class InteractableComponent extends Component {
  static readonly type = 'Interactable';

  /**
   * Whether the interaction is currently enabled.
   * If false, the entity cannot be interacted with.
   * Default: true
   */
  enabled = true;

  /**
   * Maximum distance in world units for interaction.
   * Player must be within this distance to interact.
   * Default: 5.0 units
   */
  interactionRange = 5.0;

  /**
   * Text displayed in the interaction prompt.
   * Default: "Press E to interact"
   */
  promptText = 'Press E to interact';

  /**
   * Cooldown time in seconds between interactions.
   * Prevents rapid repeated interactions.
   * Default: 0 (no cooldown)
   */
  cooldown = 0;

  /**
   * Current cooldown remaining time in seconds.
   * Managed by InteractionSystem.
   * @internal
   */
  cooldownRemaining = 0;

  getType(): string {
    return InteractableComponent.type;
  }

  override clone(): InteractableComponent {
    const clone = new InteractableComponent();
    clone.enabled = this.enabled;
    clone.interactionRange = this.interactionRange;
    clone.promptText = this.promptText;
    clone.cooldown = this.cooldown;
    clone.cooldownRemaining = this.cooldownRemaining;
    return clone;
  }

  override toJSON(): InteractableComponentJSON {
    return {
      enabled: this.enabled,
      interactionRange: this.interactionRange,
      promptText: this.promptText,
      cooldown: this.cooldown,
    };
  }

  fromJSON(data: InteractableComponentJSON): void {
    if (typeof data.enabled === 'boolean') {
      this.enabled = data.enabled;
    }
    if (typeof data.interactionRange === 'number' && data.interactionRange > 0) {
      this.interactionRange = data.interactionRange;
    }
    if (typeof data.promptText === 'string') {
      this.promptText = data.promptText;
    }
    if (typeof data.cooldown === 'number' && data.cooldown >= 0) {
      this.cooldown = data.cooldown;
    }
  }

  /**
   * Checks if the interaction is available (enabled and not on cooldown).
   */
  isAvailable(): boolean {
    return this.enabled && this.cooldownRemaining <= 0;
  }

  /**
   * Updates the cooldown timer.
   * Called by InteractionSystem each frame.
   * @internal
   */
  updateCooldown(deltaTime: number): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaTime);
    }
  }

  /**
   * Starts the cooldown timer.
   * Called by InteractionSystem after interaction.
   * @internal
   */
  startCooldown(): void {
    this.cooldownRemaining = this.cooldown;
  }
}

registerComponent(InteractableComponent.type, InteractableComponent);

