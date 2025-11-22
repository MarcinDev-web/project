/**
 * FloatingHints - Contextual action hints
 * 
 * Inspired by:
 * - Action prompts (e.g., "Press E to open inventory")
 * - Modern games: Context-sensitive UI hints
 * - Dark Souls: Item pickup hints
 * 
 * Features:
 * - Show hints based on context (hovering, placement mode, etc.)
 * - Auto-dismiss after timeout
 * - Smooth animations
 */

export interface HintConfig {
  message: string;
  icon?: string;
  duration?: number; // ms, default 3000
  position?: 'top' | 'center' | 'bottom'; // default 'center'
  priority?: number; // Higher priority shows on top, default 0
}

interface ActiveHint extends HintConfig {
  id: string;
  element: HTMLElement;
  timeout: number | null;
  dismissCallback: (() => void) | null;
}

export class FloatingHints {
  private container: HTMLElement | null = null;
  private activeHints: Map<string, ActiveHint> = new Map();
  private hintIdCounter = 0;

  /**
   * Mounts the hints container.
   */
  public mount(): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'floating-hints-container';
    document.body.appendChild(this.container);
  }

  /**
   * Shows a hint.
   * @returns Hint ID for later dismissal
   */
  public show(config: HintConfig): string {
    if (!this.container) {
      this.mount();
    }

    const id = `hint-${this.hintIdCounter++}`;
    const duration = config.duration ?? 3000;
    const position = config.position ?? 'center';
    const priority = config.priority ?? 0;

    // Create hint element
    const element = document.createElement('div');
    element.className = `floating-hint floating-hint-${position}`;
    element.setAttribute('data-priority', priority.toString());

    // Build content
    const content = document.createElement('div');
    content.className = 'floating-hint-content';

    if (config.icon) {
      const icon = document.createElement('span');
      icon.className = 'floating-hint-icon';
      icon.textContent = config.icon;
      content.appendChild(icon);
    }

    const message = document.createElement('span');
    message.className = 'floating-hint-message';
    message.textContent = config.message;
    content.appendChild(message);

    element.appendChild(content);

    // Auto-dismiss timeout
    let timeout: number | null = null;
    let dismissCallback: (() => void) | null = null;

    if (duration > 0) {
      timeout = window.setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    // Store active hint
    const hint: ActiveHint = {
      ...config,
      id,
      element,
      timeout,
      dismissCallback,
    };
    this.activeHints.set(id, hint);

    // Add to container
    this.container!.appendChild(element);

    // Sort hints by priority (higher priority on top)
    this.sortHints();

    // Trigger animation
    requestAnimationFrame(() => {
      element.classList.add('visible');
    });

    return id;
  }

  /**
   * Dismisses a hint.
   */
  public dismiss(id: string): void {
    const hint = this.activeHints.get(id);
    if (!hint) return;

    // Clear timeout
    if (hint.timeout !== null) {
      clearTimeout(hint.timeout);
    }

    // Call dismiss callback
    if (hint.dismissCallback) {
      hint.dismissCallback();
    }

    // Animate out
    hint.element.classList.add('dismissed');

    setTimeout(() => {
      hint.element.remove();
      this.activeHints.delete(id);
    }, 300);
  }

  /**
   * Dismisses all hints.
   */
  public dismissAll(): void {
    const ids = Array.from(this.activeHints.keys());
    ids.forEach((id) => this.dismiss(id));
  }

  /**
   * Shows a quick hint (1 second).
   */
  public quick(message: string, icon?: string): string {
    return this.show(
      icon !== undefined
        ? { message, icon, duration: 1000 }
        : { message, duration: 1000 }
    );
  }

  /**
   * Shows a persistent hint (doesn't auto-dismiss).
   */
  public persistent(message: string, icon?: string): string {
    return this.show(
      icon !== undefined
        ? { message, icon, duration: 0 }
        : { message, duration: 0 }
    );
  }

  /**
   * Sorts hints by priority.
   */
  private sortHints(): void {
    if (!this.container) return;

    const hints = Array.from(this.activeHints.values());
    hints.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Reorder DOM elements
    hints.forEach((hint) => {
      this.container!.appendChild(hint.element);
    });
  }

  /**
   * Shows a selection hint.
   */
  public showSelectionHint(objectName: string): string {
    return this.quick(`Selected: ${objectName}`, '✨');
  }

  /**
   * Shows an undo/redo hint.
   */
  public showUndoHint(action: 'undo' | 'redo'): string {
    const message = action === 'undo' ? 'Undone' : 'Redone';
    const icon = action === 'undo' ? '↶' : '↷';
    return this.quick(message, icon);
  }

  /**
   * Shows a delete hint.
   */
  public showDeleteHint(count: number = 1): string {
    const message = count === 1 ? 'Deleted object' : `Deleted ${count} objects`;
    return this.quick(message, '🗑️');
  }

  /**
   * Shows a copy hint.
   */
  public showCopyHint(count: number = 1): string {
    const message = count === 1 ? 'Copied to clipboard' : `Copied ${count} objects`;
    return this.quick(message, '📋');
  }

  /**
   * Shows a paste hint.
   */
  public showPasteHint(count: number = 1): string {
    const message = count === 1 ? 'Pasted object' : `Pasted ${count} objects`;
    return this.quick(message, '📋');
  }

  /**
   * Shows a save hint.
   */
  public showSaveHint(projectName?: string): string {
    const message = projectName ? `Saved: ${projectName}` : 'Project saved';
    return this.show({
      message,
      icon: '💾',
      duration: 2000,
    });
  }

  /**
   * Shows a load hint.
   */
  public showLoadHint(projectName?: string): string {
    const message = projectName ? `Loaded: ${projectName}` : 'Project loaded';
    return this.show({
      message,
      icon: '📂',
      duration: 2000,
    });
  }

  /**
   * Shows a keyboard shortcut hint.
   */
  public showShortcutHint(keys: string, action: string): string {
    return this.show({
      message: `${keys} - ${action}`,
      icon: '⌨️',
      duration: 2000,
      position: 'bottom',
    });
  }

  /**
   * Disposes of the hints system.
   */
  public dispose(): void {
    this.dismissAll();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

