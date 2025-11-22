/**
 * ModelBuilderManager - Manages Model Builder state and integration
 * 
 * Initialization, mode switching, scene management, integration with editor
 */

import { Scene } from '@engine/world';
import { ModelBuilder, BlockDefinitionGenerator } from '@engine/blocks';
import { ModelBuilderScene } from '../model-builder/ModelBuilderScene';
import { ModelBuilderMode } from '../model-builder/ModelBuilderMode';
import type { ModelBuilderModeConfig } from '../model-builder/ModelBuilderMode';
import { ModelBuilderController } from '../controllers/ModelBuilderController';
import type { ModelBuilderControllerConfig } from '../controllers/ModelBuilderController';
import { BuildBoundsVisualizer } from '../model-builder/BuildBoundsVisualizer';
import { MicroBlockPreview } from '../model-builder/MicroBlockPreview';
import { ModelBuilderPanel } from '../panels/content/ModelBuilderPanel';
import type { BuildBounds, ModelBuilderConfig } from '@engine/blocks';
import type { ModelBuilderSceneConfig } from '../model-builder/ModelBuilderScene';
import { DisposableGroup } from '@engine/core';

/**
 * Configuration for ModelBuilderManager
 */
export interface ModelBuilderManagerConfig {
  /** Build bounds */
  bounds: BuildBounds;
  /** Room size (default: 4) */
  roomSize?: number;
  /** Logger for debugging */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
  /** Callback to register undo handler with main editor */
  registerUndo?: (handler: () => boolean) => () => void;
  /** Callback to register redo handler with main editor */
  registerRedo?: (handler: () => boolean) => () => void;
}

/**
 * ModelBuilderManager coordinates all Model Builder components
 */
export class ModelBuilderManager {
  private readonly scene: Scene;
  private readonly config: ModelBuilderManagerConfig;
  private readonly logger: ModelBuilderManagerConfig['logger'];
  private readonly disposables = new DisposableGroup();

  private builder: ModelBuilder | null = null;
  private builderScene: ModelBuilderScene | null = null;
  private builderMode: ModelBuilderMode | null = null;
  private controller: ModelBuilderController | null = null;
  private visualizer: BuildBoundsVisualizer | null = null;
  private preview: MicroBlockPreview | null = null;
  private panel: ModelBuilderPanel | null = null;
  private isActive = false;

  constructor(scene: Scene, config: ModelBuilderManagerConfig) {
    this.scene = scene;
    this.config = config;
    this.logger = config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };

    // Keep reference to the host scene for future integrations
    void this.scene;
  }

  /**
   * Initializes Model Builder
   */
  initialize(): void {
    if (this.isActive) {
      this.logger?.warn('ModelBuilderManager already initialized');
      return;
    }

    // Create ModelBuilder
    const builderConfig: ModelBuilderConfig = this.logger
      ? {
          bounds: this.config.bounds,
          logger: this.logger,
        }
      : {
          bounds: this.config.bounds,
        };

    this.builder = new ModelBuilder(builderConfig);

    // Create ModelBuilderScene
    const builderSceneConfig: ModelBuilderSceneConfig = {
      roomSize: this.config.roomSize ?? 4,
    };

    if (this.logger) {
      builderSceneConfig.logger = this.logger;
    }

    this.builderScene = new ModelBuilderScene(builderSceneConfig);

    // Setup model entity
    this.builderScene.setupModel(this.builder);

    // Create ModelBuilderMode
    const builderModeConfig: ModelBuilderModeConfig = {
      enableHistory: true,
    };

    if (this.config.registerUndo) {
      builderModeConfig.registerUndo = this.config.registerUndo;
    }

    if (this.config.registerRedo) {
      builderModeConfig.registerRedo = this.config.registerRedo;
    }

    if (this.logger) {
      builderModeConfig.logger = this.logger;
    }

    this.builderMode = new ModelBuilderMode(
      this.builderScene,
      this.builder,
      builderModeConfig
    );

    // Create visualizer
    this.visualizer = new BuildBoundsVisualizer(
      this.builderScene.getScene(),
      this.config.bounds
    );

    // Create preview
    this.preview = new MicroBlockPreview(this.builderScene.getScene());

    // Create controller
    const controllerConfig: ModelBuilderControllerConfig | undefined = this.logger
      ? { logger: this.logger }
      : undefined;

    this.controller = new ModelBuilderController(
      this.builderScene.getScene(),
      this.builderMode,
      this.preview,
      controllerConfig
    );

    // Create panel
    this.panel = new ModelBuilderPanel(this.builderMode, this.builder);

    this.isActive = true;
    this.logger?.debug('ModelBuilderManager initialized');
  }

  /**
   * Activates Model Builder mode
   */
  activate(): void {
    if (!this.isActive) {
      this.initialize();
    }

    if (this.builderMode) {
      this.builderMode.activate();
    }

    this.logger?.debug('ModelBuilderManager activated');
  }

  /**
   * Deactivates Model Builder mode
   */
  deactivate(): void {
    if (this.builderMode) {
      this.builderMode.deactivate();
    }

    this.logger?.debug('ModelBuilderManager deactivated');
  }

  /**
   * Updates Model Builder (call each frame)
   */
  update(deltaTime: number): void {
    if (!this.isActive) return;

    if (this.builderMode) {
      this.builderMode.update(deltaTime);
    }

    if (this.visualizer) {
      this.visualizer.update(deltaTime);
    }

    if (this.panel) {
      this.panel.updateInfo();
    }
  }

  /**
   * Gets ModelBuilder instance
   */
  getBuilder(): ModelBuilder | null {
    return this.builder;
  }

  /**
   * Gets ModelBuilderScene instance
   */
  getBuilderScene(): ModelBuilderScene | null {
    return this.builderScene;
  }

  /**
   * Gets ModelBuilderMode instance
   */
  getBuilderMode(): ModelBuilderMode | null {
    return this.builderMode;
  }

  /**
   * Gets ModelBuilderController instance
   */
  getController(): ModelBuilderController | null {
    return this.controller;
  }

  /**
   * Gets ModelBuilderPanel instance
   */
  getPanel(): ModelBuilderPanel | null {
    return this.panel;
  }

  /**
   * Generates BlockDefinition from current model
   */
  generateBlockDefinition(config: {
    id: string;
    name: string;
    category: 'basic' | 'natural' | 'gameplay';
    material: 'solid' | 'glass' | 'metal' | 'wood' | 'stone' | 'plastic' | 'emissive';
  }): ReturnType<BlockDefinitionGenerator['generateFromMicroBlocks']> | null {
    if (!this.builder) return null;

    const generator = new BlockDefinitionGenerator();
    const store = this.builder.getStore();
    
    return generator.generateFromMicroBlocks(store, config);
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    this.deactivate();

    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }

    if (this.preview) {
      this.preview.dispose();
      this.preview = null;
    }

    if (this.visualizer) {
      this.visualizer.dispose();
      this.visualizer = null;
    }

    if (this.builderMode) {
      this.builderMode.dispose();
      this.builderMode = null;
    }

    if (this.builderScene) {
      this.builderScene.dispose();
      this.builderScene = null;
    }

    if (this.builder) {
      this.builder.dispose();
      this.builder = null;
    }

    if (this.controller) {
      this.controller.dispose();
      this.controller = null;
    }

    this.isActive = false;
    this.disposables.dispose();
    this.logger?.debug('ModelBuilderManager disposed');
  }
}

