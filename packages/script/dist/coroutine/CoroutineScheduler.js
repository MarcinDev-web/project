/**
 * Cooperative coroutine scheduler supporting wait conditions and cancellation.
 */
export class CoroutineScheduler {
    coroutines = new Map();
    behaviorIndex = new Map();
    frameCounter = 0;
    start(iterator, owner = null) {
        const id = Symbol('coroutine');
        const coroutine = {
            id,
            owner,
            iterator,
            waiting: null,
            isComplete: false,
        };
        this.coroutines.set(id, coroutine);
        if (owner) {
            let bucket = this.behaviorIndex.get(owner);
            if (!bucket) {
                bucket = new Set();
                this.behaviorIndex.set(owner, bucket);
            }
            bucket.add(id);
        }
        return id;
    }
    attachBehaviorInstance(behavior) {
        if (!this.behaviorIndex.has(behavior)) {
            this.behaviorIndex.set(behavior, new Set());
        }
    }
    detachBehaviorInstance(behavior) {
        const bucket = this.behaviorIndex.get(behavior);
        if (!bucket)
            return;
        for (const id of bucket) {
            this.stop(id);
        }
        this.behaviorIndex.delete(behavior);
    }
    stop(id) {
        const coroutine = this.coroutines.get(id);
        if (!coroutine)
            return;
        coroutine.isComplete = true;
        this.cleanupCoroutine(coroutine);
    }
    update(deltaTime) {
        if (!Number.isFinite(deltaTime) || deltaTime < 0)
            return;
        if (deltaTime > 0)
            this.frameCounter++;
        const activeCoroutines = Array.from(this.coroutines.values());
        for (const coroutine of activeCoroutines) {
            if (!this.coroutines.has(coroutine.id))
                continue;
            if (coroutine.isComplete)
                continue;
            if (!this.shouldResume(coroutine, deltaTime)) {
                continue;
            }
            this.resumeCoroutine(coroutine);
        }
    }
    lateUpdate(deltaTime) {
        if (!Number.isFinite(deltaTime) || deltaTime < 0)
            return;
        const activeCoroutines = Array.from(this.coroutines.values());
        for (const coroutine of activeCoroutines) {
            if (!this.coroutines.has(coroutine.id))
                continue;
            if (coroutine.isComplete)
                continue;
            if (coroutine.waiting && isPredicate(coroutine.waiting) && coroutine.waiting.evaluate()) {
                this.resumeCoroutine(coroutine);
            }
        }
    }
    reset() {
        for (const coroutine of this.coroutines.values()) {
            coroutine.isComplete = true;
        }
        this.coroutines.clear();
        this.behaviorIndex.clear();
        this.frameCounter = 0;
    }
    waitForSeconds(seconds) {
        return { type: 'seconds', remaining: Math.max(0, seconds) };
    }
    waitForFrames(frames) {
        return { type: 'frames', remaining: Math.max(0, Math.floor(frames)) };
    }
    waitUntil(predicate) {
        return { type: 'predicate', evaluate: predicate };
    }
    shouldResume(coroutine, deltaTime) {
        if (!coroutine.waiting)
            return true;
        if (typeof coroutine.waiting === 'number') {
            coroutine.waiting -= deltaTime;
            return coroutine.waiting <= 0;
        }
        if (isSeconds(coroutine.waiting)) {
            coroutine.waiting.remaining -= deltaTime;
            return coroutine.waiting.remaining <= 0;
        }
        if (isFrames(coroutine.waiting)) {
            if (this.frameCounter % 1 === 0) {
                coroutine.waiting.remaining -= 1;
            }
            return coroutine.waiting.remaining <= 0;
        }
        if (isPredicate(coroutine.waiting)) {
            return coroutine.waiting.evaluate();
        }
        return true;
    }
    resumeCoroutine(coroutine) {
        try {
            const result = coroutine.iterator.next();
            if (result.done) {
                coroutine.isComplete = true;
                this.cleanupCoroutine(coroutine);
            }
            else {
                coroutine.waiting = normalizeYield(result.value);
            }
        }
        catch {
            coroutine.isComplete = true;
            this.cleanupCoroutine(coroutine);
        }
    }
    cleanupCoroutine(coroutine) {
        this.coroutines.delete(coroutine.id);
        if (coroutine.owner) {
            const bucket = this.behaviorIndex.get(coroutine.owner);
            bucket?.delete(coroutine.id);
            if (bucket && bucket.size === 0) {
                this.behaviorIndex.delete(coroutine.owner);
            }
        }
    }
}
function isSeconds(wait) {
    return typeof wait === 'object' && wait !== null && wait.type === 'seconds';
}
function isFrames(wait) {
    return typeof wait === 'object' && wait !== null && wait.type === 'frames';
}
function isPredicate(wait) {
    return typeof wait === 'object' && wait !== null && wait.type === 'predicate';
}
function normalizeYield(value) {
    if (typeof value === 'number') {
        return Math.max(0, value);
    }
    if (isSeconds(value)) {
        return { type: 'seconds', remaining: Math.max(0, value.remaining) };
    }
    if (isFrames(value)) {
        return { type: 'frames', remaining: Math.max(0, Math.floor(value.remaining)) };
    }
    if (isPredicate(value)) {
        return { type: 'predicate', evaluate: value.evaluate };
    }
    return value;
}
//# sourceMappingURL=CoroutineScheduler.js.map