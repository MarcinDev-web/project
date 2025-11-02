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
import type { Scene } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState, EasyPlacePattern } from '../core/state';
import type { PlacementMode } from '../placement/PlacementMode';
import type { Vec3, Quat } from '@engine/core/math';
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

  constructor(private readonly config: EasyPlaceControllerConfig) {
    this.patternPlacer = new PatternPlacer(config.scene, config.collisionDetector);
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
      (event: MouseEvent) => this.handleClick(event),
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
  private handleClick(event: MouseEvent): void {
    if (!this.isEasyPlaceActive()) return;
    if (!this.config.placementMode.isActive()) return;
    if (event.altKey) return; // Alt+Click is for copying

    const pattern = this.config.state.easyPlacePattern.value;

    if (pattern === 'single') {
      // Single-click placement
      this.placeSingle();
    } else {
      // Pattern placement
      this.handlePatternClick(event);
    }
  }

  /**
   * Places a single entity
   */
  private placeSingle(): void {
    const placed = this.config.placementMode.confirmPlacement();
    if (placed) {
      this.config.selection.select(placed);
      this.config.updateSceneBuffers();
      this.config.recordSnapshot('Easy Place object');
      this.config.onStatusMessage?.('Object placed!', 1000);
      Logger.debug(`Easy Place: Placed ${placed.name}`);

      // Auto-continue: restart placement with same asset
      const preview = this.config.placementMode.getPreview();
      if (preview.asset) {
        setTimeout(() => {
          this.config.placementMode.startPlacement(preview.asset!);
          this.applyStoredProperties();
        }, 10);
      }
    } else {
      this.config.onStatusMessage?.('Cannot place here (collision)', 1000);
      Logger.debug('Easy Place: Placement failed (collision)');
    }
  }

  /**
   * Handles pattern click
   */
  private handlePatternClick(_event: MouseEvent): void {
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
      this.finishPattern();
    }
  }

  /**
   * Finishes pattern placement
   */
  private finishPattern(): void {
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
    void this.patternPlacer.validatePositions(positions, preview);

    // Place entities
    const placed = this.patternPlacer.placeEntities(positions, preview);

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
  private handleAltClick(_event: MouseEvent): void {
    if (!this.isEasyPlaceActive()) return;

    // Raycast to find entity under cursor
    // TODO: Implement raycasting to get entity
    this.config.onStatusMessage?.('Property copy not yet implemented', 1000);
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
  updatePatternPreview(currentPosition: Vec3): void {
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
    void this.patternPlacer.validatePositions(positions, preview);
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
