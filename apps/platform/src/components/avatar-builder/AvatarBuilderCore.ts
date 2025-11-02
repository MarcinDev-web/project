/**
 * AvatarBuilderCore - Manages game engine lifecycle for Avatar Builder Studio
 * Handles Scene, Renderer (WebGPU), OrbitControls, and AvatarInstance
 */

import { Scene, Entity, EnvironmentComponent } from '@engine/world';
import { initRenderer, type Renderer } from '@engine/gfx-webgpu';
import { LightManager } from '@engine/gfx-webgpu/lighting/LightManager';
import { createOrbitControls, type OrbitControls } from '@engine/camera';
import {
  AvatarInstance,
  DEFAULT_AVATAR_LOADOUT,
  type AvatarLoadout,
  type AvatarSlot,
} from '@engine/avatar';
import type { RgbaColor } from '@engine/world';

export interface AvatarBuilderCoreOptions {
  canvas: HTMLCanvasElement;
  statusEl?: HTMLElement;
  initialLoadout?: AvatarLoadout;
  onLoadoutChange?: (loadout: AvatarLoadout) => void;
}

/**
 * Core class managing game engine lifecycle for avatar builder
 */
export class AvatarBuilderCore {
  private readonly scene: Scene;
  private renderer: Renderer | null = null;
  private avatar: AvatarInstance | null = null;
  private controls: OrbitControls;
  private animationFrameId: number | null = null;
  private isInitialized = false;
  private disposed = false;
  private lastFrameTime = 0;

  private readonly canvas: HTMLCanvasElement;
  private readonly statusEl: HTMLElement | null;
  private readonly onLoadoutChange: ((loadout: AvatarLoadout) => void) | undefined;

  constructor(options: AvatarBuilderCoreOptions) {
    this.canvas = options.canvas;
    this.statusEl = options.statusEl ?? null;
    this.onLoadoutChange = options.onLoadoutChange ?? undefined;

    this.scene = new Scene('Avatar Builder Scene');
    this.controls = createOrbitControls(this.canvas, {
      initialDistance: 3,
      minDistance: 1,
      maxDistance: 10,
    });

    // Setup environment and lighting
    this.setupEnvironment();

    // Create root entity for avatar
    const avatarRoot = new Entity('AvatarRoot');
    avatarRoot.transform.position = [0, 0, 0];
    this.scene.addEntity(avatarRoot);

    // Initialize avatar with default or provided loadout
    const loadout = options.initialLoadout ?? DEFAULT_AVATAR_LOADOUT;
    this.avatar = new AvatarInstance(avatarRoot, {
      name: 'BuilderAvatar',
      loadout,
    });
  }

  /**
   * Setup environment and default lighting for avatar rendering
   */
  private setupEnvironment(): void {
    // Create environment entity for skybox/atmosphere
    const envEntity = new Entity('Environment');
    const envComponent = new EnvironmentComponent();
    // Configure for nice avatar viewing
    envComponent.skyboxType = 'procedural-sky';
    envComponent.skyColor = [0.4, 0.5, 0.7]; // Brighter sky
    envComponent.horizonColor = [0.6, 0.65, 0.75];
    envComponent.sunDirection = [0.3, -0.7, -0.5]; // Angled from top-front
    envComponent.sunColor = [1.0, 0.98, 0.95];
    envComponent.enabled = true;
    envEntity.addComponent(envComponent);
    this.scene.addEntity(envEntity);

    // Create default lights (directional + ambient)
    LightManager.createDefaultLights(this.scene);
  }

