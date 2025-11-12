/**
 * InteractionPromptUI - Simple UI overlay for displaying interaction prompts
 *
 * Displays a prompt at the bottom center of the screen when an interactable
 * object is detected. Uses a simple HTML overlay approach for performance.
 */
/**
 * Style configuration for interaction prompt UI
 */
export interface InteractionPromptUIStyle {
    /** Background color (default: 'rgba(0, 0, 0, 0.8)') */
    backgroundColor?: string;
    /** Text color (default: '#ffffff') */
    textColor?: string;
    /** Font size in pixels (default: 16) */
    fontSize?: number;
    /** Font weight (default: '500') */
    fontWeight?: string;
    /** Border radius in pixels (default: 8) */
    borderRadius?: number;
    /** Padding (default: '12px 24px') */
    padding?: string;
    /** Position on screen (default: 'bottom-center') */
    position?: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center';
    /** Vertical offset from edge in pixels (default: 80) */
    offsetY?: number;
}
export declare class InteractionPromptUI {
    private container;
    private promptElement;
    private isVisible;
    private currentStyle;
    /**
     * Initialize the prompt UI.
     * Creates the HTML elements and attaches them to the document.
     * @param parentContainer - Optional parent container (defaults to document.body)
     * @param style - Optional style configuration
     */
    initialize(parentContainer?: HTMLElement, style?: InteractionPromptUIStyle): void;
    /**
     * Show the interaction prompt with the specified text.
     * @param text - Text to display in the prompt
     * @param cooldownRemaining - Optional cooldown remaining time in seconds
     */
    show(text: string, cooldownRemaining?: number): void;
    /**
     * Hide the interaction prompt.
     */
    hide(): void;
    /**
     * Check if the prompt is currently visible.
     */
    getVisible(): boolean;
    /**
     * Update the prompt text without showing/hiding.
     * @param text - New text to display
     */
    updateText(text: string): void;
    /**
     * Set the style configuration for the prompt.
     * Reinitializes the UI if already initialized.
     * @param style - Style configuration to apply
     */
    setStyle(style: InteractionPromptUIStyle): void;
    /**
     * Get the current style configuration.
     * @returns Current style configuration
     */
    getStyle(): InteractionPromptUIStyle;
    /**
     * Cleanup and remove the prompt UI elements.
     */
    cleanup(): void;
    /**
     * Dispose of the prompt UI.
     */
    dispose(): void;
}
//# sourceMappingURL=InteractionPromptUI.d.ts.map