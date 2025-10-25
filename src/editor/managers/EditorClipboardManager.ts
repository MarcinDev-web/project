/**
 * EditorClipboardManager - Manages clipboard operations for entities.
 * 
 * Responsibilities:
 * - Copy selected entities to clipboard
 * - Cut entities (copy + delete)
 * - Paste entities from clipboard
 * - Duplicate selected entities
 * - Handle multi-entity operations
 * 
 * Extracted from EditorUI to reduce complexity and improve maintainability.
 */

import type { Scene, Entity } from '../../engine/scene';
import type { SelectionManager } from '../../scene/Selection';
import type { EditorState } from '../core/state';
import { Clipboard } from '../utils/Clipboard';
import { Logger } from '../../app/utils/logger';

export interface EditorClipboardManagerConfig {
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  updateSceneBuffers: () => void;
  recordSnapshot: (description: string) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
}

/**
 * Manages clipboard operations for the editor.
 */
export class EditorClipboardManager {
  private clipboard: Clipboard;

  constructor(private readonly config: EditorClipboardManagerConfig) {
    this.clipboard = new Clipboard();
  }

  /**
   * Gets the clipboard instance (for external use if needed).
   */
  getClipboard(): Clipboard {
    return this.clipboard;
  }

  /**
   * Copies selected entities to clipboard.
   */
  copy(): void {
    const selected = Array.from(this.config.selection.selectedEntities);
    
    if (selected.length === 0) {
      Logger.debug('No entities selected to copy');
      return;
    }

    try {
      this.clipboard.copy(selected);
      this.config.onStatusMessage?.(
        `Copied ${selected.length} entity(ies)`,
        1500
      );
      Logger.debug(`Copied ${selected.length} entities to clipboard`);
    } catch (error) {
      Logger.error('Failed to copy entities:', error as Error);
      this.config.onStatusMessage?.('Failed to copy entities', 2000);
    }
  }

  /**
   * Cuts selected entities (copies then deletes).
   */
  cut(): void {
    if (this.config.state.editorMode.value === 'play') {
      this.config.onStatusMessage?.('Cannot cut in play mode', 1500);
      return;
    }

    const selected = Array.from(this.config.selection.selectedEntities);
    
    if (selected.length === 0) {
      Logger.debug('No entities selected to cut');
      return;
    }

    try {
      // Copy to clipboard first
      this.clipboard.copy(selected);

      // Remove from scene
      for (const entity of selected) {
        this.config.scene.removeEntity(entity);
      }

      // Update and clear selection
      this.config.updateSceneBuffers();
      this.config.selection.clearSelection();

      // Record in history
      this.config.recordSnapshot('Cut entities');

      this.config.onStatusMessage?.(
        `Cut ${selected.length} entity(ies)`,
        1500
      );
      Logger.debug(`Cut ${selected.length} entities`);
    } catch (error) {
      Logger.error('Failed to cut entities:', error as Error);
      this.config.onStatusMessage?.('Failed to cut entities', 2000);
    }
  }

  /**
   * Pastes entities from clipboard.
   */
  paste(): void {
    if (this.config.state.editorMode.value === 'play') {
      this.config.onStatusMessage?.('Cannot paste in play mode', 1500);
      return;
    }

    try {
      const pasted = this.clipboard.paste(this.config.scene);

      if (pasted.length === 0) {
        Logger.debug('Nothing to paste (clipboard empty)');
        this.config.onStatusMessage?.('Clipboard is empty', 1500);
        return;
      }

      // Update scene and select pasted entities
      this.config.selection.selectMultiple(pasted, 'set');
      this.config.updateSceneBuffers();

      // Record in history
      this.config.recordSnapshot('Paste');

      this.config.onStatusMessage?.(
        `Pasted ${pasted.length} entity(ies)`,
        1500
      );
      Logger.debug(`Pasted ${pasted.length} entities`);
    } catch (error) {
      Logger.error('Failed to paste entities:', error as Error);
      this.config.onStatusMessage?.('Failed to paste entities', 2000);
    }
  }

  /**
   * Duplicates selected entities (copy + paste with offset).
   */
  duplicate(): void {
    if (this.config.state.editorMode.value === 'play') {
      this.config.onStatusMessage?.('Cannot duplicate in play mode', 1500);
      return;
    }

    const selected = Array.from(this.config.selection.selectedEntities);
    
    if (selected.length === 0) {
      Logger.debug('No entities selected to duplicate');
      return;
    }

    try {
      // Copy to clipboard
      this.clipboard.copy(selected);

      // Paste immediately
      const duplicated = this.clipboard.paste(this.config.scene);

      if (duplicated.length === 0) {
        Logger.warn('Duplication failed: paste returned no entities');
        return;
      }

      // Offset duplicated entities slightly to avoid exact overlap
      const DUPLICATE_OFFSET = 0.5;
      for (const entity of duplicated) {
        const pos = entity.transform.position;
        entity.transform.position = [
          Number.isFinite(pos[0]) ? pos[0] + DUPLICATE_OFFSET : DUPLICATE_OFFSET,
          Number.isFinite(pos[1]) ? pos[1] : 0,
          Number.isFinite(pos[2]) ? pos[2] + DUPLICATE_OFFSET : DUPLICATE_OFFSET,
        ];
      }

      // Update scene and select duplicated entities
      this.config.selection.selectMultiple(duplicated, 'set');
      this.config.updateSceneBuffers();

      // Record in history
      this.config.recordSnapshot('Duplicate');

      this.config.onStatusMessage?.(
        `Duplicated ${duplicated.length} entity(ies)`,
        1500
      );
      Logger.debug(`Duplicated ${duplicated.length} entities`);
    } catch (error) {
      Logger.error('Failed to duplicate entities:', error as Error);
      this.config.onStatusMessage?.('Failed to duplicate entities', 2000);
    }
  }

  /**
   * Selects all entities in the scene.
   */
  selectAll(): void {
    const allEntities: Entity[] = [];
    this.config.scene.traverse((entity) => {
      allEntities.push(entity);
    });

    if (allEntities.length === 0) {
      Logger.debug('No entities in scene to select');
      return;
    }

    try {
      // Select first entity as primary, add rest to selection
      this.config.selection.select(allEntities[0]!);
      for (let i = 1; i < allEntities.length; i++) {
        this.config.selection.addToSelection(allEntities[i]!);
      }

      this.config.onStatusMessage?.(
        `Selected ${allEntities.length} entity(ies)`,
        1500
      );
      Logger.debug(`Selected all ${allEntities.length} entities`);
    } catch (error) {
      Logger.error('Failed to select all entities:', error as Error);
    }
  }

  /**
   * Checks if clipboard has content.
   */
  hasContent(): boolean {
    // Note: Clipboard doesn't expose its internal state,
    // so we can't check directly. This is a limitation to address.
    return true; // Assume clipboard might have content
  }

  /**
   * Clears the clipboard.
   */
  clear(): void {
    // Note: Clipboard doesn't have a clear method.
    // We can create a new instance or add clear() to Clipboard.
    this.clipboard = new Clipboard();
    Logger.debug('Clipboard cleared');
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    this.clear();
  }
}

