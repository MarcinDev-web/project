/**
 * Input context types
 */
export type InputContextType = 'editor' | 'gameplay' | 'menu' | 'dialog';

/**
 * Input action definition
 */
export interface InputAction {
  /** Action name */
  name: string;
  /** Key codes that trigger this action */
  keys: string[];
  /** Whether this action should be blocked by higher contexts */
  blockable: boolean;
}

/**
 * Input context configuration
 */
export interface InputContextConfig {
  /** Context type */
  type: InputContextType;
  /** Actions available in this context */
  actions: InputAction[];
  /** Whether this context should block lower contexts */
  blocksLowerContexts: boolean;
  /** Whether pointer lock is required */
  requiresPointerLock: boolean;
  /** Callback when action is triggered */
  onAction?: (action: string) => void;
}

/**
 * Stack-based input context manager
 * 
 * Responsibilities:
 * - Manage input context stack (push/pop)
 * - Route input events to active context
 * - Filter actions based on context
 * - Manage pointer lock based on context
 * - Prevent editor shortcuts during gameplay
 */
export class InputContextManager {
  private contextStack: InputContextConfig[] = [];
  private keyStates = new Map<string, boolean>();
  private canvas: HTMLCanvasElement;
  private pointerLocked = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  /**
   * Push a new context onto the stack
   */
  push(config: InputContextConfig): void {
    console.debug(`Pushing input context: ${config.type}`);
    
    // Handle pointer lock for new context
    if (config.requiresPointerLock && !this.pointerLocked) {
      this.requestPointerLock();
    }
    
    this.contextStack.push(config);
  }

  /**
   * Pop the top context from the stack
   */
  pop(): InputContextConfig | null {
    if (this.contextStack.length === 0) {
      console.warn('Cannot pop: context stack is empty');
      return null;
    }

    const popped = this.contextStack.pop()!;
    console.debug(`Popped input context: ${popped.type}`);
    
    // Handle pointer lock after pop
    const topContext = this.getActiveContext();
    if (popped.requiresPointerLock && !topContext?.requiresPointerLock) {
      this.releasePointerLock();
    }
    
    return popped;
  }

  /**
   * Get the active (top) context
   */
  getActiveContext(): InputContextConfig | null {
    if (this.contextStack.length === 0) {
      return null;
    }
    return this.contextStack[this.contextStack.length - 1] ?? null;
  }

  /**
   * Get context stack depth
   */
  getDepth(): number {
    return this.contextStack.length;
  }

  /**
   * Clear all contexts
   */
  clear(): void {
    console.debug('Clearing input context stack');
    
    if (this.pointerLocked) {
      this.releasePointerLock();
    }
    
    this.contextStack = [];
    this.keyStates.clear();
  }

  /**
   * Check if an action is currently active
   */
  isActionActive(actionName: string): boolean {
    const context = this.getActiveContext();
    if (!context) {
      return false;
    }

    const action = context.actions.find(a => a.name === actionName);
    if (!action) {
      return false;
    }

    // Check if any of the action's keys are pressed
    return action.keys.some(key => this.keyStates.get(key) === true);
  }

  /**
   * Get all currently active actions
   */
  getActiveActions(): string[] {
    const context = this.getActiveContext();
    if (!context) {
      return [];
    }

    const activeActions: string[] = [];
    
    for (const action of context.actions) {
      if (action.keys.some(key => this.keyStates.get(key) === true)) {
        activeActions.push(action.name);
      }
    }
    
    return activeActions;
  }

  /**
   * Check if pointer lock is active
   */
  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  /**
   * Request pointer lock
   */
  requestPointerLock(): void {
    if (this.pointerLocked) {
      return;
    }

    try {
      const requestPointerLock = (this.canvas as HTMLElement & {
        requestPointerLock?: () => void;
        mozRequestPointerLock?: () => void;
        webkitRequestPointerLock?: () => void;
      }).requestPointerLock ??
        (this.canvas as any).mozRequestPointerLock ??
        (this.canvas as any).webkitRequestPointerLock;

      if (typeof requestPointerLock === 'function') {
        requestPointerLock.call(this.canvas);
      } else {
        console.debug('Pointer lock not available on canvas element');
      }
    } catch (error) {
      console.warn('Failed to request pointer lock:', error);
    }
  }

