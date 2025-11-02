/**
 * Generic object pool to reduce GC churn for short-lived objects.
 */
export class ObjectPool<T> {
  private readonly create: () => T;
  private readonly reset?: (obj: T) => void;
  private readonly pool: T[] = [];
  private readonly maxSize: number;

  constructor(create: () => T, reset?: (obj: T) => void, maxSize = 1024) {
    this.create = create;
    if (reset !== undefined) {
      this.reset = reset;
    }
    this.maxSize = maxSize;
  }

  acquire(): T {
    return this.pool.pop() ?? this.create();
  }

  release(obj: T): void {
    if (this.reset) this.reset(obj);
    if (this.pool.length < this.maxSize) this.pool.push(obj);
  }

  clear(): void {
    this.pool.length = 0;
  }
}
