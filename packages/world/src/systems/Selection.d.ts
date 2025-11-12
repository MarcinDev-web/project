import { Entity } from '../core/Entity.js';
import type { Scene } from '../core/Scene.js';
/**
 * Manages selected entities in the scene.
 * Supports single and multi-selection.
 */
export declare class SelectionManager {
    private _selectedEntities;
    private _callbacks;
    private _scene;
    /**
     * Gets all currently selected entities.
     */
    get selectedEntities(): ReadonlySet<Entity>;
    /**
     * Gets the first selected entity (useful for single selection mode).
     */
    get primarySelection(): Entity | null;
    /**
     * Checks if an entity is selected.
     */
    isSelected(entity: Entity): boolean;
    /**
     * Selects a single entity (clears previous selection).
     */
    select(entity: Entity): void;
    /**
     * Adds an entity to the selection (multi-select).
     */
    addToSelection(entity: Entity): void;
    /**
     * Removes an entity from the selection.
     */
    removeFromSelection(entity: Entity): void;
    /**
     * Toggles an entity's selection state.
     */
    toggleSelection(entity: Entity): void;
    /**
     * Replaces, adds to, removes from, or toggles a set of entities in the selection.
     */
    selectMultiple(entities: Entity[], mode?: 'add' | 'remove' | 'toggle' | 'set'): void;
    /** Binds the scene so selectAll/selectByType can operate. */
    setScene(scene: Scene): void;
    /** Selects all entities in the bound scene. */
    selectAll(): void;
    /** Selects entities by mesh type in the bound scene. */
    selectByType(meshType: string): void;
    /**
     * Clears all selections.
     */
    clearSelection(): void;
    /**
     * Registers a callback that will be called when selection changes.
     */
    onSelectionChanged(callback: (selected: ReadonlySet<Entity>) => void): () => void;
    /**
     * Notifies all listeners that selection has changed.
     */
    private notifyChange;
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
export declare function getSelectionHighlight(entity: Entity, selectionManager: SelectionManager): SelectionHighlight;
//# sourceMappingURL=Selection.d.ts.map