  /**
   * Release pointer lock
   */
  releasePointerLock(): void {
    if (!this.pointerLocked) {
      return;
    }

    try {
      const exitPointerLock = document.exitPointerLock ??
        (document as any).mozExitPointerLock ??
        (document as any).webkitExitPointerLock;

      if (typeof exitPointerLock === 'function') {
        exitPointerLock.call(document);
      } else {
        console.debug('Pointer lock release not available');
      }
    } catch (error) {
      console.warn('Failed to release pointer lock:', error);
    }
  }

  /**
   * Dispose of the input context manager
   */
  dispose(): void {
    this.clear();
    this.removeEventListeners();
  }

  /**
   * Setup keyboard event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  /**
   * Handle key down event
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    const context = this.getActiveContext();
    if (!context) {
      return;
    }

    // Update key state
    this.keyStates.set(event.code, true);

    // Check if any action matches this key
    for (const action of context.actions) {
      if (action.keys.includes(event.code)) {
        // Trigger action callback
        context.onAction?.(action.name);
        
        // For movement keys (WASD, arrows), don't prevent default/stop propagation
        // to allow KeyboardInputSource to handle them in capture phase
        const isMovementKey = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code);
        
        // Prevent default if action is not blockable or context blocks lower contexts
        // BUT skip this for movement keys to allow KeyboardInputSource to handle them
        if (!isMovementKey && (!action.blockable || context.blocksLowerContexts)) {
          event.preventDefault();
          event.stopPropagation();
        }
        
        break;
      }
    }
  };

  /**
   * Handle key up event
   */
  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keyStates.set(event.code, false);
  };

  /**
   * Handle pointer lock change event
   */
  private handlePointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.canvas;
    
    if (locked !== this.pointerLocked) {
      this.pointerLocked = locked;
      console.debug(`Pointer lock ${locked ? 'acquired' : 'released'}`);
    }
  };
}

/**
 * Predefined input contexts
 */
export const EditorInputContext: Omit<InputContextConfig, 'onAction'> = {
  type: 'editor',
  blocksLowerContexts: false,
  requiresPointerLock: false,
  actions: [
    { name: 'delete', keys: ['Delete', 'Backspace'], blockable: false },
    { name: 'undo', keys: ['KeyZ'], blockable: false },
    { name: 'redo', keys: ['KeyY'], blockable: false },
    { name: 'copy', keys: ['KeyC'], blockable: false },
    { name: 'paste', keys: ['KeyV'], blockable: false },
    { name: 'selectAll', keys: ['KeyA'], blockable: false },
    { name: 'deselect', keys: ['Escape'], blockable: true },
  ],
};

export const GameplayInputContext: Omit<InputContextConfig, 'onAction'> = {
  type: 'gameplay',
  blocksLowerContexts: true,
  requiresPointerLock: true,
  actions: [
    { name: 'moveForward', keys: ['KeyW', 'ArrowUp'], blockable: false },
    { name: 'moveBackward', keys: ['KeyS', 'ArrowDown'], blockable: false },
    { name: 'moveLeft', keys: ['KeyA', 'ArrowLeft'], blockable: false },
    { name: 'moveRight', keys: ['KeyD', 'ArrowRight'], blockable: false },
    { name: 'jump', keys: ['Space'], blockable: false },
    { name: 'sprint', keys: ['ShiftLeft', 'ShiftRight'], blockable: false },
    { name: 'interact', keys: ['KeyE'], blockable: false },
    { name: 'pause', keys: ['Escape'], blockable: false },
  ],
};

export const MenuInputContext: Omit<InputContextConfig, 'onAction'> = {
  type: 'menu',
  blocksLowerContexts: true,
  requiresPointerLock: false,
  actions: [
    { name: 'close', keys: ['Escape'], blockable: false },
    { name: 'confirm', keys: ['Enter'], blockable: false },
    { name: 'up', keys: ['ArrowUp', 'KeyW'], blockable: false },
    { name: 'down', keys: ['ArrowDown', 'KeyS'], blockable: false },
  ],
};

