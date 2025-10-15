/**
 * HistoryPanel - Visual history/timeline of editor actions
 * 
 * Features:
 * - Undo/redo visualization
 * - Action history timeline
 * - Quick jump to any state
 */

import { createIcon } from '../utils/icons';

export interface HistoryAction {
  id: string;
  type: string;
  description: string;
  timestamp: number;
}

export interface HistoryPanelConfig {
  onUndo?: () => void;
  onRedo?: () => void;
  onJumpTo?: (index: number) => void;
}

export class HistoryPanel {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private actions: HistoryAction[] = [];
  private currentIndex = -1;

  constructor(private readonly config: HistoryPanelConfig) {
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

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'btn-icon-sm btn-ghost';
    undoBtn.title = 'Undo';
    undoBtn.appendChild(createIcon('undo', 16));
    undoBtn.addEventListener('click', () => {
      this.config.onUndo?.();
    });
    controls.appendChild(undoBtn);

    const redoBtn = document.createElement('button');
    redoBtn.type = 'button';
    redoBtn.className = 'btn-icon-sm btn-ghost';
    redoBtn.title = 'Redo';
    redoBtn.appendChild(createIcon('redo', 16));
    redoBtn.addEventListener('click', () => {
      this.config.onRedo?.();
    });
    controls.appendChild(redoBtn);

    header.appendChild(controls);
    this.root.appendChild(header);

    // List
    this.list = document.createElement('div');
    this.list.className = 'history-list custom-scrollbar';
    this.root.appendChild(this.list);

    this.render();
  }

  /**
   * Adds an action to the history
   */
  addAction(action: HistoryAction): void {
    // Remove any actions after current index (branching)
    this.actions = this.actions.slice(0, this.currentIndex + 1);
    
    // Add new action
    this.actions.push(action);
    this.currentIndex = this.actions.length - 1;

    // Limit history size
    const MAX_HISTORY = 50;
    if (this.actions.length > MAX_HISTORY) {
      this.actions = this.actions.slice(-MAX_HISTORY);
      this.currentIndex = this.actions.length - 1;
    }

    this.render();
  }

  /**
   * Moves to a specific point in history
   */
  jumpTo(index: number): void {
    if (index >= 0 && index < this.actions.length) {
      this.currentIndex = index;
      this.config.onJumpTo?.(index);
      this.render();
    }
  }

  /**
   * Renders the history list
   */
  private render(): void {
    this.list.innerHTML = '';

    if (this.actions.length === 0) {
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

    // Render actions (newest first)
    const reversedActions = [...this.actions].reverse();
    
    reversedActions.forEach((action, reverseIndex) => {
      const index = this.actions.length - 1 - reverseIndex;
      const isCurrent = index === this.currentIndex;
      const isPast = index <= this.currentIndex;

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
      desc.textContent = action.description;
      content.appendChild(desc);

      const time = document.createElement('div');
      time.className = 'history-time';
      time.textContent = this.formatTimestamp(action.timestamp);
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
    this.actions = [];
    this.currentIndex = -1;
    this.render();
  }
}

