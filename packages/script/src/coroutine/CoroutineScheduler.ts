import type { BehaviorInstance } from '../behavior/Behavior.js';

export type CoroutineGenerator = Generator<CoroutineYield, void, unknown>;

export type CoroutineYield = number | WaitForSeconds | WaitForFrames | WaitForPredicate;

export interface WaitForSeconds {
  type: 'seconds';
  remaining: number;
}

export interface WaitForFrames {
  type: 'frames';
  remaining: number;
}

export interface WaitForPredicate {
  type: 'predicate';
  evaluate: () => boolean;
}

export interface Coroutine {
  id: symbol;
  owner: BehaviorInstance | null;
  iterator: CoroutineGenerator;
  waiting: CoroutineYield | null;
  isComplete: boolean;
}

/**
 * Cooperative coroutine scheduler supporting wait conditions and cancellation.
 */
export class CoroutineScheduler {
  private readonly coroutines = new Map<symbol, Coroutine>();
  private readonly behaviorIndex = new Map<BehaviorInstance, Set<symbol>>();
  private frameCounter = 0;

  start(iterator: CoroutineGenerator, owner: BehaviorInstance | null = null): symbol {
    const id = Symbol('coroutine');
    const coroutine: Coroutine = {
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
        bucket = new Set<symbol>();
        this.behaviorIndex.set(owner, bucket);
      }
      bucket.add(id);
    }
    return id;
  }

  attachBehaviorInstance(behavior: BehaviorInstance): void {
    if (!this.behaviorIndex.has(behavior)) {
      this.behaviorIndex.set(behavior, new Set());
    }
  }

  detachBehaviorInstance(behavior: BehaviorInstance): void {
    const bucket = this.behaviorIndex.get(behavior);
    if (!bucket) return;
    for (const id of bucket) {
      this.stop(id);
    }
    this.behaviorIndex.delete(behavior);
  }

  stop(id: symbol): void {
    const coroutine = this.coroutines.get(id);
    if (!coroutine) return;
    coroutine.isComplete = true;
    this.cleanupCoroutine(coroutine);
  }

  update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) return;
    if (deltaTime > 0) this.frameCounter++;
    const activeCoroutines = Array.from(this.coroutines.values());
    for (const coroutine of activeCoroutines) {
      if (!this.coroutines.has(coroutine.id)) continue;
      if (coroutine.isComplete) continue;
      if (!this.shouldResume(coroutine, deltaTime)) {
        continue;
      }
      this.resumeCoroutine(coroutine);
    }
  }

  lateUpdate(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) return;
    const activeCoroutines = Array.from(this.coroutines.values());
    for (const coroutine of activeCoroutines) {
      if (!this.coroutines.has(coroutine.id)) continue;
      if (coroutine.isComplete) continue;
      if (coroutine.waiting && isPredicate(coroutine.waiting) && coroutine.waiting.evaluate()) {
        this.resumeCoroutine(coroutine);
      }
    }
  }

  reset(): void {
    for (const coroutine of this.coroutines.values()) {
      coroutine.isComplete = true;
    }
    this.coroutines.clear();
    this.behaviorIndex.clear();
    this.frameCounter = 0;
  }

  waitForSeconds(seconds: number): WaitForSeconds {
    return { type: 'seconds', remaining: Math.max(0, seconds) };
  }

  waitForFrames(frames: number): WaitForFrames {
    return { type: 'frames', remaining: Math.max(0, Math.floor(frames)) };
  }

  waitUntil(predicate: () => boolean): WaitForPredicate {
    return { type: 'predicate', evaluate: predicate };
  }

  private shouldResume(coroutine: Coroutine, deltaTime: number): boolean {
    if (!coroutine.waiting) return true;
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

  private resumeCoroutine(coroutine: Coroutine): void {
    try {
      const result = coroutine.iterator.next();
      if (result.done) {
        coroutine.isComplete = true;
        this.cleanupCoroutine(coroutine);
      } else {
        coroutine.waiting = normalizeYield(result.value);
      }
    } catch {
      coroutine.isComplete = true;
      this.cleanupCoroutine(coroutine);
    }
  }

  private cleanupCoroutine(coroutine: Coroutine): void {
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

function isSeconds(wait: CoroutineYield): wait is WaitForSeconds {
  return typeof wait === 'object' && wait !== null && (wait as WaitForSeconds).type === 'seconds';
}

function isFrames(wait: CoroutineYield): wait is WaitForFrames {
  return typeof wait === 'object' && wait !== null && (wait as WaitForFrames).type === 'frames';
}

function isPredicate(wait: CoroutineYield): wait is WaitForPredicate {
  return (
    typeof wait === 'object' && wait !== null && (wait as WaitForPredicate).type === 'predicate'
  );
}

function normalizeYield(value: CoroutineYield): CoroutineYield {
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
