/** Default yaw/pitch rotation speed (radians per pixel). */
export const ROTATE_SPEED = 0.005;
/** Default zoom multiplier applied per wheel step. */
export const ZOOM_SPEED = 0.1;
/** Minimum allowed camera distance. */
export const MIN_DISTANCE = 0.75;
/** Maximum allowed camera distance. */
export const MAX_DISTANCE = 20;
/** Maximum absolute pitch (in radians) away from horizon. */
export const PITCH_LIMIT = Math.PI / 2 - 0.01;
/** Default initial camera distance. */
export const INITIAL_DISTANCE = 3;

/**
 * Current orbit control state expressed in yaw, pitch and distance.
 * - yaw: rotation around the vertical axis (radians)
 * - pitch: rotation around the horizontal axis (radians)
 * - distance: radial distance from the target
 */
export interface OrbitControlsState {
  yaw: number;
  pitch: number;
  distance: number;
}

/** Public API returned by `createOrbitControls`. */
export interface OrbitControls {
  /** Returns the current immutable control state. */
  getState(): OrbitControlsState;
  /** Removes all event listeners and resets cursor changes. */
  cleanup(): void;
  /** Enables or disables camera interaction (used when UI is focused). */
  setEnabled(enabled: boolean): void;
  /** Sets yaw/pitch/distance at once (values are clamped). */
  setState(state: { yaw: number; pitch: number; distance: number }): void;
  /** Applies one of preset camera states. */
  setPreset(state: { yaw: number; pitch: number; distance: number }): void;
}

/** Optional configuration for `createOrbitControls`. */
export interface OrbitControlsConfig {
  /** Multiplier for mouse-move rotation sensitivity. Defaults to `ROTATE_SPEED`. */
  rotateSpeed?: number;
  /** Multiplier for wheel zoom sensitivity. Defaults to `ZOOM_SPEED`. */
  zoomSpeed?: number;
  /** Lower clamp for camera distance. Defaults to `MIN_DISTANCE`. */
  minDistance?: number;
  /** Upper clamp for camera distance. Defaults to `MAX_DISTANCE`. */
  maxDistance?: number;
  /** Maximum absolute pitch angle in radians. Defaults to `PITCH_LIMIT`. */
  pitchLimit?: number;
  /** Starting camera distance. Defaults to `INITIAL_DISTANCE`. */
  initialDistance?: number;
}

/**
 * Creates orbit-style mouse controls for a canvas element.
 *
 * Interactions:
 * - Left mouse drag: adjust yaw and pitch.
 * - Mouse wheel: zoom in/out with clamped distance.
 *
 * Cursor is set to `grab`/`grabbing` while active. Call `cleanup` to remove
 * listeners and restore cursor styles.
 *
 * @param canvas - Target canvas to attach event listeners to.
 * @param config - Optional configuration to override defaults.
 * @returns Public API with `getState` and `cleanup`.
 */
export function createOrbitControls(
  canvas: HTMLCanvasElement,
  config?: OrbitControlsConfig
): OrbitControls {
  const controller = new AbortController();
  const { signal } = controller;
  const rotateSpeed = config?.rotateSpeed ?? ROTATE_SPEED;
  const zoomSpeed = config?.zoomSpeed ?? ZOOM_SPEED;
  const minDistance = config?.minDistance ?? MIN_DISTANCE;
  const maxDistance = config?.maxDistance ?? MAX_DISTANCE;
  const pitchLimit = config?.pitchLimit ?? PITCH_LIMIT;
  const initialDistance = config?.initialDistance ?? INITIAL_DISTANCE;
  let yaw = 0;
  let pitch = 0;
  let distance = initialDistance;
  let isDragging = false;
  let enabled = true;
  let lastX = 0;
  let lastY = 0;
  let activeDragController: AbortController | null = null;

  const updateCursor = () => {
    if (!enabled) {
      canvas.style.cursor = 'not-allowed';
    } else if (isDragging) {
      canvas.style.cursor = 'grabbing';
    } else {
      canvas.style.cursor = 'grab';
    }
  };

  updateCursor();

  const handleMouseDown = (event: MouseEvent) => {
    if (!enabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    updateCursor();

    // Per-drag listeners, cleaned up on mouseup or global cleanup
    const dragController = new AbortController();
    const dragSignal = dragController.signal;
    activeDragController = dragController;
    // Ensure top-level cleanup also aborts any in-flight drag listeners
    signal.addEventListener('abort', () => dragController.abort(), { once: true });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return;
      const dx = moveEvent.clientX - lastX;
      const dy = moveEvent.clientY - lastY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      yaw += dx * rotateSpeed;
      pitch += dy * rotateSpeed;
      if (pitch > pitchLimit) pitch = pitchLimit;
      if (pitch < -pitchLimit) pitch = -pitchLimit;
    };

    const handleMouseUp = () => {
      isDragging = false;
      updateCursor();
      dragController.abort();
      activeDragController = null;
    };

    window.addEventListener('mousemove', handleMouseMove, { signal: dragSignal });
    window.addEventListener('mouseup', handleMouseUp, { signal: dragSignal });
  };

  const handleWheel = (event: WheelEvent) => {
    if (!enabled) return;
    event.preventDefault();
    // Normalize delta across devices/browsers and apply exponential zoom for smoother feel
    const deltaNormalized =
      event.deltaMode === 0 /* DOM_DELTA_PIXEL */ ? (event.deltaY ?? 0) / 100 : (event.deltaY ?? 0);
    const scale = Math.exp((deltaNormalized ?? 0) * (zoomSpeed ?? ZOOM_SPEED) * 0.1);
    distance *= scale;
    if (distance < minDistance) distance = minDistance;
    if (distance > maxDistance) distance = maxDistance;
  };

  canvas.addEventListener('mousedown', handleMouseDown, { signal });
  canvas.addEventListener('wheel', handleWheel, { passive: false, signal });

  const cleanup = () => {
    controller.abort();
    canvas.style.cursor = '';
    isDragging = false;
  };

  const setEnabled = (nextEnabled: boolean) => {
    if (!nextEnabled && isDragging) {
      isDragging = false;
      try {
        activeDragController?.abort();
      } catch {
        // ignore abort errors
      } finally {
        activeDragController = null;
      }
    }
    enabled = nextEnabled;
    updateCursor();
  };

  const setState = (state: { yaw: number; pitch: number; distance: number }) => {
    if (typeof state.yaw === 'number' && Number.isFinite(state.yaw)) {
      yaw = state.yaw;
    }
    if (typeof state.pitch === 'number' && Number.isFinite(state.pitch)) {
      const p = state.pitch;
      pitch = p > pitchLimit ? pitchLimit : p < -pitchLimit ? -pitchLimit : p;
    }
    if (typeof state.distance === 'number' && Number.isFinite(state.distance)) {
      const d = state.distance;
      distance = d < minDistance ? minDistance : d > maxDistance ? maxDistance : d;
    }
    updateCursor();
  };

  const setPreset = (state: { yaw: number; pitch: number; distance: number }) => {
    setState(state);
  };

  return {
    getState: () => ({ yaw, pitch, distance }),
    cleanup,
    setEnabled,
    setState,
    setPreset,
  };
}
