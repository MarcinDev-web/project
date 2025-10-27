/**
 * Calculates the next power-of-2 capacity for buffer allocation.
 * Grows exponentially to reduce realloc churn.
 */
function nextCapacity(minSize) {
    // Minimum 256 bytes
    const min = Math.max(minSize, 256);
    let cap = 256;
    while (cap < min)
        cap <<= 1;
    return cap;
}
/**
 * Enhanced GPU Buffer Pool with size-based buckets and LRU eviction.
 *
 * Features:
 * - Size-based buckets for efficient reuse
 * - LRU eviction policy to manage memory
 * - Automatic cleanup of unused buffers
 * - Memory tracking and statistics
 */
export class GPUBufferPool {
    device;
    buffers = new Map();
    // Size buckets: maps size -> list of available buffers
    sizeBuckets = new Map();
    maxPoolSize = 100; // Max number of pooled buffers
    maxAge = 30000; // Max age in ms (30 seconds)
    lastCleanup = 0;
    cleanupInterval = 10000; // Cleanup every 10 seconds
    constructor(device, options) {
        this.device = device;
        if (options?.maxPoolSize)
            this.maxPoolSize = options.maxPoolSize;
        if (options?.maxAge)
            this.maxAge = options.maxAge;
        if (options?.cleanupInterval)
            this.cleanupInterval = options.cleanupInterval;
    }
    /**
     * Gets or creates a buffer with specified size and usage.
     * Returns existing buffer if compatible, otherwise creates new one.
     */
    getOrCreate(name, size, usage, label) {
        const existing = this.buffers.get(name);
        // Try to reuse existing buffer if compatible
        if (existing && existing.usage === usage && existing.capacity >= size) {
            existing.lastUsed = this.now();
            return existing.buffer;
        }
        // Try to find a buffer from size bucket
        const capacity = nextCapacity(size);
        const bucketBuffer = this.findInBucket(capacity, usage);
        if (bucketBuffer) {
            // Reuse from bucket
            const record = {
                buffer: bucketBuffer,
                capacity,
                usage,
                lastUsed: this.now(),
                label,
            };
            // Destroy previous buffer if present
            if (existing) {
                this.destroyBuffer(existing);
            }
            this.buffers.set(name, record);
            return bucketBuffer;
        }
        // Create new buffer
        const buffer = this.device.createBuffer({
            label: label ?? name,
            size: capacity,
            usage,
        });
        const record = {
            buffer,
            capacity,
            usage,
            lastUsed: this.now(),
            label,
        };
        // Destroy previous buffer if present
        if (existing) {
            this.destroyBuffer(existing);
        }
        this.buffers.set(name, record);
        // Periodic cleanup
        this.maybeCleanup();
        return buffer;
    }
    /**
     * Gets a buffer by name (if it exists).
     */
    get(name) {
        const record = this.buffers.get(name);
        if (record) {
            record.lastUsed = this.now();
            return record.buffer;
        }
        return null;
    }
    /**
     * Releases a buffer back to the pool for reuse.
     * Buffer can be reused for other allocations with compatible size/usage.
     */
    release(name) {
        const record = this.buffers.get(name);
        if (!record)
            return;
        // Remove from active buffers
        this.buffers.delete(name);
        // Add to size bucket for reuse
        this.addToBucket(record);
        // Enforce pool size limit with LRU eviction
        this.enforceSizeLimit();
    }
    /**
     * Destroys a specific buffer and removes it from the pool.
     */
    destroy(name) {
        const record = this.buffers.get(name);
        if (record) {
            this.destroyBuffer(record);
            this.buffers.delete(name);
        }
    }
    /**
     * Disposes all buffers in the pool.
     */
    disposeAll() {
        // Destroy all active buffers
        for (const record of this.buffers.values()) {
            this.destroyBuffer(record);
        }
        this.buffers.clear();
        // Destroy all pooled buffers
        for (const entries of this.sizeBuckets.values()) {
            for (const entry of entries) {
                this.destroyBuffer(entry.record);
            }
        }
        this.sizeBuckets.clear();
    }
    /**
     * Gets pool statistics for monitoring.
     */
    getStats() {
        let pooledBuffers = 0;
        let pooledMemory = 0;
        for (const entries of this.sizeBuckets.values()) {
            pooledBuffers += entries.length;
            for (const entry of entries) {
                pooledMemory += entry.record.capacity;
            }
        }
        const activeMemory = Array.from(this.buffers.values()).reduce((sum, rec) => sum + rec.capacity, 0);
        return {
            activeBuffers: this.buffers.size,
            pooledBuffers,
            totalBuffers: this.buffers.size + pooledBuffers,
            totalMemory: activeMemory + pooledMemory,
            bucketCount: this.sizeBuckets.size,
        };
    }
    /**
     * Performs manual cleanup of old unused buffers.
     */
    cleanup() {
        const now = this.now();
        const removed = [];
        // Clean up pooled buffers that are too old
        for (const [size, entries] of this.sizeBuckets.entries()) {
            const filtered = entries.filter((entry) => {
                const age = now - entry.record.lastUsed;
                if (age > this.maxAge) {
                    this.destroyBuffer(entry.record);
                    return false;
                }
                return true;
            });
            if (filtered.length === 0) {
                this.sizeBuckets.delete(size);
            }
            else {
                this.sizeBuckets.set(size, filtered);
            }
        }
        // Clean up active buffers that haven't been used recently
        // (optional - usually we don't auto-cleanup active buffers)
        for (const [name, record] of this.buffers.entries()) {
            const age = now - record.lastUsed;
            if (age > this.maxAge * 3) {
                // Much longer threshold for active buffers
                this.destroyBuffer(record);
                removed.push(name);
            }
        }
        for (const name of removed) {
            this.buffers.delete(name);
        }
        this.lastCleanup = now;
    }
    /**
     * Finds a compatible buffer in size buckets.
     */
    findInBucket(capacity, usage) {
        const entries = this.sizeBuckets.get(capacity);
        if (!entries || entries.length === 0)
            return null;
        // Find first buffer with matching usage
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry && entry.record.usage === usage) {
                // Remove from bucket
                entries.splice(i, 1);
                if (entries.length === 0) {
                    this.sizeBuckets.delete(capacity);
                }
                return entry.record.buffer;
            }
        }
        return null;
    }
    /**
     * Adds a buffer to the appropriate size bucket for reuse.
     */
    addToBucket(record) {
        const entries = this.sizeBuckets.get(record.capacity) ?? [];
        entries.push({
            key: `pooled-${Math.random()}`,
            record,
        });
        this.sizeBuckets.set(record.capacity, entries);
    }
    /**
     * Enforces the maximum pool size by evicting least recently used buffers.
     */
    enforceSizeLimit() {
        const stats = this.getStats();
        if (stats.totalBuffers <= this.maxPoolSize)
            return;
        // Collect all pooled buffers with their last used time
        const allPooled = [];
        for (const entries of this.sizeBuckets.values()) {
            allPooled.push(...entries);
        }
        // Sort by last used (oldest first)
        allPooled.sort((a, b) => a.record.lastUsed - b.record.lastUsed);
        // Destroy oldest buffers until we're under the limit
        const toRemove = stats.totalBuffers - this.maxPoolSize;
        for (let i = 0; i < toRemove && i < allPooled.length; i++) {
            const entry = allPooled[i];
            if (entry) {
                this.destroyBuffer(entry.record);
                // Remove from bucket
                this.removeFromBucket(entry.record);
            }
        }
    }
    /**
     * Removes a buffer from its size bucket.
     */
    removeFromBucket(record) {
        const entries = this.sizeBuckets.get(record.capacity);
        if (!entries)
            return;
        const index = entries.findIndex((e) => e.record.buffer === record.buffer);
        if (index !== -1) {
            entries.splice(index, 1);
            if (entries.length === 0) {
                this.sizeBuckets.delete(record.capacity);
            }
        }
    }
    /**
     * Safely destroys a buffer.
     */
    destroyBuffer(record) {
        try {
            record.buffer.destroy();
        }
        catch {
            // ignore destroy errors
        }
    }
    /**
     * Performs periodic cleanup if needed.
     */
    maybeCleanup() {
        const now = this.now();
        if (now - this.lastCleanup >= this.cleanupInterval) {
            this.cleanup();
        }
    }
    /**
     * Gets current timestamp.
     */
    now() {
        return typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
    }
}
//# sourceMappingURL=bufferPool.js.map