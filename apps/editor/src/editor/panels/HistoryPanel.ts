/**
 * HistoryPanel - Visual history/timeline of editor actions
 * 
 * Features:
 * - Undo/redo visualization
 * - Action history timeline
 * - Quick jump to any state
 */

import { createIcon } from '../utils/icons';
import type { HistoryManager, SceneSnapshot } from '@engine/editor-utils';

export interface HistoryPanelConfig {
  history?: HistoryManager;
  onUndo?: () => void;
  onRedo?: () => void;
  onJumpTo?: (index: number) => void;
}

export class HistoryPanel {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;
  private history: HistoryManager | null = null;

  constructor(private readonly config: HistoryPanelConfig) {
    this.history = config.history ?? null;
    
    this.root = document.createElement('section');
    this.root.className = 'history-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'history-panel-header';

    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'History';
    header.appendChild(title);

    // Undo/Redo buttons
    const controls = document.createElement('div');
    controls.className = 'history-controls';

    this.undoBtn = document.createElement('button');
    this.undoBtn.type = 'button';
    this.undoBtn.className = 'btn-icon-sm btn-ghost';
    this.undoBtn.title = 'Undo';
    this.undoBtn.appendChild(createIcon('undo', 16));
    this.undoBtn.addEventListener('click', () => {
      this.config.onUndo?.();
      this.sync();
    });
    controls.appendChild(this.undoBtn);

    this.redoBtn = document.createElement('button');
    this.redoBtn.type = 'button';
    this.redoBtn.className = 'btn-icon-sm btn-ghost';
    this.redoBtn.title = 'Redo';
    this.redoBtn.appendChild(createIcon('redo', 16));
    this.redoBtn.addEventListener('click', () => {
      this.config.onRedo?.();
      this.sync();
    });
    controls.appendChild(this.redoBtn);

    header.appendChild(controls);
    this.root.appendChild(header);

    // List
    this.list = document.createElement('div');
    this.list.className = 'history-list custom-scrollbar';
    this.root.appendChild(this.list);

    this.render();
  }

  /**
   * Syncs the panel with the HistoryManager state.
   * Call this after undo/redo operations or when history changes.
   */
  sync(): void {
    this.render();
  }

  /**
   * Sets the HistoryManager instance to sync with.
   */
  setHistory(history: HistoryManager | null): void {
    this.history = history;
    this.render();
  }

  /**
   * Moves to a specific point in history
   */
  jumpTo(index: number): void {
    if (!this.history) {
      this.config.onJumpTo?.(index);
      return;
    }
    
    const size = this.history.size();
    if (index >= 0 && index < size) {
      // Use history.jumpTo() to actually change the index
      this.history.jumpTo(index);
      this.config.onJumpTo?.(index);
      this.render();
    }
  }

  /**
   * Renders the history list
   */
  private render(): void {
    this.list.innerHTML = '';

    // Update button states
    if (this.history) {
      this.undoBtn.disabled = !this.history.canUndo();
      this.redoBtn.disabled = !this.history.canRedo();
    } else {
      this.undoBtn.disabled = true;
      this.redoBtn.disabled = true;
    }

    if (!this.history || this.history.size() === 0) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.innerHTML = `
        <div class="inspector-empty-icon">${createIcon('rotate-ccw', 48).outerHTML}</div>
        <span>No history</span>
        <span class="text-xs text-3">Actions will appear here</span>
      `;
      this.list.appendChild(empty);
      return;
    }

    // Get all snapshots from history
    const history = this.history;
    const snapshots = history.export();
    const currentIndex = history.getCurrentIndex();

    // Render snapshots (newest first)
    const reversedSnapshots = [...snapshots].reverse();
    
    reversedSnapshots.forEach((snapshot, reverseIndex) => {
      const index = snapshots.length - 1 - reverseIndex;
      const isCurrent = index === currentIndex;
      const isPast = index <= currentIndex;

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'history-item';
      
      if (isCurrent) {
        item.classList.add('current');
      }
      if (!isPast) {
        item.classList.add('future');
      }

      // Timeline marker
      const marker = document.createElement('div');
      marker.className = 'history-marker';
      if (isCurrent) {
        marker.appendChild(createIcon('circle', 12));
      } else {
        const dot = document.createElement('div');
        dot.className = 'history-dot';
        marker.appendChild(dot);
      }
      item.appendChild(marker);

      // Content
      const content = document.createElement('div');
      content.className = 'history-content';

      const desc = document.createElement('div');
      desc.className = 'history-description';
      desc.textContent = snapshot.description || `Snapshot ${index + 1}`;
      content.appendChild(desc);

      const time = document.createElement('div');
      time.className = 'history-time';
      time.textContent = this.formatTimestamp(snapshot.timestamp);
      content.appendChild(time);

      item.appendChild(content);

      // Click to jump to this state
      item.addEventListener('click', () => {
        this.jumpTo(index);
      });

      this.list.appendChild(item);
    });
  }

  /**
   * Formats a timestamp for display
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Gets the root element
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Mounts to a parent element
   */
  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  /**
   * Clears all history
   */
  clear(): void {
    this.history?.clear();
    this.render();
  }
}

