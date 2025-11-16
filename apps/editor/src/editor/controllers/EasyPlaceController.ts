/**
 * EasyPlaceController - Simplified placement with single-click and patterns.
 * 
 * Features:
 * - Single-click placement (no double-click required)
 * - Pattern placement (line, grid, circle)
 * - Scroll wheel rotation
 * - Number keys for color presets
 * - Shift+Scroll for scaling
 * - Alt+Click to copy properties
 */

import type { OrbitControls } from '@engine/camera';
import type { Scene, Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { Raycaster } from '@engine/world';
import type { EditorState, EasyPlacePattern } from '../core/state';
import type { PlacementMode } from '../placement/PlacementMode';
import type { Vec3, Quat, Mat4 } from '@engine/core/math';
import { mat4Perspective, mat4LookAt } from '@engine/core/math';
import { FOV_RADIANS, Z_FAR, Z_NEAR } from '@engine/gfx-webgpu/config';
import { Logger } from '../../utils/logger';
import { PatternPlacer } from '../placement/PatternPlacer';
import type { CollisionDetector } from '../placement/CollisionDetector';
import type { PatternPosition } from '../placement/PatternPlacer';

export interface EasyPlaceControllerConfig {
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  placementMode: PlacementMode;
  collisionDetector: CollisionDetector;
  updateSceneBuffers: () => void;
  recordSnapshot: (description: string) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
}

interface PatternState {
  active: boolean;
  type: EasyPlacePattern;
  positions: PatternPosition[];
  startPosition: Vec3 | null;
  endPosition: Vec3 | null;
}

const COLOR_PRESETS: [number, number, number, number][] = [
  [1.0, 0.2, 0.2, 1.0], // 1: Red
  [0.2, 1.0, 0.2, 1.0], // 2: Green
  [0.2, 0.2, 1.0, 1.0], // 3: Blue
  [1.0, 1.0, 0.2, 1.0], // 4: Yellow
  [1.0, 0.5, 0.2, 1.0], // 5: Orange
  [0.8, 0.2, 1.0, 1.0], // 6: Purple
  [0.2, 1.0, 1.0, 1.0], // 7: Cyan
  [1.0, 1.0, 1.0, 1.0], // 8: White
  [0.5, 0.5, 0.5, 1.0], // 9: Gray
];

/**
 * Manages Easy Place mode interactions
 */
export class EasyPlaceController {
  private abortController: AbortController | null = null;
  private patternPlacer: PatternPlacer;
  private raycaster: Raycaster;
  private patternState: PatternState = {
    active: false,
    type: 'single',
    positions: [],
    startPosition: null,
    endPosition: null,
  };
  private copiedProperties: {
    color: [number, number, number, number];
    scale: Vec3;
    rotation: Quat;
  } | null = null;
  /** Flag to prevent multiple simultaneous placement operations */
  private isPlacing = false;

  constructor(private readonly config: EasyPlaceControllerConfig) {
    this.patternPlacer = new PatternPlacer(config.scene, config.collisionDetector);
    this.raycaster = new Raycaster();
  }

  /**
   * Initializes Easy Place controller
   */
  initialize(): () => void {
    this.abortController = new AbortController();
    this.setupEventHandlers();

    return () => {
      this.dispose();
    };
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    if (!this.abortController) return;

    // Single-click placement
    this.config.canvas.addEventListener(
      'click',
      (event: MouseEvent) => {
        void this.handleClick(event);
      },
      { signal: this.abortController.signal }
    );

    // Alt+Click to copy properties
    this.config.canvas.addEventListener(
      'click',
      (event: MouseEvent) => {
        if (event.altKey) {
          this.handleAltClick(event);
        }
      },
      { signal: this.abortController.signal }
    );

    // Scroll wheel for rotation
    this.config.canvas.addEventListener(
      'wheel',
      (event: WheelEvent) => this.handleWheel(event),
      { signal: this.abortController.signal, passive: false }
    );

    // Number keys for color presets
    window.addEventListener(
      'keydown',
      (event: KeyboardEvent) => this.handleNumberKey(event),
      { signal: this.abortController.signal }
    );

    // Cancel gracefully on pointercancel (touch interruptions)
    window.addEventListener(
      'pointercancel',
      (event: PointerEvent) => this.handlePointerCancel(event),
      { signal: this.abortController.signal }
    );

    // If pointer capture is lost on canvas, cancel placement to avoid stuck state
    this.config.canvas.addEventListener(
      'lostpointercapture',
      (event: PointerEvent) => this.handlePointerCancel(event),
      { signal: this.abortController.signal }
    );

    // If window loses focus, cancel any ongoing placement/pattern
    window.addEventListener(
      'blur',
      () => this.handleWindowBlur(),
      { signal: this.abortController.signal }
    );
  }

  /**
   * Handles single-click placement
   */
  private async handleClick(event: MouseEvent): Promise<void> {
    if (!this.isEasyPlaceActive()) return;
    if (!this.config.placementMode.isActive()) return;
    if (event.altKey) return; // Alt+Click is for copying

    const pattern = this.config.state.easyPlacePattern.value;

    if (pattern === 'single') {
      // Single-click placement
      this.placeSingle();
    } else {
      // Pattern placement
      await this.handlePatternClick(event);
    }
  }

  /**
   * Places a single entity
   */
  private placeSingle(): void {
    // Prevent multiple simultaneous placement operations
    if (this.isPlacing) {
      return;
    }

    this.isPlacing = true;

    try {
      // Save asset before confirmPlacement() clears the preview
      const preview = this.config.placementMode.getPreview();
      const assetToContinue = preview.asset;
      
      const placed = this.config.placementMode.confirmPlacement();
      if (placed) {
        this.config.selection.select(placed);
        this.config.updateSceneBuffers();
        this.config.recordSnapshot('Easy Place object');
        this.config.onStatusMessage?.('Object placed!', 1000);
        Logger.debug(`Easy Place: Placed ${placed.name}`);

        // Auto-continue: restart placement with same asset immediately (synchronously)
        // This allows rapid clicking without needing to reselect from hotbar
        if (assetToContinue) {
          // Restart placement synchronously so next click can immediately place again
          this.config.placementMode.startPlacement(assetToContinue);
          this.applyStoredProperties();
          // Ensure placement mode state is active for next click
          this.config.state.placementMode.value = true;
          // Reset flag immediately after restart so next click can proceed
          this.isPlacing = false;
        } else {
          this.isPlacing = false;
        }
      } else {
        this.config.onStatusMessage?.('Cannot place here (collision)', 1000);
        Logger.debug('Easy Place: Placement failed (collision)');
        this.isPlacing = false;
      }
    } catch (error) {
      Logger.error('Easy Place: Error during placement', error);
      this.isPlacing = false;
    }
  }

  /**
   * Handles pattern click
   */
  private async handlePatternClick(_event: MouseEvent): Promise<void> {
    const pattern = this.config.state.easyPlacePattern.value;
    const preview = this.config.placementMode.getPreviewEntity();
    if (!preview) return;

    const currentPosition = [...preview.transform.position] as Vec3;

    if (!this.patternState.active) {
      // First click - start pattern
      this.patternState.active = true;
      this.patternState.type = pattern;
      this.patternState.startPosition = currentPosition;
      this.config.onStatusMessage?.(`Pattern started. Click again to finish.`, 2000);
    } else {
      // Second click - finish pattern
      this.patternState.endPosition = currentPosition;
      await this.finishPattern();
    }
  }

  /**
   * Finishes pattern placement
   */
  private async finishPattern(): Promise<void> {
    const preview = this.config.placementMode.getPreviewEntity();
    if (!preview || !this.patternState.startPosition) return;

    const settings = this.config.state.easyPlaceSettings.value;
    let positions: PatternPosition[] = [];

    switch (this.patternState.type) {
      case 'line':
        if (this.patternState.endPosition) {
          positions = this.patternPlacer.generateLinePattern({
            start: this.patternState.startPosition,
            end: this.patternState.endPosition,
            spacing: settings.lineSpacing,
          });
        }
        break;

      case 'grid':
        positions = this.patternPlacer.generateGridPattern({
          center: this.patternState.startPosition,
          width: 5,
          height: 5,
          spacing: settings.gridSpacing,
        });
        break;

      case 'circle':
        positions = this.patternPlacer.generateCirclePattern({
          center: this.patternState.startPosition,
          radius: settings.circleRadius,
          count: settings.circleCount,
        });
        break;
    }

    // Validate positions
    await this.patternPlacer.validatePositions(positions, preview);

    const previewState = this.config.placementMode.getPreview();
    const baseRotation = [...preview.transform.rotation] as Quat;
    const baseScale = [...preview.transform.scale] as Vec3;
    const assetPreset = previewState.asset ?? null;

    const placed: Entity[] = [];
    for (const pos of positions) {
      if (!pos.valid) continue;
      const entity = this.config.placementMode.placeEntityFromTemplate(preview, {
        position: [...pos.position] as Vec3,
        rotation: baseRotation,
        scale: baseScale,
        asset: assetPreset,
        emitPlacementConfirmed: false,
      });
      placed.push(entity);
    }

    if (placed.length > 0) {
      this.config.selection.selectMultiple(placed, 'set');
      this.config.updateSceneBuffers();
      this.config.recordSnapshot(`Easy Place ${this.patternState.type} pattern`);
      this.config.onStatusMessage?.(
        `Placed ${placed.length} objects in ${this.patternState.type} pattern`,
        2000
      );
      Logger.debug(`Easy Place: Placed ${placed.length} in ${this.patternState.type} pattern`);
    }

    // Reset pattern state
    this.resetPatternState();

    // Exit placement mode
    this.config.placementMode.cancelPlacement();
    this.config.state.placementMode.value = false;
  }

  /**
   * Handles Alt+Click to copy properties
   */
  private handleAltClick(event: MouseEvent): void {
    if (!this.isEasyPlaceActive()) return;

    // Raycast to find entity under cursor
    const ray = this.createRayFromMouseEvent(event);
    if (!ray) {
      this.config.onStatusMessage?.('No entity found under cursor', 1000);
      return;
    }

    // Get all entities except preview entities
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => !e.userData.isPreview);

    if (entities.length === 0) {
      this.config.onStatusMessage?.('No entities in scene', 1000);
      return;
    }

    // Find closest entity hit by ray
    const hit = this.raycaster.raycastClosest(ray as any, entities);
    if (!hit || !hit.entity) {
      this.config.onStatusMessage?.('No entity found under cursor', 1000);
      return;
    }

    const entity = hit.entity as Entity;

    // Copy properties from hit entity
    this.copiedProperties = {
      color: [...entity.color] as [number, number, number, number],
      scale: [...entity.transform.scale] as Vec3,
      rotation: [...entity.transform.rotation] as Quat,
    };

    // Apply to preview if placement is active
    if (this.config.placementMode.isActive()) {
      this.applyStoredProperties();
      this.config.updateSceneBuffers();
    }

    this.config.onStatusMessage?.('Properties copied!', 1000);
    Logger.debug(`Easy Place: Copied properties from ${entity.name}`);
  }

  /**
   * Creates a ray from mouse event for raycasting
   */
  private createRayFromMouseEvent(event: MouseEvent): { origin: Vec3; direction: Vec3 } | null {
    const rect = this.config.canvas.getBoundingClientRect();
    // Calculate mouse position in canvas coordinates (accounting for canvas size vs display size)
    const canvasDisplayWidth = rect.width;
    const canvasDisplayHeight = rect.height;
    const canvasInternalWidth = this.config.canvas.width;
    const canvasInternalHeight = this.config.canvas.height;
    
    const mouseX = ((event.clientX - rect.left) / canvasDisplayWidth) * canvasInternalWidth;
    const mouseY = ((event.clientY - rect.top) / canvasDisplayHeight) * canvasInternalHeight;

    // Use orbit controls to get camera matrices
    const { yaw, pitch, distance } = this.config.controls.getState();
    const aspect = canvasInternalWidth / canvasInternalHeight;

    const projectionMatrix = new Float32Array(16) as Mat4;
    const viewMatrix = new Float32Array(16) as Mat4;

    mat4Perspective(projectionMatrix, FOV_RADIANS, aspect, Z_NEAR, Z_FAR);

    const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
    const eyeY = Math.sin(pitch) * distance;
    const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
    mat4LookAt(viewMatrix, [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);

    return this.raycaster.createRayFromScreen(
      mouseX,
      mouseY,
      canvasInternalWidth,
      canvasInternalHeight,
      viewMatrix,
      projectionMatrix
    );
  }

  /**
   * Handles wheel event for rotation/scaling
   */
  private handleWheel(event: WheelEvent): void {
    if (!this.isEasyPlaceActive()) return;
    if (!this.config.placementMode.isActive()) return;

    event.preventDefault();

    const preview = this.config.placementMode.getPreviewEntity();
    if (!preview) return;

    if (event.shiftKey) {
      // Shift+Wheel: Scale
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      const scale = preview.transform.scale;
      preview.transform.scale = [
        scale[0] * delta,
        scale[1] * delta,
        scale[2] * delta,
      ];
      const previewState = this.config.placementMode.getPreview();
      if (previewState.position) {
        void this.config.placementMode.updatePreviewPosition(previewState.position);
      }
      this.config.onStatusMessage?.(
        `Scale: ${scale[0].toFixed(2)}`,
        500
      );
    } else {
      // Wheel: Rotate
      const direction = event.deltaY > 0 ? 1 : -1;
      void this.config.placementMode.rotatePreview(direction);
      this.config.onStatusMessage?.('Rotated', 500);
    }

    this.config.updateSceneBuffers();
  }

  /**
   * Handles number keys for color presets
   */
  private handleNumberKey(event: KeyboardEvent): void {
    if (!this.isEasyPlaceActive()) return;
    if (!this.config.placementMode.isActive()) return;

    const key = event.key;
    const num = parseInt(key, 10);

    if (num >= 1 && num <= 9) {
      const preview = this.config.placementMode.getPreviewEntity();
      if (!preview) return;

      const color = COLOR_PRESETS[num - 1];
      if (color) {
        preview.color = [...color];
        if (preview.userData.baseColor) {
          preview.userData.baseColor = [...color];
        }
        this.config.onStatusMessage?.(
          `Color preset ${num} applied`,
          800
        );
        this.config.updateSceneBuffers();
      }
    }
  }

  /**
   * Applies stored properties from copy
   */
  private applyStoredProperties(): void {
    if (!this.copiedProperties) return;

    const preview = this.config.placementMode.getPreviewEntity();
    if (!preview) return;

    preview.color = [...this.copiedProperties.color];
    preview.transform.scale = [...this.copiedProperties.scale];
    preview.transform.rotation = [...this.copiedProperties.rotation];

    if (preview.userData.baseColor) {
      preview.userData.baseColor = [...this.copiedProperties.color];
    }
  }

  /**
   * Resets pattern state
   */
  private resetPatternState(): void {
    this.patternState = {
      active: false,
      type: 'single',
      positions: [],
      startPosition: null,
      endPosition: null,
    };
    this.patternPlacer.clearPreviewEntities();
  }

  /**
   * Checks if Easy Place is active
   */
  isEasyPlaceActive(): boolean {
    return this.config.state.easyPlaceMode.value;
  }

  /**
   * Updates pattern preview
   */
  async updatePatternPreview(currentPosition: Vec3): Promise<void> {
    if (!this.patternState.active) return;
    if (!this.patternState.startPosition) return;

    const preview = this.config.placementMode.getPreviewEntity();
    if (!preview) return;

    const settings = this.config.state.easyPlaceSettings.value;
    const validColor = this.config.placementMode.getConfig().validColor;
    const invalidColor = this.config.placementMode.getConfig().invalidColor;

    let positions: PatternPosition[] = [];

    switch (this.patternState.type) {
      case 'line':
        positions = this.patternPlacer.generateLinePattern({
          start: this.patternState.startPosition,
          end: currentPosition,
          spacing: settings.lineSpacing,
        });
        break;

      case 'grid':
        positions = this.patternPlacer.generateGridPattern({
          center: this.patternState.startPosition,
          width: 5,
          height: 5,
          spacing: settings.gridSpacing,
        });
        break;

      case 'circle':
        positions = this.patternPlacer.generateCirclePattern({
          center: this.patternState.startPosition,
          radius: settings.circleRadius,
          count: settings.circleCount,
        });
        break;
    }

    // Validate and create preview entities
    await this.patternPlacer.validatePositions(positions, preview);
    this.patternPlacer.createPreviewEntities(positions, preview, validColor, invalidColor);

    const validCount = this.patternPlacer.getValidCount(positions);
    this.config.onStatusMessage?.(
      `Pattern: ${validCount}/${positions.length} valid positions`,
      100
    );
  }

  /**
   * Gets pattern state
   */
  getPatternState(): PatternState {
    return { ...this.patternState };
  }

  /**
   * Cleans up resources
   */
  dispose(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.resetPatternState();
    Logger.debug('EasyPlaceController disposed');
  }

  /**
   * Handles pointer cancellation/lost capture by cancelling placement and pattern state.
   */
  private handlePointerCancel(_event: PointerEvent): void {
    if (!this.isEasyPlaceActive()) return;
    // Clear pattern state if active
    if (this.patternState.active) {
      this.resetPatternState();
    }
    // Cancel placement preview if active
    if (this.config.placementMode.isActive()) {
      this.config.placementMode.cancelPlacement(true);
    }
    // Ensure orbit controls are enabled
    this.config.controls.setEnabled(true);
    this.config.onStatusMessage?.('Placement cancelled', 800);
  }

  /**
   * Cancels on window blur to avoid stuck UI state.
   */
  private handleWindowBlur(): void {
    if (!this.isEasyPlaceActive()) return;
    if (this.patternState.active) {
      this.resetPatternState();
    }
    if (this.config.placementMode.isActive()) {
      this.config.placementMode.cancelPlacement(true);
    }
    this.config.controls.setEnabled(true);
  }
}
