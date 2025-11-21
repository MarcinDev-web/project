import { damp } from './utils/Damper';

/** Default yaw/pitch rotation speed (radians per pixel). */
export const ROTATE_SPEED = 0.005;
/** Default zoom multiplier applied per wheel step. */
export const ZOOM_SPEED = 0.1;
/** Default exponential zoom multiplier for smooth zoom feel. */
export const ZOOM_MULTIPLIER = 0.4;
/** Minimum allowed camera distance. */
export const MIN_DISTANCE = 0.75;
/** Maximum allowed camera distance. */
export const MAX_DISTANCE = 100;
/** Maximum absolute pitch (in radians) away from horizon. */
export const PITCH_LIMIT = Math.PI / 2 - 0.01;
/** Default initial camera distance. */
export const INITIAL_DISTANCE = 40;
/** Default damping time constant (tau). Higher = smoother/slower. */
export const DEFAULT_DAMPING = 0.1;

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

/** Optional configuration for OrbitCamera. */
export interface OrbitControlsConfig {
  /** Multiplier for mouse-move rotation sensitivity. Defaults to `ROTATE_SPEED`. */
  rotateSpeed?: number;
  /** Multiplier for wheel zoom sensitivity. Defaults to `ZOOM_SPEED`. */
  zoomSpeed?: number;
  /** Exponential zoom multiplier for smooth zoom feel. Defaults to `ZOOM_MULTIPLIER`. */
  zoomMultiplier?: number;
  /** Lower clamp for camera distance. Defaults to `MIN_DISTANCE`. */
  minDistance?: number;
  /** Upper clamp for camera distance. Defaults to `MAX_DISTANCE`. */
  maxDistance?: number;
  /** Maximum absolute pitch angle in radians. Defaults to `PITCH_LIMIT`. */
  pitchLimit?: number;
  /** Starting camera distance. Defaults to `INITIAL_DISTANCE`. */
  initialDistance?: number;
  /** Damping time constant (tau). Set 0 to disable. Defaults to `DEFAULT_DAMPING` (0.1). */
  damping?: number;
}

/**
 * OrbitCamera provides orbit-style mouse controls for a canvas element.
 *
 * Interactions:
 * - Left mouse/touch drag: adjust yaw and pitch.
 * - Mouse wheel: zoom in/out with clamped distance.
 *
 * Features:
 * - Smooth damping (inertia)
 * - Touch support (Pointer Events)
 * - Zero-allocation update loop
 */
export class OrbitCamera {
  private readonly canvas: HTMLCanvasElement;
  private readonly controller: AbortController;
  private readonly rotateSpeed: number;
  private readonly zoomSpeed: number;
  private readonly zoomMultiplier: number;
  private readonly minDistance: number;
  private readonly maxDistance: number;
  private readonly pitchLimit: number;
  private readonly dampingTau: number;

  // Current smoothed state (for rendering)
  private yaw = 0;
  private pitch = 0;
  private distance: number;

  // Target state (from input)
  private targetYaw = 0;
  private targetPitch = 0;
  private targetDistance: number;

  private isDragging = false;
  private enabled = true;
  private lastX = 0;
  private lastY = 0;
  private activeDragController: AbortController | null = null;

  // Time tracking for auto-update compatibility
  private lastFrameTime = 0;

  constructor(canvas: HTMLCanvasElement, config?: OrbitControlsConfig) {
    this.canvas = canvas;
    this.controller = new AbortController();
    this.rotateSpeed = config?.rotateSpeed ?? ROTATE_SPEED;
    this.zoomSpeed = config?.zoomSpeed ?? ZOOM_SPEED;
    this.zoomMultiplier = config?.zoomMultiplier ?? ZOOM_MULTIPLIER;
    this.minDistance = config?.minDistance ?? MIN_DISTANCE;
    this.maxDistance = config?.maxDistance ?? MAX_DISTANCE;
    this.pitchLimit = config?.pitchLimit ?? PITCH_LIMIT;
    this.dampingTau = config?.damping ?? DEFAULT_DAMPING;

    const initialDist = config?.initialDistance ?? INITIAL_DISTANCE;
    this.distance = this.targetDistance = initialDist;
    // Initial yaw/pitch are 0
    this.yaw = this.targetYaw = 0;
    this.pitch = this.targetPitch = 0;

    this.setupEventListeners();
    this.updateCursor();
    this.lastFrameTime = performance.now();
  }

