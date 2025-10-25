import { createOrbitControls, type OrbitControls } from './input';
import { initRenderer, type Renderer } from './rendering/index';
import { Scene, Raycaster, SelectionManager } from './scene';
import { mat4LookAt, mat4Multiply, mat4Perspective, type Mat4, type Vec3 } from '@engine/core/math';
import { FOV_RADIANS, Z_FAR, Z_NEAR } from './rendering/config';
import { EditorUI } from './editor/ui/EditorUI';
import { Logger } from './logger';
import { CameraComponent } from './scene/components/CameraComponent';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { CharacterControllerSystem } from './scene/CharacterControllerSystem';

export interface EditorAppOptions {
  canvas: HTMLCanvasElement;
  statusEl: HTMLElement;
}

export class EditorApp {
  private readonly scene = new Scene('Demo Scene');
  private readonly selection = new SelectionManager();
  private readonly controls: OrbitControls;
  private readonly raycaster = new Raycaster();
  private physicsWorld: PhysicsWorld | null = null;
  private characterSystem: CharacterControllerSystem | null = null;

  private renderer: Renderer | null = null;
  private editor: EditorUI | null = null;
  private selectionWireCleanup: (() => void) | null = null;

  private cleanedUp = false;
  private loaderTimeout: number | null = null;
  private loaderVisible = false;

  private readonly projectionMatrix = new Float32Array(16);
  private readonly viewMatrix = new Float32Array(16);
  private readonly viewProjectionMatrix = new Float32Array(16);

  constructor(private readonly config: EditorAppOptions) {
    this.controls = createOrbitControls(config.canvas);
  }

