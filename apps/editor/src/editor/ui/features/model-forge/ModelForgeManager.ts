/**
 * ModelForgeManager - Orchestrates Model Forge mode in the editor
 * 
 * Integrates:
 * - ModelForgeOverlay (UI)
 * - ModelForgeBuildZone (scene visualization)
 * - ModelBuilderMode (building logic)
 * - ModelBuilderController (input handling)
 */

import { effect } from '@preact/signals-core';
import type { Scene } from '@engine/world';
import type { EditorState } from '../../../core/state';
import { ModelBuilder } from '@engine/blocks';
import type { BuildBounds } from '@engine/blocks';
import { ModelBuilderMode } from '../../../model-builder/ModelBuilderMode';
import { ModelBuilderController } from '../../../controllers/ModelBuilderController';
import { MicroBlockPreview } from '../../../model-builder/MicroBlockPreview';
import { ModelForgeOverlay } from './ModelForgeOverlay';
import { ModelForgeBuildZone } from './ModelForgeBuildZone';
import { DisposableGroup } from '@engine/core/utils';
import { Logger } from '../../../../utils/logger';

export interface ModelForgeManagerConfig {
  scene: Scene;
  state: EditorState;
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  onModeChanged?: (active: boolean) => void;
}

/**
 * Manages the Model Forge editing mode
 */
export class ModelForgeManager {
  private readonly config: ModelForgeManagerConfig;
  private readonly disposables = new DisposableGroup();
  
  // Core components
  private builder: ModelBuilder | null = null;
  private builderMode: ModelBuilderMode | null = null;
  private controller: ModelBuilderController | null = null;
  private preview: MicroBlockPreview | null = null;
  
  // UI components
  private overlay: ModelForgeOverlay | null = null;
  private buildZone: ModelForgeBuildZone | null = null;
  
  private isActive = false;
  private updateInterval: number | null = null;

  constructor(config: ModelForgeManagerConfig) {
    this.config = config;
    this.setupReactivity();
  }

  /**
   * Sets up reactive state listeners
   */
  private setupReactivity(): void {
    // Listen to modelForgeActive state
    const disposer = effect(() => {
      const active = this.config.state.modelForgeActive.value;
      if (active && !this.isActive) {
        this.activate();
      } else if (!active && this.isActive) {
        this.deactivate();
      }
    });
    this.disposables.add(disposer);
  }

  /**
   * Activates Model Forge mode
   */
  activate(): void {
    if (this.isActive) return;

    Logger.info('[ModelForgeManager] Activating Model Forge mode');

    // Get bounds from state
    const stateBounds = this.config.state.modelForgeBounds.value;
    const bounds: BuildBounds = {
      min: stateBounds.min,
      max: stateBounds.max,
    };

    // Create ModelBuilder
    this.builder = new ModelBuilder({
      bounds,
      logger: {
        debug: (...args) => Logger.debug('[ModelBuilder]', ...args),
        warn: (...args) => Logger.warn('[ModelBuilder]', ...args),
        error: (msg, err) => Logger.error(msg, err),
      },
    });

    // Create ModelBuilderMode
    this.builderMode = new ModelBuilderMode(
      {
        getScene: () => this.config.scene,
        updateCamera: () => {}, // Camera managed by editor
      } as any,
      this.builder,
      {
        enableHistory: true,
        logger: {
          debug: (...args) => Logger.debug('[ModelBuilderMode]', ...args),
          warn: (...args) => Logger.warn('[ModelBuilderMode]', ...args),
          error: (msg, err) => Logger.error(msg, err),
        },
      }
    );
    this.builderMode.activate();

    // Create preview
    this.preview = new MicroBlockPreview(this.config.scene);

    // Create controller
    this.controller = new ModelBuilderController(
      this.config.scene,
      this.builderMode,
      this.preview,
      {
        logger: {
          debug: (...args) => Logger.debug('[ModelBuilderController]', ...args),
          warn: (...args) => Logger.warn('[ModelBuilderController]', ...args),
          error: (msg, err) => Logger.error(msg, err),
        },
      }
    );

    // Setup keyboard handler for controller
    this.setupKeyboardHandler();

    // Create build zone visualization
    this.buildZone = new ModelForgeBuildZone(this.config.scene, {
      min: stateBounds.min,
      max: stateBounds.max,
      position: stateBounds.position,
    });
    this.buildZone.show();

    // Create UI overlay
    this.overlay = new ModelForgeOverlay({
      state: this.config.state,
      builderMode: this.builderMode,
      builder: this.builder,
      onClose: () => this.config.state.modelForgeActive.value = false,
      onExport: () => this.exportModel(),
      onImport: () => this.importModel(),
      onClear: () => this.clearModel(),
    });
    this.overlay.mount(this.config.container);

    // Start update loop
    this.startUpdateLoop();

    this.isActive = true;
    this.config.onModeChanged?.(true);

    Logger.info('[ModelForgeManager] Model Forge mode activated');
  }