  /**
   * Returns the current smoothed control state.
   *
   * @deprecated usage: For smoother animations, prefer calling `update(dt)` explicitly in your loop.
   * This method contains an auto-update mechanism for backward compatibility.
   */
  getState(): OrbitControlsState {
    // Compatibility hack: if update() isn't being called manually,
    // we try to infer a delta time and update internal state.
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    if (dt > 0) {
      // Cap dt to avoid huge jumps if the tab was backgrounded
      const safeDt = dt > 0.1 ? 0.1 : dt;
      this.update(safeDt);
    }
    // Note: update() updates lastFrameTime, so the next call to getState
    // in the same frame will have dt ~ 0 and essentially be a no-op, which is correct.

    return { yaw: this.yaw, pitch: this.pitch, distance: this.distance };
  }

  /**
   * Explicitly updates the camera physics.
   * Call this once per frame with the delta time in seconds.
   */
  update(dt: number): void {
    this.lastFrameTime = performance.now();

    if (this.dampingTau > 0) {
      this.yaw = damp(this.yaw, this.targetYaw, this.dampingTau, dt);
      this.pitch = damp(this.pitch, this.targetPitch, this.dampingTau, dt);
      this.distance = damp(this.distance, this.targetDistance, this.dampingTau, dt);
    } else {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.distance = this.targetDistance;
    }
  }

  /**
   * Sets yaw/pitch/distance immediately (bypassing smoothing).
   */
  setState(state: Partial<OrbitControlsState>): void {
    if (typeof state.yaw === 'number' && Number.isFinite(state.yaw)) {
      this.yaw = this.targetYaw = state.yaw;
    }
    if (typeof state.pitch === 'number' && Number.isFinite(state.pitch)) {
      const p = state.pitch;
      const clamped = p > this.pitchLimit ? this.pitchLimit : p < -this.pitchLimit ? -this.pitchLimit : p;
      this.pitch = this.targetPitch = clamped;
    }
    if (typeof state.distance === 'number' && Number.isFinite(state.distance)) {
      const d = state.distance;
      const clamped = d < this.minDistance ? this.minDistance : d > this.maxDistance ? this.maxDistance : d;
      this.distance = this.targetDistance = clamped;
    }
    this.updateCursor();
  }

  /**
   * Applies one of preset camera states.
   * Alias for `setState()` - provided for semantic clarity when setting preset views.
   */
  setPreset(state: Partial<OrbitControlsState>): void {
    this.setState(state);
  }

  /**
   * Enables or disables camera interaction (used when UI is focused).
   */
  setEnabled(enabled: boolean): void {
    if (!enabled && this.isDragging) {
      this.isDragging = false;
      try {
        this.activeDragController?.abort();
      } catch {
        // ignore abort errors
      } finally {
        this.activeDragController = null;
      }
    }
    this.enabled = enabled;
    this.updateCursor();
  }

  /**
   * Removes all event listeners and resets cursor changes.
   */
  cleanup(): void {
    this.dispose();
  }

  /**
   * Disposes resources and event listeners.
   */
  dispose(): void {
    this.controller.abort();
    this.canvas.style.cursor = '';
    this.isDragging = false;
  }

  private updateCursor(): void {
    if (!this.enabled) {
      this.canvas.style.cursor = 'not-allowed';
    } else if (this.isDragging) {
      this.canvas.style.cursor = 'grabbing';
    } else {
      this.canvas.style.cursor = 'grab';
    }
  }

