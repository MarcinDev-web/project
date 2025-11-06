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
export declare class CoroutineScheduler {
    private readonly coroutines;
    private readonly behaviorIndex;
    private frameCounter;
    start(iterator: CoroutineGenerator, owner?: BehaviorInstance | null): symbol;
    attachBehaviorInstance(behavior: BehaviorInstance): void;
    detachBehaviorInstance(behavior: BehaviorInstance): void;
    stop(id: symbol): void;
    update(deltaTime: number): void;
    lateUpdate(deltaTime: number): void;
    reset(): void;
    waitForSeconds(seconds: number): WaitForSeconds;
    waitForFrames(frames: number): WaitForFrames;
    waitUntil(predicate: () => boolean): WaitForPredicate;
    private shouldResume;
    private resumeCoroutine;
    private cleanupCoroutine;
}
//# sourceMappingURL=CoroutineScheduler.d.ts.map