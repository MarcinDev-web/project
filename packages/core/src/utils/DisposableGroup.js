/**
 * DisposableGroup - Manages disposal of resources and cleanup of event listeners.
 * Provides a centralized way to track and dispose resources without reassigning methods.
 *
 * @example
 * ```typescript
 * class MyComponent {
 *   private disposables = new DisposableGroup();
 *
 *   initialize() {
 *     const listener = () => console.log('clicked');
 *     document.addEventListener('click', listener);
 *     this.disposables.add(() => document.removeEventListener('click', listener));
 *
 *     // Or use AbortController pattern
 *     const controller = new AbortController();
 *     document.addEventListener('click', listener, { signal: controller.signal });
 *     this.disposables.add(() => controller.abort());
 *   }
 *
 *   dispose() {
 *     this.disposables.dispose();
 *   }
 * }
 * ```
 */
export class DisposableGroup {
    disposables = [];
    disposed = false;
    /**
     * Adds a disposable resource to the group.
     * @param disposable - Function that cleans up the resource
     */
    add(disposable) {
        if (this.disposed) {
            console.warn('DisposableGroup: Cannot add to disposed group');
            return;
        }
        this.disposables.push(disposable);
    }
    /**
     * Adds multiple disposables at once.
     * @param disposables - Array of cleanup functions
     */
    addMany(...disposables) {
        for (const d of disposables) {
            this.add(d);
        }
    }
    /**
     * Adds a child DisposableGroup that will be disposed with this group.
     * @param group - Child group to add
     */
    addGroup(group) {
        this.add(() => group.dispose());
    }
    /**
     * Disposes all registered resources.
     * Safe to call multiple times (idempotent).
     * Errors during disposal are logged but don't stop other disposals.
     */
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        // Dispose in reverse order (LIFO - last in, first out)
        const errors = [];
        for (let i = this.disposables.length - 1; i >= 0; i--) {
            const disposable = this.disposables[i];
            try {
                disposable?.();
            }
            catch (error) {
                errors.push(error instanceof Error ? error : new Error(String(error)));
            }
        }
        this.disposables = [];
        // Log accumulated errors
        if (errors.length > 0) {
            console.error('DisposableGroup: Errors during disposal:', errors);
        }
    }
    /**
     * Checks if this group has been disposed.
     */
    isDisposed() {
        return this.disposed;
    }
    /**
     * Returns the number of registered disposables.
     */
    size() {
        return this.disposables.length;
    }
    /**
     * Clears all disposables without calling them.
     * Useful for testing or when manually managing disposal.
     */
    clear() {
        this.disposables = [];
    }
}
/**
 * Type guard to check if an object is disposable.
 */
export function isDisposable(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        'dispose' in obj &&
        typeof obj.dispose === 'function');
}
/**
 * Helper to wrap a disposable object for use with DisposableGroup.
 */
export function toDisposable(obj) {
    return () => obj.dispose();
}
//# sourceMappingURL=DisposableGroup.js.map