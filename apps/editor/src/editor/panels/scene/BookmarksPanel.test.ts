/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BookmarksPanel } from './BookmarksPanel';
import { SelectionManager } from '@engine/world';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import * as storage from '../../../utils/storage';

vi.mock('../../../utils/storage', () => ({
  storageSave: vi.fn(),
  storageLoad: vi.fn(),
}));

function createHost(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('BookmarksPanel', () => {
  let selection: SelectionManager;
  let scene: Scene;
  let entity: Entity;
  let host: HTMLElement;

  beforeEach(() => {
    selection = new SelectionManager();
    scene = new Scene('Scene');
    entity = new Entity('Test Entity');
    scene.addEntity(entity);
    selection.setScene(scene);
    host = createHost();

    // Reset storage mock
    vi.mocked(storage.storageLoad).mockReturnValue(null);
    vi.mocked(storage.storageSave).mockClear();

    // Mock alert and prompt
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    host.remove();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create panel and mount to host', () => {
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      expect(host.querySelector('.bookmarks-panel')).toBeTruthy();
    });

    it('should show empty state when no bookmarks exist', () => {
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const empty = host.querySelector('.inspector-empty');
      expect(empty).toBeTruthy();
      expect(empty?.textContent).toContain('No bookmarks');
    });

    it('should load bookmarks from storage on initialization', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      expect(storage.storageLoad).toHaveBeenCalledWith('bookmarks');
      
      const bookmarkItems = host.querySelectorAll('.bookmark-item');
      expect(bookmarkItems.length).toBe(1);
    });

    it('should display panel title', () => {
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const title = host.querySelector('.panel-title');
      expect(title?.textContent).toBe('Bookmarks');
    });

    it('should have add bookmark button', () => {
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const addBtn = host.querySelector('.btn-icon-sm');
      expect(addBtn).toBeTruthy();
      expect(addBtn?.getAttribute('title')).toBe('Add bookmark');
    });
  });

  describe('adding bookmarks', () => {
    it('should add bookmark when entity is selected', () => {
      selection.select(entity);
      
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const addBtn = host.querySelector('.bookmarks-panel-header button') as HTMLButtonElement;
      addBtn.click();

      expect(storage.storageSave).toHaveBeenCalledWith(
        'bookmarks',
        expect.arrayContaining([
          expect.objectContaining({
            entityId: entity.id,
            entityName: entity.name,
          }),
        ])
      );

      const bookmarkItems = host.querySelectorAll('.bookmark-item');
      expect(bookmarkItems.length).toBe(1);
    });

    it('should show alert when no entity selected', () => {
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const addBtn = host.querySelector('.bookmarks-panel-header button') as HTMLButtonElement;
      addBtn.click();

      expect(window.alert).toHaveBeenCalledWith(
        'No entity selected. Please select an entity to bookmark.'
      );

      const bookmarkItems = host.querySelectorAll('.bookmark-item');
      expect(bookmarkItems.length).toBe(0);
    });

    it('should not add duplicate bookmarks', () => {
      selection.select(entity);
      
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const addBtn = host.querySelector('.bookmarks-panel-header button') as HTMLButtonElement;
      addBtn.click();
      addBtn.click();

      expect(window.alert).toHaveBeenCalledWith('Entity is already bookmarked.');

      const bookmarkItems = host.querySelectorAll('.bookmark-item');
      expect(bookmarkItems.length).toBe(1);
    });

    it('should generate unique bookmark IDs', () => {
      const entity2 = new Entity('Entity 2');
      scene.addEntity(entity2);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      selection.select(entity);
      const addBtn = host.querySelector('.bookmarks-panel-header button') as HTMLButtonElement;
      addBtn.click();

      selection.select(entity2);
      addBtn.click();

      const bookmarkItems = host.querySelectorAll('.bookmark-item');
      expect(bookmarkItems.length).toBe(2);
    });
  });

  describe('displaying bookmarks', () => {
    it('should display bookmark name', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'My Entity',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const name = host.querySelector('.bookmark-name');
      expect(name?.textContent).toBe('My Entity');
    });

    it('should display bookmark timestamp', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now() - 5000, // 5 seconds ago
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const time = host.querySelector('.bookmark-time');
      expect(time).toBeTruthy();
      expect(time?.textContent).toMatch(/Just now|ago/);
    });

    it('should sort bookmarks by timestamp (newest first)', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Old',
          timestamp: Date.now() - 10000,
        },
        {
          id: 'bookmark_2',
          entityId: 'entity2',
          entityName: 'New',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const names = Array.from(host.querySelectorAll('.bookmark-name')).map(
        el => el.textContent
      );
      expect(names[0]).toBe('New');
      expect(names[1]).toBe('Old');
    });

    it('should show star icon for bookmarks', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const icon = host.querySelector('.bookmark-item svg');
      expect(icon).toBeTruthy();
    });
  });

  describe('removing bookmarks', () => {
    it('should remove bookmark when delete button clicked', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const removeBtn = host.querySelector('.bookmark-remove') as HTMLButtonElement;
      expect(removeBtn).toBeTruthy();
      
      removeBtn.click();

      expect(storage.storageSave).toHaveBeenCalledWith('bookmarks', []);

      const bookmarkItems = host.querySelectorAll('.bookmark-item');
      expect(bookmarkItems.length).toBe(0);
    });

    it('should not propagate click event from remove button', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const onNavigate = vi.fn();
      const panel = new BookmarksPanel({ selection, onNavigate });
      panel.mount(host);

      const removeBtn = host.querySelector('.bookmark-remove') as HTMLButtonElement;
      removeBtn.click();

      // Navigate should not be called
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('should call onNavigate when bookmark clicked', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const onNavigate = vi.fn();
      const panel = new BookmarksPanel({ selection, onNavigate });
      panel.mount(host);

      const nameBtn = host.querySelector('.bookmark-name') as HTMLButtonElement;
      nameBtn.click();

      expect(onNavigate).toHaveBeenCalledWith('entity1');
    });

    it('should not call onNavigate when callback not provided', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const nameBtn = host.querySelector('.bookmark-name') as HTMLButtonElement;
      
      // Should not throw
      expect(() => nameBtn.click()).not.toThrow();
    });
  });

  describe('timestamp formatting', () => {
    it('should format recent timestamps as "Just now"', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now() - 100, // Less than 1 minute ago
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const time = host.querySelector('.bookmark-time');
      expect(time?.textContent).toBe('Just now');
    });

    it('should format minutes ago', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const time = host.querySelector('.bookmark-time');
      expect(time?.textContent).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const time = host.querySelector('.bookmark-time');
      expect(time?.textContent).toBe('3h ago');
    });

    it('should format days ago', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const time = host.querySelector('.bookmark-time');
      expect(time?.textContent).toBe('2d ago');
    });
  });

  describe('storage persistence', () => {
    it('should save bookmarks when added', () => {
      selection.select(entity);
      
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const addBtn = host.querySelector('.bookmarks-panel-header button') as HTMLButtonElement;
      addBtn.click();

      expect(storage.storageSave).toHaveBeenCalledWith(
        'bookmarks',
        expect.any(Array)
      );
    });

    it('should save bookmarks when removed', () => {
      const mockBookmarks = [
        {
          id: 'bookmark_1',
          entityId: 'entity1',
          entityName: 'Entity 1',
          timestamp: Date.now(),
        },
      ];

      vi.mocked(storage.storageLoad).mockReturnValue(mockBookmarks);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      vi.mocked(storage.storageSave).mockClear();

      const removeBtn = host.querySelector('.bookmark-remove') as HTMLButtonElement;
      removeBtn.click();

      expect(storage.storageSave).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle null storage data', () => {
      vi.mocked(storage.storageLoad).mockReturnValue(null);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const empty = host.querySelector('.inspector-empty');
      expect(empty).toBeTruthy();
    });

    it('should handle empty storage array', () => {
      vi.mocked(storage.storageLoad).mockReturnValue([]);

      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const empty = host.querySelector('.inspector-empty');
      expect(empty).toBeTruthy();
    });

    it('should handle multiple rapid bookmark additions', () => {
      selection.select(entity);
      
      const panel = new BookmarksPanel({ selection });
      panel.mount(host);

      const addBtn = host.querySelector('.bookmarks-panel-header button') as HTMLButtonElement;
      
      // Try adding multiple times quickly
      addBtn.click();
      addBtn.click();
      addBtn.click();

      const bookmarkItems = host.querySelectorAll('.bookmark-item');
      expect(bookmarkItems.length).toBe(1); // Should only add once
    });
  });
});

