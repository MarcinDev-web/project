/**
 * EditorVisualManager - Manages visual editor elements:
 * - Grid rendering
 * - Gizmo overlay
 * - Selection visuals
 *
 * Extracted from EditorUI to reduce complexity.
 */

import type { Scene } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { Renderer } from '@engine/gfx-webgpu/index';
import { GridRenderer } from '../grid/GridRenderer';
import { GizmoController } from '../controllers/GizmoController';
import type { SnapSystem } from '../snap/SnapSystem';
import { applySelectionVisuals } from './SelectionVisuals';
import { DisposableGroup } from '../core/DisposableGroup';
import { effect } from '@preact/signals-core';
import { Logger } from '../../utils/logger';
import type { Vec3 } from '@engine/core/math';

export interface EditorVisualManagerConfig {
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  canvas: HTMLCanvasElement;
  snapSystem: SnapSystem | null;
  getRenderer: () => Renderer | null;
  projectWorldToScreen: (world: Vec3) => { x: number; y: number } | null;
  updateSceneBuffers: () => void;
  setControlsEnabled: (enabled: boolean) => void;
}

/**
 * Manages visual editor overlays and effects.
 */
export class EditorVisualManager {
  private readonly disposables = new DisposableGroup();

  private gridRenderer: GridRenderer | null = null;
  private gizmoController: GizmoController | null = null;
  private animationFrameHandle: number | null = null;

  constructor(private readonly config: EditorVisualManagerConfig) {}

  /**
   * Initializes all visual components.
   */
  async initialize(): Promise<void> {
    // Initialize gizmo controller first so DOM is ready immediately for tests
    this.initializeGizmoController();

    // Initialize grid renderer (may await renderer availability)
    await this.initializeGridRenderer();

    // Setup reactive updates AFTER grid renderer is initialized
    this.setupReactivity();

    // Start animation loop for gizmo updates
    this.startAnimationLoop();
  }

  /**
   * Initializes the grid renderer with WebGPU device.
   */
  private async initializeGridRenderer(): Promise<void> {
    // Create grid renderer instance
    this.gridRenderer = new GridRenderer(this.config.state.gridConfig.value);

    // Wait for renderer to be available then initialize
    const waitForRenderer = async (): Promise<void> => {
      const maxAttempts = 50; // 5 seconds max
      for (let i = 0; i < maxAttempts; i++) {
        if (this.disposables.isDisposed()) {
          return; // Abort if manager disposed during wait
        }
        const renderer = this.config.getRenderer();
        if (renderer) {
          try {
            // Initialize grid renderer with device
            const grid = this.gridRenderer;
            if (!grid) return; // Disposed while awaiting
            await renderer.initializeGridRenderer(grid);
            return;
          } catch (error) {
            Logger.error('GridRenderer initialization failed:', error);
            this.gridRenderer = null;
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.warn('GridRenderer: Renderer not available after timeout');
      this.gridRenderer = null;
    };

    await waitForRenderer();

    // Cleanup grid renderer on dispose
    this.disposables.add(() => {
      if (this.gridRenderer) {
        this.gridRenderer.dispose();
        this.gridRenderer = null;
      }
    });
  }

  /**
   * Initializes the gizmo controller.
   */
  private initializeGizmoController(): void {
    this.gizmoController = new GizmoController({
      state: this.config.state,
      selection: this.config.selection,
      canvas: this.config.canvas,
      projectWorldToScreen: this.config.projectWorldToScreen,
      snapSystem: this.config.snapSystem,
      updateSceneBuffers: this.config.updateSceneBuffers,
      setControlsEnabled: this.config.setControlsEnabled,
    });

    this.gizmoController.mount();

    // Cleanup gizmo on dispose
    this.disposables.add(() => {
      this.gizmoController?.dispose();
      this.gizmoController = null;
    });
  }

  /**
   * Sets up reactive bindings for visual updates.
   */
  private setupReactivity(): void {
    // React to grid config changes
    const gridConfigEffect = effect(() => {
      if (this.gridRenderer && this.config.state) {
        this.gridRenderer.setConfig(this.config.state.gridConfig.value);
      }
    });
    this.disposables.add(() => gridConfigEffect());

    // React to grid visibility changes
    const gridVisibilityEffect = effect(() => {
      if (this.gridRenderer && this.config.state) {
        this.gridRenderer.setVisible(this.config.state.showGrid.value);
      }
    });
    this.disposables.add(() => gridVisibilityEffect());

    // Sync snap increment with grid cell size
    const snapSyncEffect = effect(() => {
      if (this.config.snapSystem && this.config.state) {
        const cellSize = this.config.state.gridConfig.value.cellSize;
        this.config.snapSystem.syncSnapToGrid(cellSize);
      }
    });
    this.disposables.add(() => snapSyncEffect());

    // Apply selection visuals on selection change
    const selectionEffect = effect(() => {
      if (this.config.state) {
        // Read selection signal to trigger effect
        void this.config.state.selectedEntity.value;
        this.applySelectionVisuals();
      }
    });
    this.disposables.add(() => selectionEffect());
  }

  /**
   * Starts the animation loop for gizmo updates.
   */
  private startAnimationLoop(): void {
    if (this.animationFrameHandle !== null) {
      return;
    }

    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);

    const cancelRaf = typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : (handle: number) => window.clearTimeout(handle);

    const tick = () => {
      this.updateGizmoOverlay();
      this.animationFrameHandle = raf(tick);
    };
    this.animationFrameHandle = raf(tick);

    // Cleanup animation loop on dispose
    this.disposables.add(() => {
      if (this.animationFrameHandle !== null) {
        cancelRaf(this.animationFrameHandle);
        this.animationFrameHandle = null;
      }
    });
  }

  /**
   * Updates the gizmo overlay position and visibility.
   */
  updateGizmoOverlay(): void {
    this.gizmoController?.updateOverlay();
  }

  /**
   * Applies selection visual effects to entities.
   */
  applySelectionVisuals(): void {
    applySelectionVisuals(this.config.scene, this.config.selection);
    this.config.updateSceneBuffers();
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);
    raf(() => this.updateGizmoOverlay());
  }

  /**
   * Gets the grid renderer instance.
   */
  getGridRenderer(): GridRenderer | null {
    return this.gridRenderer;
  }

  /**
   * Gets the gizmo controller instance.
   */
  getGizmoController(): GizmoController | null {
    return this.gizmoController;
  }

  /**
   * Checks if visuals are initialized.
   */
  isInitialized(): boolean {
    return this.gridRenderer !== null && this.gizmoController !== null;
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    this.disposables.dispose();

    // Additional cleanup
    this.gridRenderer = null;
    this.gizmoController = null;
  }
}
