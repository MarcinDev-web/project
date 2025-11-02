/**
 * Generic object pool to reduce GC churn for short-lived objects.
 */
export class ObjectPool {
    create;
    reset;
    pool = [];
    maxSize;
    constructor(create, reset, maxSize = 1024) {
        this.create = create;
        if (reset !== undefined) {
            this.reset = reset;
        }
        this.maxSize = maxSize;
    }
    acquire() {
        return this.pool.pop() ?? this.create();
    }
    release(obj) {
        if (this.reset)
            this.reset(obj);
        if (this.pool.length < this.maxSize)
            this.pool.push(obj);
    }
    clear() {
        this.pool.length = 0;
    }
}
//# sourceMappingURL=ObjectPool.js.map