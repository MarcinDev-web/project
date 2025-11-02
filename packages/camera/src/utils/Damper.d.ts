/**
 * FPS-independent exponential damping utilities.
 * The time constant `tau` defines how quickly the value approaches the target:
 * higher `tau` → slower response. `dt` is the frame delta time in seconds.
 */
/**
 * Computes the exponential blend factor for a given time step.
 */
export declare function expDecayAlpha(tau: number, dt: number): number;
/**
 * Damp a scalar value toward a target using exponential smoothing.
 */
export declare function damp(current: number, target: number, tau: number, dt: number): number;
//# sourceMappingURL=Damper.d.ts.map