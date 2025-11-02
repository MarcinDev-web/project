/**
 * BlocksModelsStudioCore - Manages game engine lifecycle for Blocks/Models Studio
 * Handles Scene, Renderer (WebGPU), OrbitControls, Blocks, and Models
 */

import { Scene, Entity, EnvironmentComponent } from '@engine/world';
import { initRenderer, type Renderer } from '@engine/gfx-webgpu';
import { LightManager } from '@engine/gfx-webgpu/lighting/LightManager';
import { createOrbitControls, type OrbitControls } from '@engine/camera';
import type { BlockDefinition } from '@engine/blocks';
import { MeshComponent } from '@engine/world/components/MeshComponent';
import { MaterialComponent } from '@engine/world/components/MaterialComponent';
import type { Vec3 } from '@engine/core/math';

export interface BlocksModelsStudioCoreOptions {
  canvas: HTMLCanvasElement;
  statusEl?: HTMLElement;
  selectedBlock?: BlockDefinition | null;
  onBlockChange?: (block: BlockDefinition) => void;
}

/**
 * Core class managing game engine lifecycle for blocks/models studio
 */
export class BlocksModelsStudioCore {
  private readonly scene: Scene;
  private renderer: Renderer | null = null;
  private controls: OrbitControls;
  private animationFrameId: number | null = null;
  private isInitialized = false;
  private disposed = false;
  private lastFrameTime = 0;

  private readonly canvas: HTMLCanvasElement;
  private readonly statusEl: HTMLElement | null;
  private readonly onBlockChange: ((block: BlockDefinition) => void) | undefined;

  // Blocks and models in the scene
  private blockEntities: Map<string, Entity> = new Map();
  private previewEntity: Entity | null = null;
  private gridEnabled = true;

  constructor(options: BlocksModelsStudioCoreOptions) {
    this.canvas = options.canvas;
    this.statusEl = options.statusEl ?? null;
    this.onBlockChange = options.onBlockChange;

    this.scene = new Scene('Blocks/Models Studio Scene');
    this.controls = createOrbitControls(this.canvas, {
      initialDistance: 5,
      minDistance: 1,
      maxDistance: 20,
    });

    // Grid will be rendered by renderer if needed

    // Setup environment and lighting
    this.setupEnvironment();

    // Create preview entity for block preview
    this.previewEntity = new Entity('PreviewBlock');
    this.previewEntity.transform.position = [0, 0, 0];
    this.scene.addEntity(this.previewEntity);
  }

  /**
   * Setup environment and default lighting for block/model rendering
   */
  private setupEnvironment(): void {
    // Create environment entity for skybox/atmosphere
    const envEntity = new Entity('Environment');
    const envComponent = new EnvironmentComponent();
    envComponent.skyboxType = 'procedural-sky';
    envComponent.skyColor = [0.4, 0.5, 0.7];
    envComponent.horizonColor = [0.6, 0.65, 0.75];
    envComponent.sunDirection = [0.3, -0.7, -0.5];
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
      throw new Error('BlocksModelsStudioCore is already initialized');
    }

    if (this.disposed) {
      throw new Error('BlocksModelsStudioCore has been disposed');
    }

    try {
      if (this.statusEl) {
        this.statusEl.textContent = 'Initializing WebGPU renderer...';
      }

      // Check WebGPU availability
      if (!('gpu' in navigator)) {
        throw new Error('WebGPU not supported in this browser. Please use Chrome 113+, Edge 113+, Opera 99+, Firefox 110+, or Safari 18.0+.');
      }

      this.renderer = await initRenderer({
        canvas: this.canvas,
        statusEl: this.statusEl ?? this.canvas,
        getOrbitState: () => {
          return this.controls.getState();
        },
        scene: this.scene,
        shouldSimulate: () => false, // No physics simulation needed
        onFrameUpdate: () => {
          // Update blocks/models if needed
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

      // Update renderer scene (grid is handled by renderer if enabled)
      this.renderer.updateScene();

      // Continue loop
      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  /**
   * Preview a block in the scene
   */
  previewBlock(block: BlockDefinition): void {
    if (!this.previewEntity) {
      return;
    }

    // Store block definition
    this.previewEntity.userData.blockDefinition = block;

    // Add mesh component for preview
    let mesh = this.previewEntity.getComponent(MeshComponent);
    if (!mesh) {
      mesh = new MeshComponent();
      this.previewEntity.addComponent(mesh);
    }
    mesh.meshType = 'cube';

    // Add material component
    let material = this.previewEntity.getComponent(MaterialComponent);
    if (!material) {
      material = new MaterialComponent();
      this.previewEntity.addComponent(material);
    }
    // Use material ID based on block material type
    // For now, just use default material (0)
    material.materialId = 0;

    // Set color from block textures
    const topColor = block.textures.top.color;
    this.previewEntity.color = [...topColor] as [number, number, number, number];

    // Notify change
    if (this.onBlockChange) {
      this.onBlockChange(block);
    }
  }

  /**
   * Add a block to the scene at position with optional scale
   */
  addBlock(block: BlockDefinition, position: Vec3, scale?: Vec3): Entity {
    const entity = new Entity(`Block_${block.id}_${Date.now()}`);
    entity.transform.position = [...position];
    if (scale) {
      entity.transform.scale = [...scale];
    }
    entity.userData.blockDefinition = block;
    
    // Create mesh component for block
    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    entity.addComponent(mesh);

    // Add material component
    const material = new MaterialComponent();
    // TODO: Map block material type to material ID
    material.materialId = 0;
    entity.addComponent(material);

    // Set color from block textures
    const topColor = block.textures.top.color;
    entity.color = [...topColor] as [number, number, number, number];
    
    this.scene.addEntity(entity);
    this.blockEntities.set(entity.id, entity);
    
    // Update renderer to pick up new entity
    if (this.renderer) {
      this.renderer.updateScene();
    }
    
    return entity;
  }

  /**
   * Remove a block from the scene
   */
  removeBlock(entityId: string): void {
    const entity = this.blockEntities.get(entityId);
    if (entity) {
      this.scene.removeEntity(entity);
      this.blockEntities.delete(entityId);
    }
  }

  /**
   * Clear all blocks from scene
   */
  clearBlocks(): void {
    for (const entity of this.blockEntities.values()) {
      this.scene.removeEntity(entity);
    }
    this.blockEntities.clear();
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
   * Get controls (for advanced operations)
   */
  getControls(): OrbitControls {
    return this.controls;
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

    // Clear blocks
    this.clearBlocks();

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

  /**
   * Toggle grid visibility
   */
  toggleGrid(): void {
    this.gridEnabled = !this.gridEnabled;
    // TODO: Update renderer grid visibility
  }

  /**
   * Check if grid is enabled
   */
  isGridEnabled(): boolean {
    return this.gridEnabled;
  }
}