  private setupEventListeners(): void {
    const { signal } = this.controller;

    // Use Pointer Events for unified Mouse/Touch support
    const handlePointerDown = (event: PointerEvent) => {
      if (!this.enabled || !event.isPrimary || event.button !== 0) return;

      this.canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();

      this.isDragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.updateCursor();

      // Per-drag listeners
      const dragController = new AbortController();
      const dragSignal = dragController.signal;
      this.activeDragController = dragController;

      // Ensure top-level cleanup also aborts any in-flight drag listeners
      signal.addEventListener('abort', () => dragController.abort(), { once: true });

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!this.isDragging) return;
        // Prevent scrolling on mobile
        moveEvent.preventDefault();

        const dx = moveEvent.clientX - this.lastX;
        const dy = moveEvent.clientY - this.lastY;
        this.lastX = moveEvent.clientX;
        this.lastY = moveEvent.clientY;

        // Update TARGETS, not current state
        this.targetYaw += dx * this.rotateSpeed;
        this.targetPitch += dy * this.rotateSpeed;

        // Clamp target pitch
        if (this.targetPitch > this.pitchLimit) this.targetPitch = this.pitchLimit;
        if (this.targetPitch < -this.pitchLimit) this.targetPitch = -this.pitchLimit;
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        this.isDragging = false;
        this.canvas.releasePointerCapture(upEvent.pointerId);
        this.updateCursor();
        dragController.abort();
        this.activeDragController = null;
      };

      window.addEventListener('pointermove', handlePointerMove, { signal: dragSignal });
      window.addEventListener('pointerup', handlePointerUp, { signal: dragSignal });
      // Also handle cancel (e.g. alt-tab)
      window.addEventListener('pointercancel', handlePointerUp, { signal: dragSignal });
    };

    const handleWheel = (event: WheelEvent) => {
      if (!this.enabled) return;
      event.preventDefault();
      // Normalize delta across devices/browsers and apply exponential zoom for smoother feel
      const deltaNormalized =
        event.deltaMode === 0 /* DOM_DELTA_PIXEL */ ? (event.deltaY ?? 0) / 50 : (event.deltaY ?? 0);

      const scale = Math.exp((deltaNormalized ?? 0) * (this.zoomSpeed ?? ZOOM_SPEED) * this.zoomMultiplier);

      // Update TARGET distance
      this.targetDistance *= scale;

      // Clamp target distance
      if (this.targetDistance < this.minDistance) this.targetDistance = this.minDistance;
      if (this.targetDistance > this.maxDistance) this.targetDistance = this.maxDistance;
    };

    this.canvas.addEventListener('pointerdown', handlePointerDown, { signal });
    this.canvas.addEventListener('wheel', handleWheel, { passive: false, signal });
    // Disable context menu to allow right-click usage in future if needed
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
  }
}

/**
 * Public API for backward compatibility with createOrbitControls function
 */
export interface OrbitControls {
  /** Returns the current immutable control state. Auto-updates if called in a loop. */
  getState(): OrbitControlsState;
  /** Removes all event listeners and resets cursor changes. */
  cleanup(): void;
  /** Enables or disables camera interaction (used when UI is focused). */
  setEnabled(enabled: boolean): void;
  /** Sets yaw/pitch/distance at once (values are clamped). */
  setState(state: Partial<OrbitControlsState>): void;
  /** Applies one of preset camera states. */
  setPreset(state: Partial<OrbitControlsState>): void;
}

/**
 * Creates orbit-style mouse controls for a canvas element (backward compatibility function).
 *
 * @param canvas - Target canvas to attach event listeners to.
 * @param config - Optional configuration to override defaults.
 * @returns Public API with `getState` and `cleanup`.
 */
export function createOrbitControls(
  canvas: HTMLCanvasElement,
  config?: OrbitControlsConfig
): OrbitControls {
  const camera = new OrbitCamera(canvas, config);
  return {
    getState: () => camera.getState(),
    cleanup: () => camera.cleanup(),
    setEnabled: (enabled: boolean) => camera.setEnabled(enabled),
    setState: (state) => camera.setState(state),
    setPreset: (state) => camera.setPreset(state),
  };
}
