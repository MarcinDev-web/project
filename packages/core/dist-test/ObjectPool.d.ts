/**
 * Generic object pool to reduce GC churn for short-lived objects.
 */
export declare class ObjectPool<T> {
    private readonly create;
    private readonly reset?;
    private readonly pool;
    private readonly maxSize;
    constructor(create: () => T, reset?: (obj: T) => void, maxSize?: number);
    acquire(): T;
    release(obj: T): void;
    clear(): void;
}
