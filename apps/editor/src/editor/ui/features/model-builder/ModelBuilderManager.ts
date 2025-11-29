/**
 * ModelBuilderManager - Orchestrates Model Builder mode in the editor
 * 
 * Integrates:
 * - ModelBuilderOverlay (UI)
 * - ModelBuilderBuildZone (scene visualization)
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
import { ModelBuilderOverlay } from './ModelBuilderOverlay';
import { ModelBuilderBuildZone } from './ModelBuilderBuildZone';
import { DisposableGroup } from '@engine/core/utils';
import { Logger } from '../../../../utils/logger';

export interface ModelBuilderManagerConfig {
  scene: Scene;
  state: EditorState;
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  onModeChanged?: (active: boolean) => void;
}

/**
 * Manages the Model Builder editing mode
 */
export class ModelBuilderManager {
  private readonly config: ModelBuilderManagerConfig;
  private readonly disposables = new DisposableGroup();
  
  // Core components
  private builder: ModelBuilder | null = null;
  private builderMode: ModelBuilderMode | null = null;
  private controller: ModelBuilderController | null = null;
  private preview: MicroBlockPreview | null = null;
  
  // UI components
  private overlay: ModelBuilderOverlay | null = null;
  private buildZone: ModelBuilderBuildZone | null = null;
  
  private isActive = false;
  private updateInterval: number | null = null;

  constructor(config: ModelBuilderManagerConfig) {
    this.config = config;
    this.setupReactivity();
  }

  /**
   * Sets up reactive state listeners
   */
  private setupReactivity(): void {
    // Listen to ModelBuilderActive state
    const disposer = effect(() => {
      const active = this.config.state.ModelBuilderActive.value;
      if (active && !this.isActive) {
        this.activate();
      } else if (!active && this.isActive) {
        this.deactivate();
      }
    });
    this.disposables.add(disposer);
  }

  /**
   * Activates Model Builder mode
   */
  activate(): void {
    if (this.isActive) return;

    Logger.info('[ModelBuilderManager] Activating Model Builder mode');

    // Get bounds from state
    const stateBounds = this.config.state.ModelBuilderBounds.value;
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
    this.buildZone = new ModelBuilderBuildZone(this.config.scene, {
      min: stateBounds.min,
      max: stateBounds.max,
      position: stateBounds.position,
    });
    this.buildZone.show();

    // Create UI overlay
    this.overlay = new ModelBuilderOverlay({
      state: this.config.state,
      builderMode: this.builderMode,
      builder: this.builder,
      onClose: () => this.config.state.ModelBuilderActive.value = false,
      onExport: () => this.exportModel(),
      onImport: () => this.importModel(),
      onClear: () => this.clearModel(),
    });
    this.overlay.mount(this.config.container);

    // Start update loop
    this.startUpdateLoop();

    this.isActive = true;
    this.config.onModeChanged?.(true);

    Logger.info('[ModelBuilderManager] Model Builder mode activated');
  }

  /**
   * Deactivates Model Builder mode
   */
  deactivate(): void {
    if (!this.isActive) return;

    Logger.info('[ModelBuilderManager] Deactivating Model Builder mode');

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

    Logger.info('[ModelBuilderManager] Model Builder mode deactivated');
  }

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Sets up keyboard handler for Model Builder shortcuts
   */
  private setupKeyboardHandler(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.isActive || !this.controller) return;

      // ESC to exit Model Builder
      if (e.key === 'Escape') {
        this.config.state.ModelBuilderActive.value = false;
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

    Logger.info('[ModelBuilderManager] Model exported');
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
          Logger.info('[ModelBuilderManager] Model imported');
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
      Logger.info('[ModelBuilderManager] Model cleared');
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
   * Checks if Model Builder is active
   */
  isModelBuilderActive(): boolean {
    return this.isActive;
  }

  /**
   * Toggles Model Builder mode
   */
  toggle(): void {
    this.config.state.ModelBuilderActive.value = !this.config.state.ModelBuilderActive.value;
  }

  /**
   * Cleans up all resources
   */
  dispose(): void {
    this.deactivate();
    this.disposables.dispose();
  }
}

