/**
 * BookmarksPanel - Bookmark management for quick access to entities
 * 
 * Features:
 * - Add/remove bookmarks
 * - Quick navigation to bookmarked entities
 * - Bookmark organization
 */

import type { SelectionManager } from '@engine/world';
import { createIcon } from '../utils/icons';
import { storageSave, storageLoad } from '../../utils/storage';

interface Bookmark {
  id: string;
  entityId: string;
  entityName: string;
  timestamp: number;
  notes?: string;
}

export interface BookmarksPanelConfig {
  selection: SelectionManager;
  onNavigate?: (entityId: string) => void;
}

export class BookmarksPanel {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private bookmarks: Map<string, Bookmark> = new Map();

  constructor(private readonly config: BookmarksPanelConfig) {
    this.root = document.createElement('section');
    this.root.className = 'bookmarks-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'bookmarks-panel-header';

    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Bookmarks';
    header.appendChild(title);

    // Add bookmark button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-icon-sm btn-ghost';
    addBtn.title = 'Add bookmark';
    addBtn.appendChild(createIcon('star', 16));
    addBtn.addEventListener('click', () => this.addBookmark());
    header.appendChild(addBtn);

    this.root.appendChild(header);

    // List
    this.list = document.createElement('div');
    this.list.className = 'bookmarks-list custom-scrollbar';
    this.root.appendChild(this.list);

    // Load saved bookmarks
    this.loadBookmarks();
    this.render();
  }

  /**
   * Adds a bookmark for the currently selected entity
   */
  private addBookmark(): void {
    const entity = this.config.selection.primarySelection;
    if (!entity) {
      alert('No entity selected. Please select an entity to bookmark.');
      return;
    }
    
    // Check if already bookmarked
    const existing = Array.from(this.bookmarks.values()).find(
      b => b.entityId === entity.id
    );
    
    if (existing) {
      alert('Entity is already bookmarked.');
      return;
    }

    const id = `bookmark_${Date.now()}`;
    const bookmark: Bookmark = {
      id,
      entityId: entity.id,
      entityName: entity.name,
      timestamp: Date.now(),
    };

    this.bookmarks.set(id, bookmark);
    this.saveBookmarks();
    this.render();
  }

  /**
   * Removes a bookmark
   */
  private removeBookmark(id: string): void {
    this.bookmarks.delete(id);
    this.saveBookmarks();
    this.render();
  }

  /**
   * Navigates to a bookmarked entity
   */
  private navigateToBookmark(bookmark: Bookmark): void {
    this.config.onNavigate?.(bookmark.entityId);
  }

  /**
   * Renders the bookmarks list
   */
  private render(): void {
    this.list.innerHTML = '';

    if (this.bookmarks.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.innerHTML = `
        <div class="inspector-empty-icon">${createIcon('star', 48).outerHTML}</div>
        <span>No bookmarks</span>
        <span class="text-xs text-3">Select an entity and click + to bookmark it</span>
      `;
      this.list.appendChild(empty);
      return;
    }

    // Sort bookmarks by timestamp (newest first)
    const sortedBookmarks = Array.from(this.bookmarks.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    sortedBookmarks.forEach((bookmark) => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';

      // Icon
      const icon = createIcon('star-filled', 16);
      icon.style.color = '#f59e0b';
      item.appendChild(icon);

      // Name (clickable to navigate)
      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'bookmark-name';
      nameBtn.textContent = bookmark.entityName;
      nameBtn.title = `Navigate to ${bookmark.entityName}`;
      nameBtn.addEventListener('click', () => this.navigateToBookmark(bookmark));
      item.appendChild(nameBtn);

      // Timestamp
      const time = document.createElement('span');
      time.className = 'bookmark-time';
      time.textContent = this.formatTimestamp(bookmark.timestamp);
      item.appendChild(time);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-icon-sm btn-ghost bookmark-remove';
      removeBtn.title = 'Remove bookmark';
      removeBtn.appendChild(createIcon('trash', 14));
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeBookmark(bookmark.id);
      });
      item.appendChild(removeBtn);

      this.list.appendChild(item);
    });
  }

  /**
   * Formats a timestamp for display
   */
  private formatTimestamp(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  /**
   * Saves bookmarks to localStorage
   */
  private saveBookmarks(): void {
    const bookmarksData = Array.from(this.bookmarks.values());
    storageSave('bookmarks', bookmarksData);
  }

  /**
   * Loads bookmarks from localStorage
   */
  private loadBookmarks(): void {
    const data = storageLoad<Bookmark[]>('bookmarks');
    if (data) {
      this.bookmarks.clear();
      data.forEach((bookmark) => {
        this.bookmarks.set(bookmark.id, bookmark);
      });
    }
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
}

