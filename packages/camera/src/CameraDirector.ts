import type { Mat4, Vec3 } from '@engine/core/math';
import { mat4LookAt, mat4Perspective, mat4Invert, mat4FromQuatTranslation, mat4GetTranslationOut, mat4GetRotationOut, lerpVec3Out, quatSlerpOut } from '@engine/core/math';
import type { Scene } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { OrbitControls } from './OrbitCamera';
import type { FPSCamera } from './FPSCamera';
import type { EditorCameraController } from './EditorCameraController';
import type { ThirdPersonCamera } from './ThirdPersonCamera';
import type { IFPSCameraCollisionProvider } from './types';
import { FPSRaycastCollision } from './collision/FPSRaycastCollision';

// Default rendering config constants
const FOV_RADIANS = (2 * Math.PI) / 5;
const Z_NEAR = 0.1;
const Z_FAR = 10000;

/**
 * Camera mode types
 */
export type CameraMode = 'orbit' | 'fps' | 'third-person' | 'free-fly';

/**
 * Camera blend state
 */
interface CameraBlend {
  active: boolean;
  fromMode: CameraMode;
  toMode: CameraMode;
  duration: number;
  elapsed: number;
  fromView: Mat4;
  fromProjection: Mat4;
}

/**
 * Camera configuration for each mode
 */
export interface CameraDirectorConfig {
  orbitControls: OrbitControls;
  fpsCamera: FPSCamera | null;
  editorCamera: EditorCameraController | null;
  thirdPersonCamera?: ThirdPersonCamera | null;
  canvas: HTMLCanvasElement;
  scene?: Scene;
  physicsWorld?: PhysicsWorld | null;
  fpsCollisionProvider?: IFPSCameraCollisionProvider;
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
}

/**
 * CameraDirector manages camera modes and smooth transitions
 * 
 * Responsibilities:
 * - Switch between orbit, FPS, and follow cameras
 * - Blend smoothly between camera modes
 * - Generate view and projection matrices
 * - Centralized camera state management
 */
export class CameraDirector {
  private currentMode: CameraMode = 'free-fly'; // Free-fly is the default editor camera
  private blend: CameraBlend | null = null;
  
  private readonly orbitControls: OrbitControls;
  private readonly fpsCamera: FPSCamera | null;
  private readonly editorCamera: EditorCameraController | null;
  private readonly thirdPersonCamera: ThirdPersonCamera | null;
  private readonly canvas: HTMLCanvasElement;
  private readonly physicsWorld: PhysicsWorld | null;
  
  private currentFov: number = FOV_RADIANS;
  private cameraOffset: Vec3 = [0, 0, 0];
  private collisionRadius = 0.3;
  
  // Current matrices
  private readonly viewMatrix: Mat4;
  private readonly projectionMatrix: Mat4;
  
  // Scratch buffers for blend operations (to avoid allocations in hot path)
  private readonly blendScratch = {
    fromView: new Float32Array(16) as Mat4,
    fromProjection: new Float32Array(16) as Mat4,
    targetView: new Float32Array(16) as Mat4,
    fromWorld: new Float32Array(16) as Mat4,
    toWorld: new Float32Array(16) as Mat4,
    blendedWorld: new Float32Array(16) as Mat4,
    fromPos: new Float32Array(3) as unknown as Vec3,
    toPos: new Float32Array(3) as unknown as Vec3,
    blendedPos: new Float32Array(3) as unknown as Vec3,
    fromRot: new Float32Array(4) as unknown as [number, number, number, number],
    toRot: new Float32Array(4) as unknown as [number, number, number, number],
    blendedRot: new Float32Array(4) as unknown as [number, number, number, number],
  };
  
  // Player pose for FPS/third-person modes (injected from outside)
  private playerPosition: Vec3 | null = null;
  private playerForward: Vec3 | null = null;
  
  // Logger for debugging
  private logger: CameraDirectorConfig['logger'];

