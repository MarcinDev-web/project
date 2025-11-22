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
  DEFAULT_AVATAR_PART_LIBRARY,
  IDLE_ANIMATION,
  RUN_ANIMATION,
  WALK_ANIMATION,
  type AvatarLoadout,
  type AvatarSlot,
  type AvatarMaterialResolver,
  type AvatarAnimation,
} from '@engine/avatar';
import { AvatarLoadoutSerializer } from '@engine/avatar/serialization/avatar-loadout-serializer';
import type { ValidationResult } from '@engine/avatar/serialization/avatar-loadout-serializer';
import type { RgbaColor } from '@engine/world';
import { materialCatalogService, type MaterialMetadata } from './MaterialCatalogService';
import { getVec3Pool } from '@engine/core/utils/Vec3Pool';

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
  private initPromise: Promise<void> | null = null;

  private readonly canvas: HTMLCanvasElement;
  private readonly statusEl: HTMLElement | null;
  private readonly onLoadoutChange: ((loadout: AvatarLoadout) => void) | undefined;
  private readonly materialResolver: AvatarMaterialResolver;
  private readonly serializer: AvatarLoadoutSerializer;

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

    // Create material resolver
    this.materialResolver = this.createMaterialResolver();
    
    // Create serializer for validation
    this.serializer = new AvatarLoadoutSerializer();

    // Create a temporary parent entity for AvatarInstance
    // AvatarInstance will create its own root entity as a child of this parent
    // We don't add this parent to the scene to avoid rendering it
    const tempParent = new Entity('AvatarTempParent');
    tempParent.transform.position = [0, 0, 0];

    // Initialize avatar with default or provided loadout
    const loadout = options.initialLoadout ?? DEFAULT_AVATAR_LOADOUT;
    this.avatar = new AvatarInstance(tempParent, {
      name: 'BuilderAvatar',
      loadout,
      materialResolver: this.materialResolver,
    });

    // Add AvatarInstance's root directly to the scene (not the temp parent)
    // This ensures only the avatar's actual root is in the scene, avoiding nested rendering
    const avatarInstanceRoot = this.avatar.getRootEntity();
    tempParent.removeChild(avatarInstanceRoot);
    this.scene.addEntity(avatarInstanceRoot);
  }

  /**
   * Create material resolver using Material Catalog Service
   */
  private createMaterialResolver(): AvatarMaterialResolver {
    return materialCatalogService.getResolver();
  }

  /**
   * Get available materials from catalog service
   */
  getAvailableMaterials(): Array<{ id: string; name: string }> {
    return materialCatalogService.getAllMaterials().map((m) => ({
      id: m.id,
      name: m.name,
    }));
  }

  /**
   * Get material metadata by ID
   */
  getMaterialMetadata(id: string): MaterialMetadata | undefined {
    return materialCatalogService.getMaterial(id);
  }

  /**
   * Search materials by query
   */
  searchMaterials(query: string): MaterialMetadata[] {
    return materialCatalogService.searchMaterials(query);
  }

  /**
   * Get materials by category
   */
  getMaterialsByCategory(category: MaterialMetadata['category']): MaterialMetadata[] {
    return materialCatalogService.getMaterialsByCategory(category);
  }

  /**
   * Play animation on avatar
   */
  playAnimation(animation: AvatarAnimation): void {
    this.requireAvatar().playAnimation(animation);
  }

  /**
   * Stop current animation
   */
  stopAnimation(resetPose = false): void {
    const avatar = this.requireAvatar();
    avatar.stopAnimation();
    if (resetPose) {
      // Reset pose by playing idle animation from start
      avatar.playAnimation(IDLE_ANIMATION, 0);
    }
  }

  /**
   * Reset avatar pose to default
   */
  resetPose(): void {
    this.stopAnimation(true);
  }

  /**
   * Get available animations
   */
  getAvailableAnimations(): Array<{ animation: AvatarAnimation; name: string }> {
    return [
      { animation: IDLE_ANIMATION, name: 'Idle' },
      { animation: WALK_ANIMATION, name: 'Walk' },
      { animation: RUN_ANIMATION, name: 'Run' },
    ];
  }

  /**
   * Validate a loadout against the part library
   */
  validateLoadout(loadout: AvatarLoadout): ValidationResult {
    return this.serializer.validate(loadout, DEFAULT_AVATAR_PART_LIBRARY);
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
   * Idempotent: multiple calls return the same promise
   */
  async initialize(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.isInitialized) {
      return Promise.resolve();
    }

    if (this.disposed) {
      throw new Error('AvatarBuilderCore has been disposed');
    }

    // Create and store the initialization promise
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  /**
   * Internal initialization logic
   */
  private async _doInitialize(): Promise<void> {
    try {
      if (this.statusEl) {
        this.statusEl.textContent = 'Initializing WebGPU renderer...';
      }

      // Check WebGPU availability before attempting initialization
      if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        const errorMsg = 'WebGPU not supported in this browser. Please use Chrome 113+, Edge 113+, Opera 99+, Firefox 110+, or Safari 18.0+.';
        if (this.statusEl) {
          this.statusEl.textContent = errorMsg;
        }
        throw new Error(errorMsg);
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
        enableSSGI: true,
      });

      // If disposed while initializing, clean up immediately
      if (this.disposed) {
        this.renderer.cleanup();
        this.renderer = null;
        return;
      }

      if (this.statusEl) {
        this.statusEl.textContent = '';
      }

      this.isInitialized = true;
      this.startGameLoop();
      
      // Start idle animation
      if (this.avatar) {
        this.avatar.playAnimation(IDLE_ANIMATION);
      }

      // Frame the avatar so the camera never starts inside geometry
      try {
        this.frameAvatar();
      } catch (e) {
        // Non-fatal: keep going with default camera if framing fails
        console.warn('AvatarBuilderCore: frameAvatar failed, using default camera', e);
      }
    } catch (error) {
      // Provide more specific error messages with better formatting
      let errorMessage = 'Failed to initialize WebGPU renderer';
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('WebGPU not supported')) {
          errorMessage = msg.includes('Please use') ? msg : 'WebGPU not supported in this browser. Please use Chrome 113+, Edge 113+, Opera 99+, Firefox 110+, or Safari 18.0+.';
        } else if (msg.includes('Failed to acquire GPU adapter') || msg.includes('adapter')) {
          errorMessage = 'Failed to acquire WebGPU adapter. Your GPU may not be supported or GPU drivers need updating.';
        } else if (msg.includes('Failed to create WebGPU context') || msg.includes('context')) {
          errorMessage = 'Failed to create WebGPU rendering context. Please try refreshing the page.';
        } else if (msg.includes('canvas configuration')) {
          errorMessage = 'WebGPU canvas configuration failed. Please try refreshing the page.';
        } else {
          errorMessage = `WebGPU initialization failed: ${msg}`;
        }
      } else {
        errorMessage = `WebGPU initialization failed: ${String(error)}`;
      }
      
      if (this.statusEl) {
        this.statusEl.textContent = errorMessage;
      }
      
      // Log the full error for debugging
      console.error('AvatarBuilderCore: WebGPU initialization error:', error);
      
      // Clear promise on error so retry is possible
      this.initPromise = null;
      throw new Error(errorMessage);
    }
  }

  /**
   * Compute approximate avatar height from skeleton joints and place camera to fit it.
   * Uses a simple bounding-sphere fit based on vertical extent.
   */
  private frameAvatar(): void {
    if (!this.avatar) return;

    // Estimate height from skeleton world Y extents
    const skeleton = this.avatar.getSkeleton();
    const jointNames = skeleton.getJointNames();
    const pool = getVec3Pool();
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const name of jointNames) {
      const { position } = skeleton.getWorldTransform(name);
      const y = position[1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      // Return pooled vector
      pool.release(position);
    }

    // Fallback if something went wrong - use default camera state instead of recursion
    if (!Number.isFinite(minY) || !Number.isFinite(maxY) || maxY <= minY) {
      this.controls.setState({
        yaw: Math.PI * 0.125,
        pitch: 0.35,
        distance: 3,
      });
      return;
    }

    const height = maxY - minY;

    // Convert height to a comfortable viewing distance using FOV
    // Using same FOV as renderer config (2π/5 ≈ 72°)
    const FOV = (2 * Math.PI) / 5;
    const radius = height * 0.6; // generous sphere radius to include shoulders/arms
    const distance = Math.max(1, radius / Math.sin(FOV * 0.5) * 1.15);

    // Slightly elevated pitch and a small yaw for depth
    this.controls.setState({
      yaw: Math.PI * 0.125,     // ~22.5°
      pitch: 0.35,              // ~20° down
      distance,
    });
  }

  /**
   * Start the game loop
   */
  private startGameLoop(): void {
    const frame = (_currentTime: number) => {
      if (this.disposed || !this.renderer || !this.isInitialized) {
        return;
      }

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
   * @param loadout - The loadout to apply
   * @param silent - If true, don't trigger onLoadoutChange callback (useful for external updates)
   */
  applyLoadout(loadout: AvatarLoadout, silent = false): void {
    this.requireAvatar().applyLoadout(loadout);
    if (!silent) {
      this.notifyLoadoutChange();
    }
  }

  /**
   * Set color for a specific slot and color slot
   */
  setSlotColor(slot: AvatarSlot, colorSlot: string, color: RgbaColor): void {
    const currentLoadout = this.getCurrentLoadout();
    const part = currentLoadout.parts[slot];

    if (part) {
      this.updateSlot(slot, {
        colors: {
          ...part.colors,
          [colorSlot]: color,
        },
      });
    }
  }

  /**
   * Set mesh for a specific slot
   */
  setSlotMesh(slot: AvatarSlot, meshId: string): void {
    this.updateSlot(slot, { mesh: meshId });
  }

  /**
   * Set material for a specific slot
   */
  setSlotMaterial(slot: AvatarSlot, materialId: string): void {
    const currentLoadout = this.getCurrentLoadout();
    const part = currentLoadout.parts[slot];

    if (part) {
      this.updateSlot(slot, { material: materialId });
    } else {
      // Don't create part without mesh - material requires existing part with mesh
      // User should set mesh first, then material
      throw new Error(`Cannot set material for slot ${slot}: part does not exist. Set mesh first.`);
    }
  }

  /**
   * Reset to default loadout
   */
  resetToDefault(): void {
    this.applyLoadout(DEFAULT_AVATAR_LOADOUT);
  }

  /**
   * Require avatar instance - throws if avatar is not initialized
   */
  private requireAvatar(): AvatarInstance {
    if (!this.avatar) {
      throw new Error('Avatar not initialized');
    }
    return this.avatar;
  }

  /**
   * Update a slot in the current loadout with a partial update
   */
  private updateSlot(
    slot: AvatarSlot,
    update: Partial<AvatarLoadout['parts'][AvatarSlot]>,
  ): void {
    const avatar = this.requireAvatar();
    const currentLoadout = avatar.serializeLoadout();
    const part = currentLoadout.parts[slot];

    if (part) {
      const updatedPart = {
        ...part,
        ...update,
      };
      this.applyLoadout({
        ...currentLoadout,
        parts: {
          ...currentLoadout.parts,
          [slot]: updatedPart,
        },
      });
    } else {
      // Only create new part if update includes mesh (required field)
      if ('mesh' in update && update.mesh) {
        this.applyLoadout({
          ...currentLoadout,
          parts: {
            ...currentLoadout.parts,
            [slot]: update as AvatarLoadout['parts'][AvatarSlot],
          },
        });
      }
    }
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
   * Get controls (for camera operations)
   */
  getControls(): OrbitControls {
    return this.controls;
  }

  /**
   * Reset camera to default position
   */
  resetCamera(): void {
    // Use framing logic to ensure avatar fits the view
    this.frameAvatar();
  }

  /**
   * Rotate camera left (negative yaw)
   */
  rotateLeft(amount: number = 0.5): void {
    const state = this.controls.getState();
    this.controls.setState({
      yaw: state.yaw - amount,
      pitch: state.pitch,
      distance: state.distance,
    });
  }

  /**
   * Rotate camera right (positive yaw)
   */
  rotateRight(amount: number = 0.5): void {
    const state = this.controls.getState();
    this.controls.setState({
      yaw: state.yaw + amount,
      pitch: state.pitch,
      distance: state.distance,
    });
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

    // Clear initialization promise
    this.initPromise = null;

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


