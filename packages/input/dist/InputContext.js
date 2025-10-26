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
    contextStack = [];
    keyStates = new Map();
    canvas;
    pointerLocked = false;
    constructor(canvas) {
        this.canvas = canvas;
        this.setupEventListeners();
    }
    /**
     * Push a new context onto the stack
     */
    push(config) {
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
    pop() {
        if (this.contextStack.length === 0) {
            console.warn('Cannot pop: context stack is empty');
            return null;
        }
        const popped = this.contextStack.pop();
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
    getActiveContext() {
        if (this.contextStack.length === 0) {
            return null;
        }
        return this.contextStack[this.contextStack.length - 1] ?? null;
    }
    /**
     * Get context stack depth
     */
    getDepth() {
        return this.contextStack.length;
    }
    /**
     * Clear all contexts
     */
    clear() {
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
    isActionActive(actionName) {
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
    getActiveActions() {
        const context = this.getActiveContext();
        if (!context) {
            return [];
        }
        const activeActions = [];
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
    isPointerLocked() {
        return this.pointerLocked;
    }
    /**
     * Request pointer lock
     */
    requestPointerLock() {
        if (this.pointerLocked) {
            return;
        }
        try {
            const requestPointerLock = this.canvas.requestPointerLock ??
                this.canvas.mozRequestPointerLock ??
                this.canvas.webkitRequestPointerLock;
            if (typeof requestPointerLock === 'function') {
                requestPointerLock.call(this.canvas);
            }
            else {
                console.debug('Pointer lock not available on canvas element');
            }
        }
        catch (error) {
            console.warn('Failed to request pointer lock:', error);
        }
    }
    /**
     * Release pointer lock
     */
    releasePointerLock() {
        if (!this.pointerLocked) {
            return;
        }
        try {
            const exitPointerLock = document.exitPointerLock ??
                document.mozExitPointerLock ??
                document.webkitExitPointerLock;
            if (typeof exitPointerLock === 'function') {
                exitPointerLock.call(document);
            }
            else {
                console.debug('Pointer lock release not available');
            }
        }
        catch (error) {
            console.warn('Failed to release pointer lock:', error);
        }
    }
    /**
     * Dispose of the input context manager
     */
    dispose() {
        this.clear();
        this.removeEventListeners();
    }
    /**
     * Setup keyboard event listeners
     */
    setupEventListeners() {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    }
    /**
     * Remove event listeners
     */
    removeEventListeners() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    }
    /**
     * Handle key down event
     */
    handleKeyDown = (event) => {
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
                // Prevent default if action is not blockable or context blocks lower contexts
                if (!action.blockable || context.blocksLowerContexts) {
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
    handleKeyUp = (event) => {
        this.keyStates.set(event.code, false);
    };
    /**
     * Handle pointer lock change event
     */
    handlePointerLockChange = () => {
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
export const EditorInputContext = {
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
export const GameplayInputContext = {
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
export const MenuInputContext = {
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
//# sourceMappingURL=InputContext.js.map