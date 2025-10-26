/**
 * EntityContextMenu - Context menu for entity operations in the outliner
 * 
 * Features:
 * - Duplicate, delete, rename, focus operations
 * - Copy entity path
 * - Group/ungroup entities
 * - Isolate entity (hide others)
 * - Multi-entity support
 */

import type { Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { createIcon } from '../utils/icons';

export interface EntityContextMenuConfig {
  selection: SelectionManager;
  onDuplicate?: (entities: Entity[]) => void;
  onDelete?: (entities: Entity[]) => void;
  onRename?: (entity: Entity) => void;
  onFocus?: (entity: Entity) => void;
  onGroup?: (entities: Entity[]) => void;
  onIsolate?: (entity: Entity) => void;
  onCopyPath?: (entity: Entity) => void;
}

interface ContextMenuItem {
  icon: string;
  label: string;
  action: () => void;
  separator?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

export class EntityContextMenu {
  private menu: HTMLElement | null = null;
  private targetEntity: Entity | null = null;
  private isVisible = false;

  constructor(private readonly config: EntityContextMenuConfig) {}

  /**
   * Shows the context menu for a specific entity
   */
  show(entity: Entity, x: number, y: number): void {
    this.targetEntity = entity;
    
    if (this.menu) {
      this.hide();
    }

    this.menu = this.createMenu();
    this.positionMenu(x, y);
    document.body.appendChild(this.menu);
    this.isVisible = true;

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (this.menu && !this.menu.contains(e.target as Node)) {
        this.hide();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  /**
   * Hides the context menu
   */
  hide(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
      this.isVisible = false;
      this.targetEntity = null;
    }
  }

  /**
   * Creates the menu element
   */
  private createMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'entity-context-menu';
    menu.setAttribute('role', 'menu');

    const selectedEntities = this.config.selection.selectedEntities;
    const isMultiSelect = selectedEntities.length > 1;

    const items: ContextMenuItem[] = [];

    // Focus (single entity only)
    if (!isMultiSelect && this.targetEntity) {
      items.push({
        icon: 'camera',
        label: 'Focus',
        action: () => {
          if (this.targetEntity) {
            this.config.onFocus?.(this.targetEntity);
          }
          this.hide();
        },
        shortcut: 'F',
      });
    }

    // Rename (single entity only)
    if (!isMultiSelect && this.targetEntity) {
      items.push({
        icon: 'edit',
        label: 'Rename',
        action: () => {
          if (this.targetEntity) {
            this.config.onRename?.(this.targetEntity);
          }
          this.hide();
        },
        shortcut: 'F2',
      });
    }

    // Separator
    items.push({
      icon: '',
      label: '',
      action: () => {},
      separator: true,
    });

    // Duplicate
    items.push({
      icon: 'copy',
      label: isMultiSelect ? `Duplicate ${selectedEntities.length} Entities` : 'Duplicate',
      action: () => {
        this.config.onDuplicate?.(selectedEntities);
        this.hide();
      },
      shortcut: 'Ctrl+D',
    });

    // Delete
    items.push({
      icon: 'trash',
      label: isMultiSelect ? `Delete ${selectedEntities.length} Entities` : 'Delete',
      action: () => {
        this.config.onDelete?.(selectedEntities);
        this.hide();
      },
      shortcut: 'Del',
    });

    // Separator
    items.push({
      icon: '',
      label: '',
      action: () => {},
      separator: true,
    });

    // Group (multi-select only)
    if (isMultiSelect) {
      items.push({
        icon: 'folder',
        label: 'Group Selected',
        action: () => {
          this.config.onGroup?.(selectedEntities);
          this.hide();
        },
        shortcut: 'Ctrl+G',
      });
    }

    // Isolate (single entity only)
    if (!isMultiSelect && this.targetEntity) {
      items.push({
        icon: 'eye',
        label: 'Isolate',
        action: () => {
          if (this.targetEntity) {
            this.config.onIsolate?.(this.targetEntity);
          }
          this.hide();
        },
      });
    }

    // Separator
    items.push({
      icon: '',
      label: '',
      action: () => {},
      separator: true,
    });

    // Copy Path (single entity only)
    if (!isMultiSelect && this.targetEntity) {
      items.push({
        icon: 'link',
        label: 'Copy Path',
        action: () => {
          if (this.targetEntity) {
            this.config.onCopyPath?.(this.targetEntity);
          }
          this.hide();
        },
      });
    }

    // Render items
    items.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'entity-context-menu-separator';
        menu.appendChild(separator);
      } else {
        const menuItem = this.createMenuItem(item);
        menu.appendChild(menuItem);
      }
    });

    return menu;
  }

  /**
   * Creates a menu item element
   */
  private createMenuItem(item: ContextMenuItem): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entity-context-menu-item';
    button.setAttribute('role', 'menuitem');
    
    if (item.disabled) {
      button.disabled = true;
      button.classList.add('disabled');
    }

    // Icon
    if (item.icon) {
      const icon = createIcon(item.icon as any, 16);
      button.appendChild(icon);
    }

    // Label
    const label = document.createElement('span');
    label.className = 'entity-context-menu-label';
    label.textContent = item.label;
    button.appendChild(label);

    // Shortcut
    if (item.shortcut) {
      const shortcut = document.createElement('span');
      shortcut.className = 'entity-context-menu-shortcut';
      shortcut.textContent = item.shortcut;
      button.appendChild(shortcut);
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item.disabled) {
        item.action();
      }
    });

    return button;
  }

  /**
   * Positions the menu at the specified coordinates
   */
  private positionMenu(x: number, y: number): void {
    if (!this.menu) return;

    // Show menu first to get dimensions
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;

    // Adjust if menu goes off screen
    const rect = this.menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      this.menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }
  }

  /**
   * Checks if menu is visible
   */
  isOpen(): boolean {
    return this.isVisible;
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    this.hide();
  }
}