  constructor(config: CameraDirectorConfig) {
    this.orbitControls = config.orbitControls;
    this.fpsCamera = config.fpsCamera;
    this.editorCamera = config.editorCamera;
    this.thirdPersonCamera = config.thirdPersonCamera ?? null;
    this.canvas = config.canvas;
    this.physicsWorld = config.physicsWorld ?? null;
    
    this.logger = config.logger ?? {
      debug: console.debug,
      warn: console.warn,
    };
    
    this.viewMatrix = new Float32Array(16) as Mat4;
    this.projectionMatrix = new Float32Array(16) as Mat4;

    // Initialize matrices so callers can query immediately after construction
    this.updateCameraState();
    
    // Enable the default camera mode (free-fly for editor)
    this.enableCameraForMode(this.currentMode);

    // Setup collision detection for FPS camera
    if (this.fpsCamera) {
      if (config.fpsCollisionProvider) {
        // Use injected provider
        this.fpsCamera.setCollisionProvider(config.fpsCollisionProvider);
        this.fpsCamera.setCollisionEnabled(true);
      } else if (this.physicsWorld) {
        // Default to internal raycast provider for backward compatibility
        const collisionProvider = new FPSRaycastCollision({
          physics: this.physicsWorld,
          radius: this.collisionRadius,
          backoff: 0.03,
          maxIters: 2,
          sampleCount: 6,
        });
        this.fpsCamera.setCollisionProvider(collisionProvider);
        this.fpsCamera.setCollisionEnabled(true);
      }
    }
  }

  /**
   * Set the current camera mode (instant switch, no blend)
   */
  setMode(mode: CameraMode): void {
    if (this.currentMode === mode) {
      return;
    }

    this.logger?.debug(`Camera mode: ${this.currentMode} -> ${mode}`);
    
    // Disable previous mode's camera
    this.disableCameraForMode(this.currentMode, mode);
    
    this.currentMode = mode;
    this.blend = null;
    
    // Enable new mode's camera
    this.enableCameraForMode(this.currentMode);
    
    this.logger?.debug(`Mode switched to: ${mode}, editorCamera enabled: ${this.editorCamera?.isEnabled()}`);
    
    this.updateCameraState();
  }

  /**
   * Blend from current mode to target mode over duration
   */
  startBlend(toMode: CameraMode, duration: number = 0.5): void {
    if (this.currentMode === toMode) {
      return;
    }

    // Treat non-positive durations as an instant switch (no blend)
    if (duration <= 0) {
      this.logger?.debug(`Camera instant switch: ${this.currentMode} -> ${toMode}`);
      this.currentMode = toMode;
      this.blend = null;
      this.updateCameraState();
      return;
    }

    this.logger?.debug(`Camera blend: ${this.currentMode} -> ${toMode} (${duration}s)`);
    
    // Capture current matrices for blending (using scratch buffers to avoid allocations)
    this.blendScratch.fromView.set(this.viewMatrix);
    this.blendScratch.fromProjection.set(this.projectionMatrix);
    
    // Create new blend state with copies of scratch buffers
    this.blend = {
      active: true,
      fromMode: this.currentMode,
      toMode: toMode,
      duration,
      elapsed: 0,
      fromView: new Float32Array(this.blendScratch.fromView) as Mat4,
      fromProjection: new Float32Array(this.blendScratch.fromProjection) as Mat4,
    };
    
    this.currentMode = toMode;
  }

  /**
   * Get current camera mode
   */
  getMode(): CameraMode {
    return this.currentMode;
  }

  /**
   * Update camera state and blending
   */
  update(deltaTime: number): void {
    // Update blend if active
    if (this.blend) {
      this.blend.elapsed += deltaTime;
      
      if (this.blend.elapsed >= this.blend.duration) {
        // Blend complete
        this.blend = null;
      }
    }
    
    // Update free-fly camera if active
    if (this.currentMode === 'free-fly') {
      if (this.editorCamera) {
        this.editorCamera.update(deltaTime);
      } else {
        this.logger?.warn('free-fly mode but editorCamera is null!');
      }
    }
    
    // Update FPS camera if active
    if (this.currentMode === 'fps') {
      if (this.fpsCamera) {
        this.fpsCamera.update(deltaTime);
      } else {
        this.logger?.warn('fps mode but fpsCamera is null!');
      }
    }
    
    // Update third-person camera if active
    if (this.currentMode === 'third-person') {
      if (this.thirdPersonCamera && this.playerPosition) {
        const forward = this.playerForward ?? [0, 0, -1];
        this.thirdPersonCamera.update(this.playerPosition, forward, deltaTime);
      } else {
        if (!this.thirdPersonCamera) {
          this.logger?.warn('third-person mode but thirdPersonCamera is null!');
        }
      }
    }
    
    this.updateCameraState();
  }

