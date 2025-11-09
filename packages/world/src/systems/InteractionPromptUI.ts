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

export class InteractionPromptUI {
  private container: HTMLElement | null = null;
  private promptElement: HTMLElement | null = null;
  private isVisible = false;
  private currentStyle: InteractionPromptUIStyle = {};

  /**
   * Initialize the prompt UI.
   * Creates the HTML elements and attaches them to the document.
   * @param parentContainer - Optional parent container (defaults to document.body)
   * @param style - Optional style configuration
   */
  initialize(parentContainer?: HTMLElement, style?: InteractionPromptUIStyle): void {
    if (this.container) {
      this.cleanup();
    }

    if (style) {
      this.currentStyle = { ...style };
    }

    const container = document.createElement('div');
    container.id = 'interaction-prompt-container';
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '2000';
    container.style.display = 'flex';

    // Apply position style
    const position = this.currentStyle.position || 'bottom-center';
    const offsetY = this.currentStyle.offsetY ?? 80;

    switch (position) {
      case 'bottom-center':
        container.style.alignItems = 'flex-end';
        container.style.justifyContent = 'center';
        container.style.paddingBottom = `${offsetY}px`;
        break;
      case 'bottom-left':
        container.style.alignItems = 'flex-end';
        container.style.justifyContent = 'flex-start';
        container.style.paddingBottom = `${offsetY}px`;
        container.style.paddingLeft = '20px';
        break;
      case 'bottom-right':
        container.style.alignItems = 'flex-end';
        container.style.justifyContent = 'flex-end';
        container.style.paddingBottom = `${offsetY}px`;
        container.style.paddingRight = '20px';
        break;
      case 'top-center':
        container.style.alignItems = 'flex-start';
        container.style.justifyContent = 'center';
        container.style.paddingTop = `${offsetY}px`;
        break;
    }

    const prompt = document.createElement('div');
    prompt.id = 'interaction-prompt';
    prompt.style.display = 'none';
    prompt.style.backgroundColor = this.currentStyle.backgroundColor || 'rgba(0, 0, 0, 0.8)';
    prompt.style.color = this.currentStyle.textColor || '#ffffff';
    prompt.style.padding = this.currentStyle.padding || '12px 24px';
    prompt.style.borderRadius = `${this.currentStyle.borderRadius ?? 8}px`;
    prompt.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    prompt.style.fontSize = `${this.currentStyle.fontSize ?? 16}px`;
    prompt.style.fontWeight = this.currentStyle.fontWeight || '500';
    prompt.style.textAlign = 'center';
    prompt.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    prompt.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    prompt.style.userSelect = 'none';
    prompt.style.pointerEvents = 'auto';
    prompt.style.transition = 'opacity 0.2s ease-in-out';

    container.appendChild(prompt);

    const parent = parentContainer || document.body;
    parent.appendChild(container);

    this.container = container;
    this.promptElement = prompt;
  }

  /**
   * Show the interaction prompt with the specified text.
   * @param text - Text to display in the prompt
   * @param cooldownRemaining - Optional cooldown remaining time in seconds
   */
  show(text: string, cooldownRemaining?: number): void {
    if (!this.promptElement) {
      this.initialize();
    }

    if (this.promptElement) {
      // Format text with cooldown if provided
      let displayText = text;
      if (cooldownRemaining !== undefined && cooldownRemaining > 0) {
        const cooldownSeconds = cooldownRemaining.toFixed(1);
        displayText = `${text} (${cooldownSeconds}s)`;
        // Change color to gray when on cooldown
        this.promptElement.style.color = '#aaaaaa';
        this.promptElement.style.opacity = '0.7';
      } else {
        // Reset to normal color when available
        this.promptElement.style.color = '#ffffff';
        this.promptElement.style.opacity = '1';
      }

      this.promptElement.textContent = displayText;
      this.promptElement.style.display = 'block';
      this.isVisible = true;
    }
  }

  /**
   * Hide the interaction prompt.
   */
  hide(): void {
    if (this.promptElement) {
      this.promptElement.style.opacity = '0';
      // Hide after transition completes
      setTimeout(() => {
        if (this.promptElement) {
          this.promptElement.style.display = 'none';
        }
      }, 200);
      this.isVisible = false;
    }
  }

  /**
   * Check if the prompt is currently visible.
   */
  getVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Update the prompt text without showing/hiding.
   * @param text - New text to display
   */
  updateText(text: string): void {
    if (this.promptElement) {
      this.promptElement.textContent = text;
    }
  }

  /**
   * Set the style configuration for the prompt.
   * Reinitializes the UI if already initialized.
   * @param style - Style configuration to apply
   */
  setStyle(style: InteractionPromptUIStyle): void {
    this.currentStyle = { ...style };
    // Reinitialize if already initialized to apply new style
    if (this.container) {
      const parent = this.container.parentNode as HTMLElement | null;
      this.cleanup();
      this.initialize(parent ?? undefined, style);
    }
  }

  /**
   * Get the current style configuration.
   * @returns Current style configuration
   */
  getStyle(): InteractionPromptUIStyle {
    return { ...this.currentStyle };
  }

  /**
   * Cleanup and remove the prompt UI elements.
   */
  cleanup(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.promptElement = null;
    this.isVisible = false;
  }

  /**
   * Dispose of the prompt UI.
   */
  dispose(): void {
    this.cleanup();
  }
}