  public async start(): Promise<void> {
    if (this.renderer) {
      throw new Error('App is already started.');
    }

    this.cleanedUp = false;

    try {
      this.loaderTimeout = window.setTimeout(() => {
        this.loaderVisible = true;
        this.config.statusEl.textContent = 'Loading renderer…';
      }, 150);

      this.renderer = await initRenderer({
        canvas: this.config.canvas,
        statusEl: this.config.statusEl,
        getOrbitState: () => this.controls.getState(),
        scene: this.scene,
        shouldSimulate: () => this.editor?.isPlayMode() === true,
        onFrameUpdate: (deltaTime: number) => {
          // Update play mode systems (physics, character controller, FPS camera)
          if (this.editor?.isPlayMode()) {
            try {
              this.editor.getModeManager()?.updatePlayMode(deltaTime);
            } catch (err) {
              Logger.warn('Play mode update failed:', err as Error);
            }
          }
        },
      });

      this.physicsWorld = new PhysicsWorld(this.scene);
      this.characterSystem = new CharacterControllerSystem(this.scene, this.physicsWorld);

      // Expose abort helper for debugging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).abortRenderLoop = () => {
        try {
          this.renderer?.abort();
        } catch (error) {
          Logger.warn('abortRenderLoop failed:', error as unknown as Error);
        }
      };

      this.editor = new EditorUI({
        canvas: this.config.canvas,
        statusEl: this.config.statusEl,
        controls: this.controls,
        scene: this.scene,
        selection: this.selection,
        updateSceneBuffers: this.updateSceneBuffers,
        projectWorldToScreen: this.projectWorldToScreen,
        getRenderer: () => this.renderer,
        physicsWorld: this.physicsWorld,
        characterSystem: this.characterSystem,
      });
      await this.editor.initialize();

      this.selectionWireCleanup = this.wireSelection();
      const state = (this.editor as any).state;
      if (state) {
        try {
          const caps = this.renderer.getCapabilities();
          state.capabilities.value = caps;
          state.featureFlags.value = {
            ...state.featureFlags.value,
            enableTimestamps: !!caps.features.timestampQuery,
            enableOcclusion: !!caps.features.occlusionQuery,
          };
        } catch {
          // ignore capability propagation errors
        }
      }
    } catch (error) {
      Logger.error('App start failed', error as unknown as Error);
      this.config.statusEl.textContent = 'Failed to initialize WebGPU.';
      this.cleanup();
      throw error;
    } finally {
      if (this.loaderTimeout !== null) {
        try {
          clearTimeout(this.loaderTimeout);
        } catch (err) {
          Logger.warn('clearTimeout loaderTimeout failed', err as unknown as Error);
        }
        this.loaderTimeout = null;
      }
      if (this.loaderVisible) {
        this.loaderVisible = false;
      }
    }
  }

  public cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    if (this.selectionWireCleanup) {
      try {
        this.selectionWireCleanup();
      } catch (error) {
        Logger.warn('selection cleanup failed:', error as unknown as Error);
      }
      this.selectionWireCleanup = null;
    }

    try {
      this.editor?.dispose();
    } catch (error) {
      Logger.warn('editor dispose failed:', error as unknown as Error);
    } finally {
      this.editor = null;
    }

    this.physicsWorld = null;
    this.characterSystem = null;

    try {
      this.controls.cleanup();
    } catch (error) {
      Logger.warn('controls cleanup failed:', error as unknown as Error);
    }

    if (this.renderer) {
      try {
        this.renderer.cleanup();
      } catch (error) {
        Logger.warn('renderer cleanup failed:', error as unknown as Error);
      } finally {
        this.renderer = null;
      }
    }
  }

  private readonly updateSceneBuffers = (): void => {
    this.renderer?.updateScene();
  };

  private readonly updateCameraMatrices = (): void => {
    const aspect = this.config.canvas.width / this.config.canvas.height;

    // Try to use CameraDirector from ModeManager first
    const modeManager = this.editor?.getModeManager();
    const cameraDirector = modeManager?.getCameraDirector();
    
    if (cameraDirector) {
      // Use camera director for unified camera management
      const view = cameraDirector.getViewMatrix();
      const projection = cameraDirector.getProjectionMatrix();
      this.viewMatrix.set(view);
      this.projectionMatrix.set(projection);
      mat4Multiply(
        this.viewProjectionMatrix as Mat4,
        this.projectionMatrix as Mat4,
        this.viewMatrix as Mat4
      );
      return;
    }

    // Fallback to primary camera if no camera director
    const primaryCamera = this.scene.primaryCamera;
    if (primaryCamera) {
      const cameraComponent = primaryCamera.getComponent(CameraComponent);
      if (cameraComponent) {
        cameraComponent.getProjectionMatrix(this.projectionMatrix as Mat4, aspect);
        cameraComponent.getViewMatrix(primaryCamera, this.viewMatrix as Mat4);
        mat4Multiply(
          this.viewProjectionMatrix as Mat4,
          this.projectionMatrix as Mat4,
          this.viewMatrix as Mat4
        );
        return;
      }
    }

    // Final fallback to orbit controls
    const { yaw, pitch, distance } = this.controls.getState();
    mat4Perspective(this.projectionMatrix as Mat4, FOV_RADIANS, aspect, Z_NEAR, Z_FAR);
    const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
    const eyeY = Math.sin(pitch) * distance;
    const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
    mat4LookAt(this.viewMatrix as Mat4, [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);
    mat4Multiply(
      this.viewProjectionMatrix as Mat4,
      this.projectionMatrix as Mat4,
      this.viewMatrix as Mat4
    );
  };

  private readonly projectWorldToScreen = (world: Vec3): { x: number; y: number } | null => {
    this.updateCameraMatrices();
    const x = world[0] ?? 0;
    const y = world[1] ?? 0;
    const z = world[2] ?? 0;
    const m = this.viewProjectionMatrix;
    const clipX = (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0);
    const clipY = (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0);
    const clipW = (m[3] ?? 1) * x + (m[7] ?? 0) * y + (m[11] ?? 0) * z + (m[15] ?? 1);
    if (clipW <= 0) return null;
    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;
    return {
      x: ((ndcX + 1) / 2) * this.config.canvas.width,
      y: ((1 - ndcY) / 2) * this.config.canvas.height,
    };
  };

  private wireSelection(): () => void {
    const handleClick = (event: MouseEvent) => {
      if (!this.renderer) return;
      this.updateCameraMatrices();
      const rect = this.config.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const ray = this.raycaster.createRayFromScreen(
        mouseX,
        mouseY,
        this.config.canvas.width,
        this.config.canvas.height,
        this.viewMatrix as Mat4,
        this.projectionMatrix as Mat4
      );
      const hits = this.raycaster.raycastAll(ray, this.scene.getActiveEntities());
      const isCtrl = event.ctrlKey || event.metaKey;
      if (hits.length > 0) {
        const hit = hits[0]!;
        if (isCtrl) {
          this.selection.toggleSelection(hit.entity);
        } else {
          const existing = this.selection.primarySelection;
          if (existing && existing === hit.entity) {
            this.selection.clearSelection();
          } else {
            this.selection.select(hit.entity);
          }
        }
      } else {
        if (!isCtrl) {
          this.selection.clearSelection();
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (this.editor?.isPlayMode()) {
          this.editor?.getModeManager()?.exitPlayMode();
          return;
        }
        this.selection.clearSelection();
      }
    };

    this.config.canvas.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      this.config.canvas.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }
}
