/**
 * FPS-independent exponential damping utilities.
 * The time constant `tau` defines how quickly the value approaches the target:
 * higher `tau` → slower response. `dt` is the frame delta time in seconds.
 */

/** Minimum positive tau to avoid division by zero and preserve stability */
const MIN_TAU = 1e-5;

/**
 * Computes the exponential blend factor for a given time step.
 */
export function expDecayAlpha(tau: number, dt: number): number {
  const safeTau = Math.max(MIN_TAU, Number.isFinite(tau) ? tau : MIN_TAU);
  const safeDt = Math.max(0, Number.isFinite(dt) ? dt : 0);
  // 1 - e^(-dt/tau)
  const alpha = 1 - Math.exp(-safeDt / safeTau);
  // Numerical guard
  return alpha > 1 ? 1 : alpha < 0 ? 0 : alpha;
}

/**
 * Damp a scalar value toward a target using exponential smoothing.
 */
export function damp(current: number, target: number, tau: number, dt: number): number {
  const a = expDecayAlpha(tau, dt);
  return current + (target - current) * a;
}


