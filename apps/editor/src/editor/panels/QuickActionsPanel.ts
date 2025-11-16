/**
 * QuickActionsPanel - Quick access to most frequently used properties
 * 
 * This panel wraps QuickAccessBar and provides it as a sidebar tab.
 * Features:
 * - Transform controls (Position, Rotation, Scale) in compact form
 * - Color picker in compact form
 * - Updates based on selected entity
 */

import type { Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { RgbaColor } from '../../utils/colors';
import { QuickAccessBar } from '../ui/QuickAccessBar';
import type { EditorState } from '../core/state';
import { MaterialComponent } from '@engine/world/components/MaterialComponent';

export interface QuickActionsPanelConfig {
  selection: SelectionManager;
  onTransformChanged: (entity: Entity) => void;
  onColorChanged: (entity: Entity, color: RgbaColor) => void;
  getSnapConfig: () => {
    enabled: boolean;
    increment: number;
    axes: { x: boolean; y: boolean; z: boolean };
    rotationIncrement: number;
    scaleIncrement: number;
    minScale: number;
  } | null;
  roundToIncrement: (value: number, increment: number) => number;
  entityHasTexture: (entity: Entity, materialComp: MaterialComponent | null) => boolean;
  setManagedTimeout?: (fn: () => void, delayMs: number) => number;
  registerUndo?: (action: () => void) => void;
  announce?: (message: string) => void;
  state?: EditorState;
}

export class QuickActionsPanel {
  private readonly root: HTMLElement;
  private quickAccessBar: QuickAccessBar | null = null;
  private refreshAbort: AbortController | null = null;
  private activeTimeouts = new Set<number>();
  private renderedEntityId: string | null = null;

  constructor(private readonly config: QuickActionsPanelConfig) {
    this.root = document.createElement('section');
    this.root.className = 'quick-actions-panel custom-scrollbar';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Quick Actions');

    // Initial render
    this.refresh();
  }

  /**
   * Refreshes the panel with current selection
   */
  refresh(): void {
    const selected =
      this.config.state?.selectedEntity.value ?? this.config.selection.primarySelection;

    // Trigger on any reactive event revisions so effects can cause this to run
    if (this.config.state) {
      void this.config.state.transformRev.value;
      void this.config.state.colorRev.value;
    }

    if (!selected) {
      this.beginRefreshScope();
      this.root.innerHTML = '';

      const empty = document.createElement('div');
      empty.className = 'quick-actions-empty';
      
      const emptyIcon = document.createElement('div');
      emptyIcon.className = 'quick-actions-empty-icon';
      emptyIcon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
      
      const emptyTitle = document.createElement('h3');
      emptyTitle.className = 'quick-actions-empty-title';
      emptyTitle.textContent = 'No Selection';
      
      const emptyText = document.createElement('p');
      emptyText.className = 'quick-actions-empty-text';
      emptyText.textContent = 'Select an entity to access quick actions';
      
      empty.appendChild(emptyIcon);
      empty.appendChild(emptyTitle);
      empty.appendChild(emptyText);
      
      this.root.appendChild(empty);
      this.renderedEntityId = null;
      
      if (this.quickAccessBar) {
        this.quickAccessBar.dispose();
        this.quickAccessBar = null;
      }
      return;
    }

    if (this.renderedEntityId === selected.id && this.quickAccessBar) {
      // Update existing QuickAccessBar
      this.quickAccessBar.updateEntity(selected);
      return;
    }

    // Full rebuild
    this.beginRefreshScope();
    this.root.innerHTML = '';
    this.renderedEntityId = selected.id;

    // Create Quick Access Bar
    if (this.quickAccessBar) {
      this.quickAccessBar.dispose();
    }
    this.quickAccessBar = new QuickAccessBar({
      entity: selected,
      onTransformChanged: this.config.onTransformChanged,
      onColorChanged: this.config.onColorChanged,
      getSnapConfig: () => this.config.getSnapConfig(),
      roundToIncrement: (value, increment) => this.config.roundToIncrement(value, increment),
      entityHasTexture: (entity, materialComp) => this.config.entityHasTexture(entity, materialComp),
      abortSignal: this.refreshAbort!.signal,
      setManagedTimeout: (fn, ms) => this.setManagedTimeout(fn, ms),
      registerUndo: (action) => this.config.registerUndo?.(action),
      announce: (message) => this.config.announce?.(message),
      refresh: () => this.refresh(),
    });
    this.root.appendChild(this.quickAccessBar.element);
  }

  /**
   * Gets the root element
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Disposes the panel
   */
  dispose(): void {
    if (this.refreshAbort) {
      this.refreshAbort.abort();
      this.refreshAbort = null;
    }
    for (const timeoutId of this.activeTimeouts) {
      window.clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
    if (this.quickAccessBar) {
      this.quickAccessBar.dispose();
      this.quickAccessBar = null;
    }
    this.root.innerHTML = '';
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  private beginRefreshScope(): void {
    if (this.refreshAbort) {
      this.refreshAbort.abort();
    }
    for (const timeoutId of this.activeTimeouts) {
      window.clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
    this.refreshAbort = new AbortController();
  }

  private setManagedTimeout(handler: () => void, delayMs: number): number {
    const timeoutId = window.setTimeout(() => {
      this.activeTimeouts.delete(timeoutId);
      handler();
    }, delayMs);
    this.activeTimeouts.add(timeoutId);
    return timeoutId;
  }
}

