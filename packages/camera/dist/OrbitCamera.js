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
 * OrbitCamera provides orbit-style mouse controls for a canvas element.
 *
 * Interactions:
 * - Left mouse drag: adjust yaw and pitch.
 * - Mouse wheel: zoom in/out with clamped distance.
 *
 * Cursor is set to `grab`/`grabbing` while active. Call `cleanup` to remove
 * listeners and restore cursor styles.
 */
export class OrbitCamera {
    canvas;
    controller;
    rotateSpeed;
    zoomSpeed;
    minDistance;
    maxDistance;
    pitchLimit;
    yaw = 0;
    pitch = 0;
    distance;
    isDragging = false;
    enabled = true;
    lastX = 0;
    lastY = 0;
    activeDragController = null;
    constructor(canvas, config) {
        this.canvas = canvas;
        this.controller = new AbortController();
        this.rotateSpeed = config?.rotateSpeed ?? ROTATE_SPEED;
        this.zoomSpeed = config?.zoomSpeed ?? ZOOM_SPEED;
        this.minDistance = config?.minDistance ?? MIN_DISTANCE;
        this.maxDistance = config?.maxDistance ?? MAX_DISTANCE;
        this.pitchLimit = config?.pitchLimit ?? PITCH_LIMIT;
        this.distance = config?.initialDistance ?? INITIAL_DISTANCE;
        this.setupEventListeners();
        this.updateCursor();
    }
    /**
     * Returns the current immutable control state.
     */
    getState() {
        return { yaw: this.yaw, pitch: this.pitch, distance: this.distance };
    }
    /**
     * Sets yaw/pitch/distance at once (values are clamped).
     */
    setState(state) {
        if (typeof state.yaw === 'number' && Number.isFinite(state.yaw)) {
            this.yaw = state.yaw;
        }
        if (typeof state.pitch === 'number' && Number.isFinite(state.pitch)) {
            const p = state.pitch;
            this.pitch = p > this.pitchLimit ? this.pitchLimit : p < -this.pitchLimit ? -this.pitchLimit : p;
        }
        if (typeof state.distance === 'number' && Number.isFinite(state.distance)) {
            const d = state.distance;
            this.distance = d < this.minDistance ? this.minDistance : d > this.maxDistance ? this.maxDistance : d;
        }
        this.updateCursor();
    }
    /**
     * Applies one of preset camera states.
     */
    setPreset(state) {
        this.setState(state);
    }
    /**
     * Enables or disables camera interaction (used when UI is focused).
     */
    setEnabled(enabled) {
        if (!enabled && this.isDragging) {
            this.isDragging = false;
            try {
                this.activeDragController?.abort();
            }
            catch {
                // ignore abort errors
            }
            finally {
                this.activeDragController = null;
            }
        }
        this.enabled = enabled;
        this.updateCursor();
    }
    /**
     * Removes all event listeners and resets cursor changes.
     */
    cleanup() {
        this.controller.abort();
        this.canvas.style.cursor = '';
        this.isDragging = false;
    }
    updateCursor() {
        if (!this.enabled) {
            this.canvas.style.cursor = 'not-allowed';
        }
        else if (this.isDragging) {
            this.canvas.style.cursor = 'grabbing';
        }
        else {
            this.canvas.style.cursor = 'grab';
        }
    }
    setupEventListeners() {
        const { signal } = this.controller;
        const handleMouseDown = (event) => {
            if (!this.enabled || event.button !== 0)
                return;
            event.preventDefault();
            event.stopPropagation();
            this.isDragging = true;
            this.lastX = event.clientX;
            this.lastY = event.clientY;
            this.updateCursor();
            // Per-drag listeners, cleaned up on mouseup or global cleanup
            const dragController = new AbortController();
            const dragSignal = dragController.signal;
            this.activeDragController = dragController;
            // Ensure top-level cleanup also aborts any in-flight drag listeners
            signal.addEventListener('abort', () => dragController.abort(), { once: true });
            const handleMouseMove = (moveEvent) => {
                if (!this.isDragging)
                    return;
                const dx = moveEvent.clientX - this.lastX;
                const dy = moveEvent.clientY - this.lastY;
                this.lastX = moveEvent.clientX;
                this.lastY = moveEvent.clientY;
                this.yaw += dx * this.rotateSpeed;
                this.pitch += dy * this.rotateSpeed;
                if (this.pitch > this.pitchLimit)
                    this.pitch = this.pitchLimit;
                if (this.pitch < -this.pitchLimit)
                    this.pitch = -this.pitchLimit;
            };
            const handleMouseUp = () => {
                this.isDragging = false;
                this.updateCursor();
                dragController.abort();
                this.activeDragController = null;
            };
            window.addEventListener('mousemove', handleMouseMove, { signal: dragSignal });
            window.addEventListener('mouseup', handleMouseUp, { signal: dragSignal });
        };
        const handleWheel = (event) => {
            if (!this.enabled)
                return;
            event.preventDefault();
            // Normalize delta across devices/browsers and apply exponential zoom for smoother feel
            const deltaNormalized = event.deltaMode === 0 /* DOM_DELTA_PIXEL */ ? (event.deltaY ?? 0) / 100 : (event.deltaY ?? 0);
            const scale = Math.exp((deltaNormalized ?? 0) * (this.zoomSpeed ?? ZOOM_SPEED) * 0.1);
            this.distance *= scale;
            if (this.distance < this.minDistance)
                this.distance = this.minDistance;
            if (this.distance > this.maxDistance)
                this.distance = this.maxDistance;
        };
        this.canvas.addEventListener('mousedown', handleMouseDown, { signal });
        this.canvas.addEventListener('wheel', handleWheel, { passive: false, signal });
    }
}
/**
 * Creates orbit-style mouse controls for a canvas element (backward compatibility function).
 *
 * @param canvas - Target canvas to attach event listeners to.
 * @param config - Optional configuration to override defaults.
 * @returns Public API with `getState` and `cleanup`.
 */
export function createOrbitControls(canvas, config) {
    const camera = new OrbitCamera(canvas, config);
    return {
        getState: () => camera.getState(),
        cleanup: () => camera.cleanup(),
        setEnabled: (enabled) => camera.setEnabled(enabled),
        setState: (state) => camera.setState(state),
        setPreset: (state) => camera.setPreset(state),
    };
}
//# sourceMappingURL=OrbitCamera.js.map