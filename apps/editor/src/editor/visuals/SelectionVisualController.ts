import { Entity, Scene, SelectionManager } from '@engine/world';
import { RgbaColor } from '../../utils/colors';

const HIGHLIGHT_BOOST = 0.3;
const SELECTION_TINT: RgbaColor = [1.0, 0.8, 0.2, 1.0]; // Gold/Orange tint
const TINT_STRENGTH = 0.3;

export class SelectionVisualController {
  private readonly cleanupCallbacks: Array<() => void> = [];
  private previousSelection = new Set<Entity>();
  private initializedEntities = new WeakSet<Entity>();
  private isDragging = false;

  constructor(
    private readonly scene: Scene,
    private readonly selection: SelectionManager,
    private readonly updateSceneBuffers: () => void
  ) {
    this.cleanupCallbacks.push(
      this.selection.onSelectionChanged(this.handleSelectionChange.bind(this))
    );
  }

  public setDragging(dragging: boolean): void {
    if (this.isDragging === dragging) return;
    this.isDragging = dragging;
    this.refresh();
  }

  /**
   * Handles selection changes efficiently by only updating affected entities.
   */
  private handleSelectionChange(currentSelection: ReadonlySet<Entity>): void {
    // 1. Identify deselected entities (in previous but not in current)
    for (const entity of this.previousSelection) {
      if (!currentSelection.has(entity)) {
        this.removeHighlight(entity);
      }
    }

    // 2. Identify newly selected entities (in current but not in previous)
    for (const entity of currentSelection) {
      if (!this.previousSelection.has(entity)) {
        this.applyHighlight(entity);
      }
    }

    // 3. Update previous selection set
    this.previousSelection = new Set(currentSelection);

    // 4. Trigger buffer update
    this.updateSceneBuffers();
  }

  /**
   * Applies the visual highlight to an entity.
   */
  private applyHighlight(entity: Entity): void {
    this.ensureBaseColorStored(entity);

    if (this.isDragging) {
      this.removeHighlight(entity);
      return;
    }

    if (!entity.color) return;

    const baseColor = entity.userData.baseColor as RgbaColor;
    
    // Blend base color with tint
    // result = base * (1 - strength) + tint * strength
    // OR just add boost for brightness
    
    // Method 1: Brightness boost (Simple, used previously)
    // entity.color = [
    //   Math.min(1, baseColor[0] + HIGHLIGHT_BOOST),
    //   Math.min(1, baseColor[1] + HIGHLIGHT_BOOST),
    //   Math.min(1, baseColor[2] + HIGHLIGHT_BOOST),
    //   baseColor[3]
    // ];

    // Method 2: Tint (More visible on white objects)
    entity.color = [
      Math.min(1, baseColor[0] * (1 - TINT_STRENGTH) + SELECTION_TINT[0] * TINT_STRENGTH + HIGHLIGHT_BOOST * 0.1),
      Math.min(1, baseColor[1] * (1 - TINT_STRENGTH) + SELECTION_TINT[1] * TINT_STRENGTH + HIGHLIGHT_BOOST * 0.1),
      Math.min(1, baseColor[2] * (1 - TINT_STRENGTH) + SELECTION_TINT[2] * TINT_STRENGTH + HIGHLIGHT_BOOST * 0.1),
      baseColor[3]
    ];
  }

  /**
   * Restores the original visual state of an entity.
   */
  private removeHighlight(entity: Entity): void {
    if (!entity.userData.baseColor) return;

    // Restore exact base color
    const base = entity.userData.baseColor as RgbaColor;
    entity.color = [base[0], base[1], base[2], base[3]];
  }

  /**
   * Ensures the entity has its base color stored in userData.
   */
  private ensureBaseColorStored(entity: Entity): void {
    // If we already have it, check if we need to update it (only if not currently selected)
    // If currently selected, we assume userData.baseColor is the "true" color.
    
    if (entity.userData.baseColor) return;

    // Store current color as base
    // Default to white if no color
    const currentColor = entity.color ?? [1, 1, 1, 1];
    entity.userData.baseColor = [
        currentColor[0],
        currentColor[1],
        currentColor[2],
        currentColor[3]
    ];

    if (!entity.color) {
        entity.color = [1, 1, 1, 1];
    }
  }

  /**
   * Force refresh of all selection visuals (useful if external changes happened).
   */
  public refresh(): void {
    const current = this.selection.selectedEntities;
    
    // Re-apply to all selected
    for (const entity of current) {
        // We might want to re-capture base color here if we suspect it changed?
        // But if we do, we might capture the highlighted color.
        // Safer to just re-apply highlight.
        this.applyHighlight(entity);
    }
    
    this.handleSelectionChange(current);
  }

  public dispose(): void {
    // Restore all colors before disposing
    for (const entity of this.previousSelection) {
      this.removeHighlight(entity);
    }
    
    this.cleanupCallbacks.forEach(cb => cb());
    this.cleanupCallbacks.length = 0;
  }
}

