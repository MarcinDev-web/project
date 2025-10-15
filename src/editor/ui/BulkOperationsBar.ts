/**
 * BulkOperationsBar - Operations bar for multi-selected entities
 * 
 * Appears when multiple entities are selected, providing quick access to:
 * - Delete all
 * - Duplicate all
 * - Group
 * - Hide/Show all
 * - Lock/Unlock all
 */

import type { Entity } from '../../scene';
import { createIcon } from '../utils/icons';

export interface BulkOperationsBarConfig {
  onDelete?: (entities: Entity[]) => void;
  onDuplicate?: (entities: Entity[]) => void;
  onGroup?: (entities: Entity[]) => void;
  onHide?: (entities: Entity[]) => void;
  onShow?: (entities: Entity[]) => void;
  onLock?: (entities: Entity[]) => void;
  onUnlock?: (entities: Entity[]) => void;
  onClear?: () => void;
}

export class BulkOperationsBar {
  private readonly root: HTMLElement;
  private selectedEntities: Entity[] = [];
  private isVisible = false;

  constructor(private readonly config: BulkOperationsBarConfig) {
    this.root = document.createElement('div');
    this.root.className = 'bulk-operations-bar';
    this.root.style.display = 'none';

    this.createBar();
  }

  /**
   * Creates the operations bar UI
   */
  private createBar(): void {
    // Selection info
    const info = document.createElement('div');
    info.className = 'bulk-operations-info';
    
    const count = document.createElement('span');
    count.className = 'bulk-operations-count';
    count.id = 'bulk-operations-count';
    count.textContent = '0 selected';
    info.appendChild(count);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn-icon-sm btn-ghost';
    clearBtn.title = 'Clear selection';
    clearBtn.appendChild(createIcon('close', 14));
    clearBtn.addEventListener('click', () => {
      this.config.onClear?.();
      this.hide();
    });
    info.appendChild(clearBtn);

    this.root.appendChild(info);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bulk-operations-actions';

    // Delete
    const deleteBtn = this.createActionButton('trash', 'Delete all', () => {
      this.config.onDelete?.(this.selectedEntities);
    });
    actions.appendChild(deleteBtn);

    // Duplicate
    const duplicateBtn = this.createActionButton('copy', 'Duplicate all', () => {
      this.config.onDuplicate?.(this.selectedEntities);
    });
    actions.appendChild(duplicateBtn);

    // Group
    const groupBtn = this.createActionButton('folder', 'Group', () => {
      this.config.onGroup?.(this.selectedEntities);
    });
    actions.appendChild(groupBtn);

    // Separator
    const separator = document.createElement('div');
    separator.className = 'bulk-operations-separator';
    actions.appendChild(separator);

    // Hide
    const hideBtn = this.createActionButton('eye-off', 'Hide all', () => {
      this.config.onHide?.(this.selectedEntities);
    });
    actions.appendChild(hideBtn);

    // Show
    const showBtn = this.createActionButton('eye', 'Show all', () => {
      this.config.onShow?.(this.selectedEntities);
    });
    actions.appendChild(showBtn);

    // Lock
    const lockBtn = this.createActionButton('lock', 'Lock all', () => {
      this.config.onLock?.(this.selectedEntities);
    });
    actions.appendChild(lockBtn);

    // Unlock
    const unlockBtn = this.createActionButton('unlock', 'Unlock all', () => {
      this.config.onUnlock?.(this.selectedEntities);
    });
    actions.appendChild(unlockBtn);

    this.root.appendChild(actions);
  }

  /**
   * Creates an action button
   */
  private createActionButton(
    icon: string,
    tooltip: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-icon-sm btn-ghost bulk-operations-btn';
    btn.title = tooltip;
    btn.appendChild(createIcon(icon as any, 16));
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * Updates the bar with current selection
   */
  update(entities: Entity[]): void {
    this.selectedEntities = entities;
    
    const count = entities.length;
    const countEl = this.root.querySelector('#bulk-operations-count');
    if (countEl) {
      countEl.textContent = `${count} ${count === 1 ? 'entity' : 'entities'} selected`;
    }

    if (count > 1) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Shows the bar
   */
  show(): void {
    this.root.style.display = 'flex';
    this.isVisible = true;
    
    // Animate in
    requestAnimationFrame(() => {
      this.root.classList.add('visible');
    });
  }

  /**
   * Hides the bar
   */
  hide(): void {
    this.root.classList.remove('visible');
    this.isVisible = false;
    
    setTimeout(() => {
      if (!this.isVisible) {
        this.root.style.display = 'none';
      }
    }, 200);
  }

  /**
   * Gets the root element
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Mounts the bar to a parent element
   */
  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    this.hide();
    this.root.remove();
  }
}

