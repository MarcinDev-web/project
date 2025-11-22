import type { Scene, Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { Renderer } from '@engine/gfx-webgpu/index';
import { GridRenderer } from '../grid/GridRenderer';
import { GizmoController } from '../controllers/GizmoController';
import type { SnapSystem } from '@engine/editor-utils';
import { SelectionVisualController } from './SelectionVisualController';
import { DisposableGroup } from '@engine/core/utils';
import { effect } from '@preact/signals-core';
import { Logger } from '../../utils/logger';
import type { Vec3, Ray } from '@engine/core/math';

export interface EditorVisualManagerConfig {
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  canvas: HTMLCanvasElement;
  snapSystem: SnapSystem | null;
  getRenderer: () => Renderer | null;
  projectWorldToScreen: (world: Vec3) => { x: number; y: number } | null;
  getRayFromScreen: (x: number, y: number) => Ray;
  getCameraPosition?: () => Vec3;
  getCameraRotation?: () => import('@engine/core/math').Quat;
  updateSceneBuffers: () => void;
  setControlsEnabled: (enabled: boolean) => void;
  /** Called when transform changes (for replication) */
  onTransformChanged?: (entity: Entity) => void;
  /** Optional provider for remote cursors (for collaboration camera markers) */
  getRemoteCursors?: () => Map<string, {
    userId: string;
    user: { id: string; email: string };
    position: Vec3;
    rotation?: [number, number, number, number];
    color: string;
  }>; 
}

/**
 * Manages visual editor overlays and effects.
 */
export class EditorVisualManager {
  private readonly disposables = new DisposableGroup();

  private gridRenderer: GridRenderer | null = null;
  private gizmoController: GizmoController | null = null;
  private selectionController: SelectionVisualController;
  private animationFrameHandle: number | null = null;
  
  // Remote camera markers overlay
  private remoteOverlayRoot: HTMLElement | null = null;
  private remoteMarkers = new Map<string, HTMLElement>();

  constructor(private readonly config: EditorVisualManagerConfig) {
    this.selectionController = new SelectionVisualController(
      config.scene,
      config.selection,
      config.updateSceneBuffers
    );
    this.disposables.add(() => this.selectionController.dispose());
  }

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

    // Initialize remote cursors overlay
    this.initializeRemoteOverlay();

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
      scene: this.config.scene,
      projectWorldToScreen: this.config.projectWorldToScreen,
      // getRay removed - handled by InteractionManager
      getCameraPosition: this.config.getCameraPosition,
      getCameraRotation: this.config.getCameraRotation,
      snapSystem: this.config.snapSystem,
      updateSceneBuffers: this.config.updateSceneBuffers,
      setControlsEnabled: this.config.setControlsEnabled,
      onTransformChanged: this.config.onTransformChanged,
    });

    // Note: GizmoController is now an InteractionTool and registered by EditorUI.
    // We don't call mount() anymore.

    // Cleanup gizmo on dispose
    this.disposables.add(() => {
      this.gizmoController?.dispose();
      this.gizmoController = null;
    });
  }

  /** Initialize DOM overlay for remote cursor/camera markers */
  private initializeRemoteOverlay(): void {
    if (typeof document === 'undefined') return;
    if (this.remoteOverlayRoot) return;

    const root = document.createElement('div');
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '999';
    document.body.appendChild(root);
    this.remoteOverlayRoot = root;

    // Cleanup on dispose
    this.disposables.add(() => {
      if (this.remoteOverlayRoot && this.remoteOverlayRoot.parentNode) {
        this.remoteOverlayRoot.parentNode.removeChild(this.remoteOverlayRoot);
      }
      this.remoteOverlayRoot = null;
      this.remoteMarkers.clear();
    });
  }

  /** Update remote cursor markers each frame */
  private updateRemoteCursorsOverlay(): void {
    if (!this.remoteOverlayRoot || !this.config.getRemoteCursors) return;

    const cursors = this.config.getRemoteCursors();
    if (!cursors || cursors.size === 0) {
      // Hide all existing markers
      for (const el of this.remoteMarkers.values()) {
        el.style.display = 'none';
      }
      return;
    }

    const rect = this.config.canvas.getBoundingClientRect();

    // Track which markers were updated to hide stale ones
    const updated = new Set<string>();

    for (const [userId, cursor] of cursors.entries()) {
      // Project world to screen
      const screen = this.config.projectWorldToScreen(cursor.position);
      let el = this.remoteMarkers.get(userId);
      if (!el) {
        el = this.createRemoteMarker(cursor.user.email, cursor.color);
        this.remoteOverlayRoot.appendChild(el);
        this.remoteMarkers.set(userId, el);
      }
      updated.add(userId);

      if (!screen) {
        el.style.display = 'none';
        continue;
      }

      el.style.display = 'flex';
      el.style.transform = `translate(${Math.round(rect.left + screen.x)}px, ${Math.round(rect.top + screen.y)}px)`;
    }

    // Hide markers for users not in this frame
    for (const [userId, el] of this.remoteMarkers.entries()) {
      if (!updated.has(userId)) {
        el.style.display = 'none';
      }
    }
  }

  private createRemoteMarker(label: string, color: string): HTMLElement {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.transform = 'translate(-50%, -100%)';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '6px';
    container.style.pointerEvents = 'none';

    const dot = document.createElement('div');
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.background = color || '#4a9eff';
    dot.style.boxShadow = '0 0 6px rgba(0,0,0,0.4)';

    const text = document.createElement('div');
    text.textContent = label;
    text.style.fontSize = '11px';
    text.style.fontWeight = '600';
    text.style.padding = '2px 6px';
    text.style.borderRadius = '4px';
    text.style.background = 'rgba(0,0,0,0.6)';
    text.style.color = '#fff';
    text.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';

    container.appendChild(dot);
    container.appendChild(text);
    return container;
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

    // Sync transform space with gizmo controller
    const transformSpaceEffect = effect(() => {
      if (this.gizmoController && this.config.state) {
        this.gizmoController.setTransformSpace(this.config.state.transformSpace.value);
      }
    });
    this.disposables.add(() => transformSpaceEffect());
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
      this.updateRemoteCursorsOverlay();
      
      if (this.gizmoController) {
        this.selectionController.setDragging(this.gizmoController.isDragging());
      }

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
    this.selectionController.refresh();
    
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