  /**
   * Get the active view matrix
   */
  getViewMatrix(): Mat4 {
    if (this.blend && this.blend.active) {
      // Return blended view matrix using position/rotation decomposition
      // Using scratch buffers to avoid allocations in hot path
      const duration = this.blend.duration > 0 ? this.blend.duration : 1e-6;
      const t = Math.min(this.blend.elapsed / duration, 1.0);
      const smoothT = this.smoothstep(t);

      // Compute target view matrix for the current mode (into scratch buffer)
      this.computeViewMatrix(this.currentMode, this.blendScratch.targetView);

      // Convert both views to camera world transforms (using scratch buffers)
      mat4Invert(this.blendScratch.fromWorld, this.blend.fromView);
      mat4Invert(this.blendScratch.toWorld, this.blendScratch.targetView);

      // Extract positions and rotations (into scratch buffers)
      mat4GetTranslationOut(this.blendScratch.fromPos, this.blendScratch.fromWorld);
      mat4GetTranslationOut(this.blendScratch.toPos, this.blendScratch.toWorld);
      lerpVec3Out(this.blendScratch.blendedPos, this.blendScratch.fromPos, this.blendScratch.toPos, smoothT);

      // Initialize rotations (quaternions)
      this.blendScratch.fromRot[0] = 0;
      this.blendScratch.fromRot[1] = 0;
      this.blendScratch.fromRot[2] = 0;
      this.blendScratch.fromRot[3] = 1;
      this.blendScratch.toRot[0] = 0;
      this.blendScratch.toRot[1] = 0;
      this.blendScratch.toRot[2] = 0;
      this.blendScratch.toRot[3] = 1;
      
      mat4GetRotationOut(this.blendScratch.fromRot, this.blendScratch.fromWorld);
      mat4GetRotationOut(this.blendScratch.toRot, this.blendScratch.toWorld);
      quatSlerpOut(this.blendScratch.blendedRot, this.blendScratch.fromRot, this.blendScratch.toRot, smoothT);

      // Recompose camera world transform, then invert to view (using scratch buffers)
      mat4FromQuatTranslation(this.blendScratch.blendedWorld, this.blendScratch.blendedRot, this.blendScratch.blendedPos);
      mat4Invert(this.viewMatrix, this.blendScratch.blendedWorld);
      return this.viewMatrix;
    }
    
    return this.viewMatrix;
  }

  /**
   * Get the active projection matrix
   */
  getProjectionMatrix(): Mat4 {
    return this.projectionMatrix;
  }

  /**
   * Get the current camera world position.
   * Optionally provide an output Vec3 to avoid allocations.
   */
  getPosition(out?: Vec3): Vec3 {
    const target = out ?? (new Float32Array(3) as unknown as Vec3);

    if (this.blend && this.blend.active) {
      // Derive the camera position from the blended view matrix
      mat4Invert(this.blendScratch.fromWorld, this.getViewMatrix());
      mat4GetTranslationOut(target, this.blendScratch.fromWorld);
      return target;
    }

    return this.computeCameraPosition(this.currentMode, target);
  }

  setFov(radians: number): void {
    if (!Number.isFinite(radians) || radians <= 0) {
      return;
    }
    this.currentFov = radians;
    this.updateCameraState();
  }

  setCameraOffset(offset: Vec3): void {
    this.cameraOffset = [...offset] as Vec3;
  }

  setCollisionRadius(radius: number): void {
    if (radius > 0) {
      this.collisionRadius = radius;
    }
  }

  /**
   * Set player position for FPS/third-person camera modes (legacy helper)
   */
  setPlayerPosition(position: Vec3): void {
    this.setPlayerPose(position);
  }