  /**
   * Deactivates Model Forge mode
   */
  deactivate(): void {
    if (!this.isActive) return;

    Logger.info('[ModelForgeManager] Deactivating Model Forge mode');

    // Stop update loop
    this.stopUpdateLoop();

    // Cleanup UI
    this.overlay?.dispose();
    this.overlay = null;

    // Cleanup build zone
    this.buildZone?.dispose();
    this.buildZone = null;

    // Cleanup keyboard handler
    this.cleanupKeyboardHandler();

    // Cleanup controller
    this.controller?.dispose();
    this.controller = null;

    // Cleanup preview
    this.preview?.dispose();
    this.preview = null;

    // Cleanup builder mode
    this.builderMode?.deactivate();
    this.builderMode?.dispose();
    this.builderMode = null;

    // Cleanup builder
    this.builder?.dispose();
    this.builder = null;

    this.isActive = false;
    this.config.onModeChanged?.(false);

    Logger.info('[ModelForgeManager] Model Forge mode deactivated');
  }

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Sets up keyboard handler for Model Forge shortcuts
   */
  private setupKeyboardHandler(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.isActive || !this.controller) return;

      // ESC to exit Model Forge
      if (e.key === 'Escape') {
        this.config.state.modelForgeActive.value = false;
        return;
      }

      // Pass keyboard events to controller
      const handled = this.controller.handleKey(e.key, {
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      });

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Cleans up keyboard handler
   */
  private cleanupKeyboardHandler(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  /**
   * Starts the update loop
   */
  private startUpdateLoop(): void {
    let lastTime = performance.now();

    const update = () => {
      if (!this.isActive) return;

      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      // Update build zone visualization
      this.buildZone?.update(deltaTime);

      // Update block count in UI
      this.overlay?.updateBlockCount();

      this.updateInterval = requestAnimationFrame(update);
    };

    this.updateInterval = requestAnimationFrame(update);
  }

  /**
   * Stops the update loop
   */
  private stopUpdateLoop(): void {
    if (this.updateInterval !== null) {
      cancelAnimationFrame(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Exports the current model
   */
  private exportModel(): void {
    if (!this.builder) return;

    const data = this.builder.exportModel();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `model-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Logger.info('[ModelForgeManager] Model exported');
  }

  /**
   * Imports a model from file
   */
  private importModel(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file || !this.builder) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          const data = JSON.parse(json);
          this.builder?.importModel(data);
          Logger.info('[ModelForgeManager] Model imported');
        } catch (err) {
          Logger.error('Failed to import model:', err as Error);
          alert('Failed to import model');
        }
      };
      reader.readAsText(file);
    });

    input.click();
  }

  /**
   * Clears the current model
   */
  private clearModel(): void {
    if (!this.builder) return;

    if (confirm('Clear all blocks? This cannot be undone.')) {
      this.builder.clear();
      Logger.info('[ModelForgeManager] Model cleared');
    }
  }

  /**
   * Gets the current builder
   */
  getBuilder(): ModelBuilder | null {
    return this.builder;
  }

  /**
   * Gets the current builder mode
   */
  getBuilderMode(): ModelBuilderMode | null {
    return this.builderMode;
  }

  /**
   * Checks if Model Forge is active
   */
  isModelForgeActive(): boolean {
    return this.isActive;
  }

  /**
   * Toggles Model Forge mode
   */
  toggle(): void {
    this.config.state.modelForgeActive.value = !this.config.state.modelForgeActive.value;
  }

  /**
   * Cleans up all resources
   */
  dispose(): void {
    this.deactivate();
    this.disposables.dispose();
  }
}

