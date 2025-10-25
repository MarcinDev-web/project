import { Entity } from './Entity';
import type { Scene } from './engine/scene';

/**
 * Manages selected entities in the scene.
 * Supports single and multi-selection.
 */
export class SelectionManager {
  private _selectedEntities = new Set<Entity>();
  private _callbacks: Array<(selected: ReadonlySet<Entity>) => void> = [];
  private _scene: Scene | null = null;

  /**
   * Gets all currently selected entities.
   */
  get selectedEntities(): ReadonlySet<Entity> {
    return this._selectedEntities;
  }

  /**
   * Gets the first selected entity (useful for single selection mode).
   */
  get primarySelection(): Entity | null {
    if (this._selectedEntities.size === 0) {
      return null;
    }
    const first = this._selectedEntities.values().next().value;
    return first ?? null;
  }

  /**
   * Checks if an entity is selected.
   */
  isSelected(entity: Entity): boolean {
    return this._selectedEntities.has(entity);
  }

  /**
   * Selects a single entity (clears previous selection).
   */
  select(entity: Entity): void {
    this._selectedEntities.clear();
    this._selectedEntities.add(entity);
    this.notifyChange();
  }

  /**
   * Adds an entity to the selection (multi-select).
   */
  addToSelection(entity: Entity): void {
    this._selectedEntities.add(entity);
    this.notifyChange();
  }

  /**
   * Removes an entity from the selection.
   */
  removeFromSelection(entity: Entity): void {
    this._selectedEntities.delete(entity);
    this.notifyChange();
  }

  /**
   * Toggles an entity's selection state.
   */
  toggleSelection(entity: Entity): void {
    if (this._selectedEntities.has(entity)) {
      this._selectedEntities.delete(entity);
    } else {
      this._selectedEntities.add(entity);
    }
    this.notifyChange();
  }

  /**
   * Replaces, adds to, removes from, or toggles a set of entities in the selection.
   */
  selectMultiple(entities: Entity[], mode: 'add' | 'remove' | 'toggle' | 'set' = 'set'): void {
    if (mode === 'set') {
      this._selectedEntities.clear();
      for (const e of entities) this._selectedEntities.add(e);
    } else if (mode === 'add') {
      for (const e of entities) this._selectedEntities.add(e);
    } else if (mode === 'remove') {
      for (const e of entities) this._selectedEntities.delete(e);
    } else if (mode === 'toggle') {
      for (const e of entities) {
        if (this._selectedEntities.has(e)) this._selectedEntities.delete(e);
        else this._selectedEntities.add(e);
      }
    }
    this.notifyChange();
  }

  /** Binds the scene so selectAll/selectByType can operate. */
  setScene(scene: Scene): void {
    this._scene = scene;
  }

  /** Selects all entities in the bound scene. */
  selectAll(): void {
    if (!this._scene) return;
    const all = this._scene.getAllEntities();
    this.selectMultiple(all, 'set');
  }

  /** Selects entities by mesh type in the bound scene. */
  selectByType(meshType: string): void {
    if (!this._scene) return;
    const matches = this._scene.getAllEntities().filter((e) => {
      // Type-safe comparison - meshType can be string or undefined
      return typeof e.meshType === 'string' && e.meshType === meshType;
    });
    this.selectMultiple(matches, 'set');
  }

  // Deprecated: use selectMultiple(entities, mode) above

  /**
   * Clears all selections.
   */
  clearSelection(): void {
    if (this._selectedEntities.size > 0) {
      this._selectedEntities.clear();
      this.notifyChange();
    }
  }

  /**
   * Registers a callback that will be called when selection changes.
   */
  onSelectionChanged(callback: (selected: ReadonlySet<Entity>) => void): () => void {
    this._callbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this._callbacks.indexOf(callback);
      if (index !== -1) {
        this._callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notifies all listeners that selection has changed.
   */
  private notifyChange(): void {
    for (const callback of this._callbacks) {
      callback(this._selectedEntities);
    }
  }
}

/**
 * Visual highlight information for selected entities.
 */
export interface SelectionHighlight {
  /** Whether to highlight this entity */
  enabled: boolean;
  /** Highlight color [r, g, b, a] */
  color: [number, number, number, number];
  /** Highlight intensity (0-1) */
  intensity: number;
}

/**
 * Gets highlight settings for an entity based on selection state.
 */
export function getSelectionHighlight(
  entity: Entity,
  selectionManager: SelectionManager
): SelectionHighlight {
  const isSelected = selectionManager.isSelected(entity);
  return {
    enabled: isSelected,
    color: [1.0, 0.7, 0.0, 1.0], // Orange highlight
    intensity: isSelected ? 0.3 : 0.0,
  };
}
