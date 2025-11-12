import { Component } from './Component.js';
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
export declare class InteractableComponent extends Component {
    static readonly type = "Interactable";
    /**
     * Whether the interaction is currently enabled.
     * If false, the entity cannot be interacted with.
     * Default: true
     */
    enabled: boolean;
    /**
     * Maximum distance in world units for interaction.
     * Player must be within this distance to interact.
     * Default: 5.0 units
     */
    interactionRange: number;
    /**
     * Text displayed in the interaction prompt.
     * Default: "Press E to interact"
     */
    promptText: string;
    /**
     * Cooldown time in seconds between interactions.
     * Prevents rapid repeated interactions.
     * Default: 0 (no cooldown)
     */
    cooldown: number;
    /**
     * Current cooldown remaining time in seconds.
     * Managed by InteractionSystem.
     * @internal
     */
    cooldownRemaining: number;
    getType(): string;
    clone(): InteractableComponent;
    toJSON(): InteractableComponentJSON;
    fromJSON(data: InteractableComponentJSON): void;
    /**
     * Checks if the interaction is available (enabled and not on cooldown).
     */
    isAvailable(): boolean;
    /**
     * Updates the cooldown timer.
     * Called by InteractionSystem each frame.
     * @internal
     */
    updateCooldown(deltaTime: number): void;
    /**
     * Starts the cooldown timer.
     * Called by InteractionSystem after interaction.
     * @internal
     */
    startCooldown(): void;
}
//# sourceMappingURL=InteractableComponent.d.ts.map