  /**
   * Initialize the renderer and start the game loop
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('AvatarBuilderCore is already initialized');
    }

    if (this.disposed) {
      throw new Error('AvatarBuilderCore has been disposed');
    }

    try {
      if (this.statusEl) {
        this.statusEl.textContent = 'Initializing WebGPU renderer...';
      }

      // Check WebGPU availability before attempting initialization
      if (!('gpu' in navigator)) {
        throw new Error('WebGPU not supported in this browser. Please use Chrome 113+, Edge 113+, Opera 99+, Firefox 110+, or Safari 18.0+.');
      }

      this.renderer = await initRenderer({
        canvas: this.canvas,
        statusEl: this.statusEl ?? this.canvas,
        getOrbitState: () => {
          const state = this.controls.getState();
          return {
            yaw: state.yaw,
            pitch: state.pitch,
            distance: state.distance,
          };
        },
        scene: this.scene,
        shouldSimulate: () => false, // No physics simulation needed
        onFrameUpdate: (deltaTime: number) => {
          if (this.avatar) {
            this.avatar.update(deltaTime);
          }
        },
        enableShadows: true,
        shadowQuality: 'med',
      });

      if (this.statusEl) {
        this.statusEl.textContent = '';
      }

      this.isInitialized = true;
      this.lastFrameTime = performance.now();
      this.startGameLoop();
    } catch (error) {
      // Provide more specific error messages
      let errorMessage = 'Failed to initialize WebGPU renderer';
      if (error instanceof Error) {
        if (error.message.includes('WebGPU not supported')) {
          errorMessage = error.message;
        } else if (error.message.includes('Failed to acquire GPU adapter')) {
          errorMessage = 'WebGPU adapter not available. Your GPU may not be supported or GPU drivers need updating.';
        } else if (error.message.includes('Failed to create WebGPU context')) {
          errorMessage = 'Failed to create WebGPU rendering context. Please try refreshing the page.';
        } else {
          errorMessage = `WebGPU initialization failed: ${error.message}`;
        }
      }
      
      if (this.statusEl) {
        this.statusEl.textContent = errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * Start the game loop
   */
  private startGameLoop(): void {
    const frame = (currentTime: number) => {
      if (this.disposed || !this.renderer || !this.isInitialized) {
        return;
      }

      this.lastFrameTime = currentTime;

      // Update renderer scene (picks up any changes)
      // Note: renderer handles actual rendering internally via its own loop
      this.renderer.updateScene();

      // Continue loop
      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  /**
   * Get current avatar loadout
   */
  getCurrentLoadout(): AvatarLoadout {
    if (!this.avatar) {
      return DEFAULT_AVATAR_LOADOUT;
    }
    return this.avatar.serializeLoadout();
  }

  /**
   * Apply a loadout to the avatar
   */
  applyLoadout(loadout: AvatarLoadout): void {
    if (!this.avatar) {
      throw new Error('Avatar not initialized');
    }

    this.avatar.applyLoadout(loadout);
    this.notifyLoadoutChange();
  }

  /**
   * Set color for a specific slot and color slot
   */
  setSlotColor(slot: AvatarSlot, colorSlot: string, color: RgbaColor): void {
    if (!this.avatar) {
      throw new Error('Avatar not initialized');
    }

    const currentLoadout = this.getCurrentLoadout();
    const part = currentLoadout.parts[slot];

    if (part) {
      const updatedPart = {
        ...part,
        colors: {
          ...part.colors,
          [colorSlot]: color,
        },
      };
      this.applyLoadout({
        ...currentLoadout,
        parts: {
          ...currentLoadout.parts,
          [slot]: updatedPart,
        },
      });
    }
  }

  /**
   * Set mesh for a specific slot
   */
  setSlotMesh(slot: AvatarSlot, meshId: string): void {
    if (!this.avatar) {
      throw new Error('Avatar not initialized');
    }

    const currentLoadout = this.getCurrentLoadout();
    const part = currentLoadout.parts[slot];

    if (part) {
      const updatedPart = {
        ...part,
        mesh: meshId,
      };
      this.applyLoadout({
        ...currentLoadout,
        parts: {
          ...currentLoadout.parts,
          [slot]: updatedPart,
        },
      });
    } else {
      // Create new part entry
      this.applyLoadout({
        ...currentLoadout,
        parts: {
          ...currentLoadout.parts,
          [slot]: { mesh: meshId },
        },
      });
    }
  }

  /**
   * Set material for a specific slot
   */
  setSlotMaterial(slot: AvatarSlot, materialId: string): void {
    if (!this.avatar) {
      throw new Error('Avatar not initialized');
    }

    const currentLoadout = this.getCurrentLoadout();
    const part = currentLoadout.parts[slot];

    if (part) {
      const updatedPart = {
        ...part,
        material: materialId,
      };
      this.applyLoadout({
        ...currentLoadout,
        parts: {
          ...currentLoadout.parts,
          [slot]: updatedPart,
        },
      });
    } else {
      // Create new part entry with material
      this.applyLoadout({
        ...currentLoadout,
        parts: {
          ...currentLoadout.parts,
          [slot]: { mesh: 'default', material: materialId },
        },
      });
    }
  }

  /**
   * Reset to default loadout
   */
  resetToDefault(): void {
    this.applyLoadout(DEFAULT_AVATAR_LOADOUT);
  }

  /**
   * Get avatar instance (for advanced operations)
   */
  getAvatarInstance(): AvatarInstance | null {
    return this.avatar;
  }

  /**
   * Get renderer (for advanced operations)
   */
  getRenderer(): Renderer | null {
    return this.renderer;
  }

  /**
   * Get scene (for advanced operations)
   */
  getScene(): Scene {
    return this.scene;
  }

  /**
   * Notify listeners of loadout change
   */
  private notifyLoadoutChange(): void {
    if (this.onLoadoutChange && this.avatar) {
      this.onLoadoutChange(this.avatar.serializeLoadout());
    }
  }

  /**
   * Dispose resources and cleanup
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Dispose avatar
    if (this.avatar) {
      this.avatar.dispose();
      this.avatar = null;
    }

    // Cleanup controls
    try {
      this.controls.cleanup();
    } catch (error) {
      console.warn('Failed to cleanup orbit controls:', error);
    }

    // Dispose renderer
    if (this.renderer) {
      try {
        this.renderer.cleanup();
      } catch (error) {
        console.warn('Failed to cleanup renderer:', error);
      }
      this.renderer = null;
    }

    this.isInitialized = false;
  }
}

