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
export declare class InputContextManager {
    private contextStack;
    private keyStates;
    private canvas;
    private pointerLocked;
    constructor(canvas: HTMLCanvasElement);
    /**
     * Push a new context onto the stack
     */
    push(config: InputContextConfig): void;
    /**
     * Pop the top context from the stack
     */
    pop(): InputContextConfig | null;
    /**
     * Get the active (top) context
     */
    getActiveContext(): InputContextConfig | null;
    /**
     * Get context stack depth
     */
    getDepth(): number;
    /**
     * Clear all contexts
     */
    clear(): void;
    /**
     * Check if an action is currently active
     */
    isActionActive(actionName: string): boolean;
    /**
     * Get all currently active actions
     */
    getActiveActions(): string[];
    /**
     * Check if pointer lock is active
     */
    isPointerLocked(): boolean;
    /**
     * Request pointer lock
     */
    requestPointerLock(): void;
    /**
     * Release pointer lock
     */
    releasePointerLock(): void;
    /**
     * Dispose of the input context manager
     */
    dispose(): void;
    /**
     * Setup keyboard event listeners
     */
    private setupEventListeners;
    /**
     * Remove event listeners
     */
    private removeEventListeners;
    /**
     * Handle key down event
     */
    private handleKeyDown;
    /**
     * Handle key up event
     */
    private handleKeyUp;
    /**
     * Handle pointer lock change event
     */
    private handlePointerLockChange;
}
/**
 * Predefined input contexts
 */
export declare const EditorInputContext: Omit<InputContextConfig, 'onAction'>;
export declare const GameplayInputContext: Omit<InputContextConfig, 'onAction'>;
export declare const MenuInputContext: Omit<InputContextConfig, 'onAction'>;
//# sourceMappingURL=InputContext.d.ts.map