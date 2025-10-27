import type { Mat4, Vec3 } from '@engine/core/math';
import { mat4LookAt, mat4Perspective, mat4Invert, mat4FromQuatTranslation, mat4GetTranslationOut, mat4GetRotationOut, lerpVec3Out, quatSlerpOut } from '@engine/core/math';
import type { Scene } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { OrbitControls } from './OrbitCamera';
import type { FPSCamera } from './FPSCamera';
import type { EditorCameraController } from './EditorCameraController';
import type { ThirdPersonCamera } from './ThirdPersonCamera';

// Default rendering config constants
const FOV_RADIANS = (2 * Math.PI) / 5;
const Z_NEAR = 0.1;
const Z_FAR = 100;

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
  private readonly scene: Scene | null;
  private readonly physicsWorld: PhysicsWorld | null;
  
  private currentFov: number = FOV_RADIANS;
  private cameraOffset: Vec3 = [0, 0, 0];
  private collisionRadius = 0.3;
  
  // Current matrices
  private readonly viewMatrix: Mat4;
  private readonly projectionMatrix: Mat4;
  
  // Player position for FPS mode (injected from outside)
  private playerPosition: Vec3 | null = null;
  
  // Logger for debugging
  private logger: CameraDirectorConfig['logger'];

  constructor(config: CameraDirectorConfig) {
    this.orbitControls = config.orbitControls;
    this.fpsCamera = config.fpsCamera;
    this.editorCamera = config.editorCamera;
    this.thirdPersonCamera = config.thirdPersonCamera ?? null;
    this.canvas = config.canvas;
    this.scene = config.scene ?? null;
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
  }

  /**
   * Set the current camera mode (instant switch, no blend)
   */
  setMode(mode: CameraMode): void {
    if (this.currentMode === mode) {
      return;
    }

    console.log(`[CameraDirector] Camera mode: ${this.currentMode} → ${mode}`);
    
    // Disable previous mode's camera
    this.disableCameraForMode(this.currentMode);
    
    this.currentMode = mode;
    this.blend = null;
    
    // Enable new mode's camera
    this.enableCameraForMode(this.currentMode);
    
    console.log(`[CameraDirector] Mode switched to: ${mode}, editorCamera enabled: ${this.editorCamera?.isEnabled()}`);
    
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
      this.logger?.debug(`Camera instant switch: ${this.currentMode} → ${toMode}`);
      this.currentMode = toMode;
      this.blend = null;
      this.updateCameraState();
      return;
    }

    this.logger?.debug(`Camera blend: ${this.currentMode} → ${toMode} (${duration}s)`);
    
    // Capture current matrices for blending
    const fromView = new Float32Array(16) as Mat4;
    const fromProjection = new Float32Array(16) as Mat4;
    fromView.set(this.viewMatrix);
    fromProjection.set(this.projectionMatrix);
    
    this.blend = {
      active: true,
      fromMode: this.currentMode,
      toMode: toMode,
      duration,
      elapsed: 0,
      fromView,
      fromProjection,
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
        console.warn('[CameraDirector] free-fly mode but editorCamera is null!');
      }
    }
    
    // Update third-person camera if active
    if (this.currentMode === 'third-person') {
      if (this.thirdPersonCamera && this.playerPosition) {
        // Get player forward direction (simplified: use yaw from player rotation)
        const playerForward: Vec3 = [0, 0, -1]; // Default forward, could be enhanced
        this.thirdPersonCamera.update(this.playerPosition, playerForward, deltaTime);
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
      const duration = this.blend.duration > 0 ? this.blend.duration : 1e-6;
      const t = Math.min(this.blend.elapsed / duration, 1.0);
      const smoothT = this.smoothstep(t);

      // Compute target view matrix for the current mode
      const targetView = new Float32Array(16) as Mat4;
      this.computeViewMatrix(this.currentMode, targetView);

      // Convert both views to camera world transforms
      const fromWorld = new Float32Array(16) as Mat4;
      const toWorld = new Float32Array(16) as Mat4;
      mat4Invert(fromWorld, this.blend.fromView);
      mat4Invert(toWorld, targetView);

      // Extract positions and rotations
      const fromPos: Vec3 = [0, 0, 0];
      const toPos: Vec3 = [0, 0, 0];
      const blendedPos: Vec3 = [0, 0, 0];
      mat4GetTranslationOut(fromPos, fromWorld);
      mat4GetTranslationOut(toPos, toWorld);
      lerpVec3Out(blendedPos, fromPos, toPos, smoothT);

      const fromRot: [number, number, number, number] = [0, 0, 0, 1];
      const toRot: [number, number, number, number] = [0, 0, 0, 1];
      const blendedRot: [number, number, number, number] = [0, 0, 0, 1];
      mat4GetRotationOut(fromRot, fromWorld);
      mat4GetRotationOut(toRot, toWorld);
      quatSlerpOut(blendedRot, fromRot, toRot, smoothT);

      // Recompose camera world transform, then invert to view
      const blendedWorld = new Float32Array(16) as Mat4;
      mat4FromQuatTranslation(blendedWorld, blendedRot, blendedPos);
      mat4Invert(this.viewMatrix, blendedWorld);
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
   * Set player position for FPS camera mode
   */
  setPlayerPosition(position: Vec3): void {
    this.playerPosition = position;
  }

  /**
   * Get player position
   */
  getPlayerPosition(): Vec3 | null {
    return this.playerPosition;
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
    
    // Cleanup cameras
    if (this.editorCamera) {
      this.editorCamera.dispose();
    }
  }
  
  /**
   * Enable camera for a specific mode
   */
  private enableCameraForMode(mode: CameraMode): void {
    console.log(`[CameraDirector] Enabling camera for mode: ${mode}`);
    switch (mode) {
      case 'orbit':
        this.orbitControls.setEnabled(true);
        console.log('[CameraDirector] ✓ Orbit controls enabled');
        break;
      case 'fps':
        // FPS camera is enabled by play mode
        if (this.fpsCamera) {
          this.fpsCamera.enable();
          console.log('[CameraDirector] ✓ FPS camera enabled');
        }
        break;
      case 'third-person':
        if (this.thirdPersonCamera) {
          this.thirdPersonCamera.enable();
          console.log('[CameraDirector] ✓ Third person camera enabled');
        }
        break;
      case 'free-fly':
        if (this.editorCamera) {
          this.editorCamera.enable();
          console.log('[CameraDirector] ✓ EditorCamera enabled');
        } else {
          console.warn('[CameraDirector] ⚠️ EditorCamera is null!');
        }
        this.orbitControls.setEnabled(false);
        console.log('[CameraDirector] ✓ Orbit controls disabled');
        break;
    }
  }
  
  /**
   * Disable camera for a specific mode
   */
  private disableCameraForMode(mode: CameraMode): void {
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
    
    // Always update projection (same for all modes currently)
    mat4Perspective(this.projectionMatrix, this.currentFov, aspect, Z_NEAR, Z_FAR);
    
    // Update view matrix based on mode (if not blending)
    if (!this.blend) {
      this.computeViewMatrix(this.currentMode, this.viewMatrix);
    }
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
          let basePosition: Vec3;
          
          // In play mode: use player position
          // In edit mode: use orbit camera position for free-fly FPS
          if (this.playerPosition) {
            basePosition = [
              this.playerPosition[0] + this.cameraOffset[0],
              this.playerPosition[1] + this.cameraOffset[1],
              this.playerPosition[2] + this.cameraOffset[2],
            ];
          } else {
            // Edit mode: calculate position from orbit controls
            const { yaw, pitch, distance } = this.orbitControls.getState();
            const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
            const eyeY = Math.sin(pitch) * distance;
            const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
            basePosition = [eyeX, eyeY, eyeZ];
          }
          
          const cameraPosition = this.resolveCameraCollision(basePosition);
          const fpsView = this.fpsCamera.getViewMatrix(cameraPosition);
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
          // Debug: log first time to confirm it's being called
          if (Math.random() < 0.01) { // Log only 1% of frames to avoid spam
            console.log('[CameraDirector] Using free-fly view matrix, position:', this.editorCamera.getPosition());
          }
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

  private resolveCameraCollision(playerPosition: Vec3): Vec3 {
    if (!this.physicsWorld || !this.scene || !this.fpsCamera) {
      return playerPosition;
    }

    const eyeOffset: Vec3 = [playerPosition[0], playerPosition[1], playerPosition[2]];

    const forward = this.fpsCamera.getForwardDirection();
    const desiredPosition: Vec3 = [
      eyeOffset[0],
      eyeOffset[1],
      eyeOffset[2],
    ];

    const rayOrigin: Vec3 = [
      eyeOffset[0],
      eyeOffset[1],
      eyeOffset[2],
    ];
    const rayDirection: Vec3 = [forward[0] * -1, forward[1] * -1, forward[2] * -1];

    const hit = this.physicsWorld.raycast(rayOrigin, rayDirection, {
      maxDistance: this.collisionRadius,
      ignoreEntities: [],
    });

    if (hit && hit.distance < this.collisionRadius) {
      const penetration = this.collisionRadius - hit.distance;
      desiredPosition[0] += rayDirection[0] * penetration;
      desiredPosition[1] += rayDirection[1] * penetration;
      desiredPosition[2] += rayDirection[2] * penetration;
    }

    return desiredPosition;
  }

  /**
   * Smooth interpolation function (ease-in-out)
   */
  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }
}