  /**
   * Set full player pose for camera modes
   */
  setPlayerPose(position: Vec3, forward?: Vec3): void {
    this.playerPosition = [...position] as Vec3;
    if (forward) {
      this.playerForward = this.normalizeVector(forward);
    }
  }

  /**
   * Update player forward direction independently
   */
  setPlayerForward(forward: Vec3): void {
    this.playerForward = this.normalizeVector(forward);
  }

  /**
   * Get player position
   */
  getPlayerPosition(): Vec3 | null {
    return this.playerPosition ? [...this.playerPosition] as Vec3 : null;
  }

  /**
   * Get player forward direction if available
   */
  getPlayerForward(): Vec3 | null {
    return this.playerForward ? [...this.playerForward] as Vec3 : null;
  }

  /**
   * Check if currently blending
   */
  isBlending(): boolean {
    return this.blend !== null && this.blend.active;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.blend = null;
    this.playerPosition = null;
    this.playerForward = null;
    
    // Cleanup ALL cameras consistently
    this.orbitControls?.cleanup?.();
    this.fpsCamera?.dispose?.();
    this.editorCamera?.dispose?.();
    this.thirdPersonCamera?.dispose?.();
  }

  private normalizeVector(vec: Vec3): Vec3 {
    const length = Math.hypot(vec[0], vec[1], vec[2]) || 1;
    return [vec[0] / length, vec[1] / length, vec[2] / length];
  }
  
  /**
   * Enable camera for a specific mode
   */
  private enableCameraForMode(mode: CameraMode): void {
    this.logger?.debug(`Enabling camera for mode: ${mode}`);
    switch (mode) {
      case 'orbit': {
        this.orbitControls.setEnabled(true);
        if (this.editorCamera && !this.editorCamera.isEnabled()) {
          this.editorCamera.enable();
          this.logger?.debug('EditorCamera enabled for orbit mode');
        }
        this.logger?.debug('Orbit controls enabled');
        break;
      }
      case 'fps': {
        // FPS camera is enabled by play mode
        if (this.fpsCamera) {
          this.fpsCamera.enable();
          this.logger?.debug('FPS camera enabled');
        }
        break;
      }
      case 'third-person': {
        if (this.thirdPersonCamera) {
          this.thirdPersonCamera.enable();
          this.logger?.debug('Third person camera enabled');
        }
        break;
      }
      case 'free-fly': {
        if (this.editorCamera) {
          this.editorCamera.enable();
          this.logger?.debug('EditorCamera enabled');
        } else {
          this.logger?.warn('EditorCamera is null!');
        }
        this.orbitControls.setEnabled(false);
        this.logger?.debug('Orbit controls disabled');
        break;
      }
    }
  }

  /**
   * Disable camera for a specific mode
   */
  private disableCameraForMode(mode: CameraMode, nextMode?: CameraMode): void {
    switch (mode) {
      case 'orbit':
        this.orbitControls.setEnabled(false);
        break;
      case 'fps':
        // FPS camera is disabled by play mode
        break;
      case 'third-person':
        if (this.thirdPersonCamera) {
          this.thirdPersonCamera.disable();
        }
        break;
      case 'free-fly':
        if (nextMode === 'orbit') {
          break;
        }
        if (this.editorCamera) {
          this.editorCamera.disable();
        }
        break;
    }
  }

  /**
   * Update internal camera state based on current mode
   */
  private updateCameraState(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const aspect = width > 0 && height > 0 ? (width / height) : 1;
    
    // Get FOV from active camera (FPSCamera manages its own FOV, others use currentFov)
    let activeFov = this.currentFov;
    if (this.currentMode === 'fps' && this.fpsCamera) {
      // Use FOV from FPSCamera if available
      activeFov = this.fpsCamera.getFov();
    }
    
    // Update projection matrix
    mat4Perspective(this.projectionMatrix, activeFov, aspect, Z_NEAR, Z_FAR);
    
    // Update view matrix based on mode (if not blending)
    if (!this.blend) {
      this.computeViewMatrix(this.currentMode, this.viewMatrix);
    }
  }

