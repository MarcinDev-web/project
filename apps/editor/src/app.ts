import { createOrbitControls, type OrbitControls } from '@engine/camera';
import { initRenderer, type Renderer } from '@engine/gfx-webgpu';
import { Scene, Raycaster, SelectionManager } from '@engine/world';
import { mat4LookAt, mat4Multiply, mat4Perspective, mat4Invert, mat4GetTranslationOut, mat4GetRotationOut, type Mat4, type Vec3 } from '@engine/core/math';
import { FOV_RADIANS, Z_FAR, Z_NEAR } from '@engine/gfx-webgpu/config';
import { EditorUI } from './editor/ui/EditorUI';
import { Logger } from './utils/logger';
import { CameraComponent } from '@engine/world';
import { PhysicsWorld } from '@engine/world';
import { CharacterControllerSystem } from '@engine/stdlib/CharacterController';
import { BlockBehaviorSystem, UISystem } from '@engine/world/systems';
import { registerTemplates, applyTo } from '@engine/world-templates';
import { createFlatPlatformTemplate } from '@engine/world-templates';
import { ShareClient } from '@engine/net';

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
  private blockBehaviorSystem: BlockBehaviorSystem | null = null;
  private uiSystem: UISystem | null = null;

  private renderer: Renderer | null = null;
  private editor: EditorUI | null = null;
  private selectionWireCleanup: (() => void) | null = null;

  private cleanedUp = false;
  private loaderTimeout: number | null = null;
  private loaderVisible = false;
  private isSharedView = false;

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

      // Register a single built-in template once at boot
      try {
        registerTemplates([
          createFlatPlatformTemplate(),
        ]);
        // Load default template immediately before initializing renderer/UI
        this.config.statusEl.textContent = 'Loading default scene…';
        await applyTo(this.scene, 'template:flat-platform', { clear: true });
      } catch {}

      this.renderer = await initRenderer({
        canvas: this.config.canvas,
        statusEl: this.config.statusEl,
        getOrbitState: () => this.controls.getState(),
        scene: this.scene,
        shouldSimulate: () => this.editor?.isPlayMode() === true,
        onFrameUpdate: (deltaTime: number) => {
          // Update brand watermark (FORGE ENGINE branding with FPS)
          this.editor?.updateBrandWatermark();

          // Update play mode systems (physics, character controller, FPS camera, UI)
          if (this.editor?.isPlayMode()) {
            try {
              // Initialize UI system if not already initialized
              if (this.uiSystem && !(this.uiSystem as any).uiRoot) {
                this.uiSystem.initialize();
              }
              this.editor.getModeManager()?.updatePlayMode(deltaTime);
              // Update UI system
              if (this.uiSystem) {
                this.uiSystem.update();
              }
            } catch (err) {
              Logger.warn('Play mode update failed:', err as Error);
            }
          } else {
            // Cleanup UI system when exiting play mode
            if (this.uiSystem) {
              this.uiSystem.cleanup();
            }
            // Update edit mode systems (camera director)
            try {
              const modeManager = this.editor?.getModeManager();
              if (modeManager) {
                modeManager.updateEditPreview(deltaTime);
                modeManager.getCameraDirector().update(deltaTime);

                // Send camera presence to collaboration (throttled by CursorTracker internally)
                try {
                  const cameraDirector = modeManager.getCameraDirector();
                  const view = cameraDirector.getViewMatrix();
                  // world = inverse(view)
                  const world = new Float32Array(16) as Mat4;
                  mat4Invert(world, view as Mat4);
                  const pos: Vec3 = [0, 0, 0];
                  const rot: [number, number, number, number] = [0, 0, 0, 1];
                  mat4GetTranslationOut(pos as unknown as Float32Array, world as Float32Array);
                  mat4GetRotationOut(rot as unknown as Float32Array, world as Float32Array);
                  this.editor?.getCollaborationManager()?.updateCursor(pos, rot);
                } catch {}
              }
            } catch (err) {
              // Ignore edit mode update errors
            }
          }
        },
      });

      this.physicsWorld = new PhysicsWorld(this.scene);
      this.characterSystem = new CharacterControllerSystem(this.scene, this.physicsWorld);
      this.blockBehaviorSystem = new BlockBehaviorSystem(this.scene, this.physicsWorld.getSystem());
      this.uiSystem = new UISystem(this.scene);

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
        blockBehaviorSystem: this.blockBehaviorSystem,
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
          // Set shared view mode if in shared view
          if (this.isSharedView) {
            state.isSharedView.value = true;
          }
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

    if (this.uiSystem) {
      try {
        this.uiSystem.dispose();
      } catch (error) {
        Logger.warn('uiSystem dispose failed:', error as unknown as Error);
      }
      this.uiSystem = null;
    }

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
      
      // Debug: log occasionally
      if (Math.random() < 0.01) {
        console.log('[EditorApp] updateCameraMatrices using CameraDirector, mode:', cameraDirector.getMode());
      }
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

  /**
   * Load a shared project by token.
   * Called from bootstrap if ?share=TOKEN is present in URL.
   */
  public async loadSharedProject(token: string): Promise<void> {
    try {
      this.config.statusEl.textContent = 'Loading shared project...';
      
      // Use empty baseURL for relative paths (Vite proxy handles /api/)
      const shareClient = new ShareClient('');
      const projectData = await shareClient.loadSharedProject(token);

      // Load scene from shared project
      const newScene = Scene.fromJSON(projectData.scene);
      
      // Replace current scene entities
      this.scene.clear();
      for (const entity of newScene.rootEntities) {
        this.scene.addEntity(entity);
      }
      this.scene.name = projectData.scene.name;

      // Update scene buffers if renderer is ready
      if (this.renderer) {
        this.renderer.updateScene();
      }

      // Mark as shared view and update state
      this.isSharedView = true;
      const state = (this.editor as any)?.state;
      if (state) {
        state.isSharedView.value = true;
      }
      
      // Show view-only message
      const message = `View-only mode: ${projectData.metadata.name} (Editing disabled)`;
      this.config.statusEl.textContent = message;
      setTimeout(() => {
        this.config.statusEl.textContent = `Viewing: ${projectData.metadata.name}`;
      }, 5000);
      Logger.info(`Loaded shared project: ${projectData.metadata.name}`);
    } catch (error) {
      Logger.error('Failed to load shared project:', error as unknown as Error);
      this.config.statusEl.textContent = 'Failed to load shared project.';
      throw error;
    }
  }

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
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sendSel = (window as any).__collabSendSelection as ((ids: string[]) => void) | undefined;
          if (sendSel) {
            const ids: string[] = [];
            const primary = this.selection.primarySelection as unknown as { id?: string } | null;
            if (primary && typeof primary.id === 'string') ids.push(primary.id);
            sendSel(ids);
          }
        } catch {}
      } else {
        if (!isCtrl) {
          this.selection.clearSelection();
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sendSel = (window as any).__collabSendSelection as ((ids: string[]) => void) | undefined;
            if (sendSel) sendSel([]);
          } catch {}
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (this.editor?.isPlayMode()) {
          this.editor?.getModeManager()?.exitPlayMode();
          return;
        }
        // Failsafe: always cancel any active placement preview first
        try {
          (this.editor as unknown as { cancelActivePlacement?: () => void })?.cancelActivePlacement?.();
        } catch {}
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

