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
export declare class DisposableGroup {
    private disposables;
    private disposed;
    /**
     * Adds a disposable resource to the group.
     * @param disposable - Function that cleans up the resource
     */
    add(disposable: () => void): void;
    /**
     * Adds multiple disposables at once.
     * @param disposables - Array of cleanup functions
     */
    addMany(...disposables: Array<() => void>): void;
    /**
     * Adds a child DisposableGroup that will be disposed with this group.
     * @param group - Child group to add
     */
    addGroup(group: DisposableGroup): void;
    /**
     * Disposes all registered resources.
     * Safe to call multiple times (idempotent).
     * Errors during disposal are logged but don't stop other disposals.
     */
    dispose(): void;
    /**
     * Checks if this group has been disposed.
     */
    isDisposed(): boolean;
    /**
     * Returns the number of registered disposables.
     */
    size(): number;
    /**
     * Clears all disposables without calling them.
     * Useful for testing or when manually managing disposal.
     */
    clear(): void;
}
/**
 * Disposable interface for objects that can be disposed.
 */
export interface IDisposable {
    dispose(): void;
}
/**
 * Type guard to check if an object is disposable.
 */
export declare function isDisposable(obj: unknown): obj is IDisposable;
/**
 * Helper to wrap a disposable object for use with DisposableGroup.
 */
export declare function toDisposable(obj: IDisposable): () => void;