  private computeCameraPosition(mode: CameraMode, out: Vec3): Vec3 {
    switch (mode) {
      case 'orbit':
        return this.computeOrbitCameraPosition(out);
      case 'free-fly':
        if (this.editorCamera) {
          return this.copyVec3(this.editorCamera.getPosition(), out);
        }
        return this.computeOrbitCameraPosition(out);
      case 'fps':
        if (this.fpsCamera && this.playerPosition) {
          out[0] = this.playerPosition[0] + this.cameraOffset[0];
          out[1] = this.playerPosition[1] + this.cameraOffset[1];
          out[2] = this.playerPosition[2] + this.cameraOffset[2];
          // Collision is handled by FPSCamera provider now, no need for manual resolve here
          return out;
        }
        return this.computeOrbitCameraPosition(out);
      case 'third-person':
        if (this.thirdPersonCamera) {
          return this.copyVec3(this.thirdPersonCamera.getPosition(), out);
        }
        return this.computeOrbitCameraPosition(out);
      default:
        return this.computeOrbitCameraPosition(out);
    }
  }

  private computeOrbitCameraPosition(out: Vec3): Vec3 {
    const { yaw, pitch, distance } = this.orbitControls.getState();
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    out[0] = cosPitch * Math.sin(yaw) * distance;
    out[1] = sinPitch * distance;
    out[2] = cosPitch * Math.cos(yaw) * distance;
    return out;
  }

  private copyVec3(source: Vec3, target: Vec3): Vec3 {
    target[0] = source[0];
    target[1] = source[1];
    target[2] = source[2];
    return target;
  }

  /**
   * Compute view matrix for a specific mode
   */
  private computeViewMatrix(mode: CameraMode, outMatrix: Mat4): void {
    switch (mode) {
      case 'orbit': {
        const { yaw, pitch, distance } = this.orbitControls.getState();
        const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
        const eyeY = Math.sin(pitch) * distance;
        const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
        mat4LookAt(outMatrix, [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);
        break;
      }
      
      case 'fps': {
        if (this.fpsCamera) {
          let desiredCameraPosition: Vec3;

          if (this.playerPosition) {
            desiredCameraPosition = [
              this.playerPosition[0] + this.cameraOffset[0],
              this.playerPosition[1] + this.cameraOffset[1],
              this.playerPosition[2] + this.cameraOffset[2],
            ] as Vec3;
          } else {
            // Edit mode: calculate position from orbit controls
            const { yaw, pitch, distance } = this.orbitControls.getState();
            const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
            const eyeY = Math.sin(pitch) * distance;
            const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
            desiredCameraPosition = [eyeX, eyeY, eyeZ] as Vec3;
          }

          const resolvedCameraPosition = desiredCameraPosition;
          const eyeHeight = this.fpsCamera.getEyeHeight();
          const basePosition: Vec3 = [
            resolvedCameraPosition[0],
            resolvedCameraPosition[1] - eyeHeight,
            resolvedCameraPosition[2],
          ] as Vec3;

          const fpsView = this.fpsCamera.getViewMatrix(basePosition);
          outMatrix.set(fpsView);
        } else {
          // Fallback to orbit if FPS camera not available
          this.computeViewMatrix('orbit', outMatrix);
        }
        break;
      }
      
      case 'third-person': {
        if (this.thirdPersonCamera && this.playerPosition) {
          const view = this.thirdPersonCamera.getViewMatrix(this.playerPosition);
          outMatrix.set(view);
        } else {
          // Fallback to orbit if third person camera not available
          this.computeViewMatrix('orbit', outMatrix);
        }
        break;
      }
      
      case 'free-fly': {
        if (this.editorCamera) {
          const view = this.editorCamera.getViewMatrix();
          outMatrix.set(view);
        } else {
          // Fallback to orbit if editor camera not available
          this.computeViewMatrix('orbit', outMatrix);
        }
        break;
      }
      
      default: {
        this.logger?.warn(`Unknown camera mode: ${mode}`);
        this.computeViewMatrix('orbit', outMatrix);
      }
    }
  }

  /**
   * Smooth interpolation function (ease-in-out)
   * TODO: Move to @engine/core/math if used elsewhere
   */
  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
