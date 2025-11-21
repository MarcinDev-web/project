/**
 * KeyboardShortcutsModal - Displays keyboard shortcuts in a modal
 *
 * Features:
 * - Organized by category
 * - Search functionality
 * - Printable reference
 * - Modern design
 */

import { createIcon } from '../../utils/icons';

interface Shortcut {
  keys: string;
  description: string;
  category: string;
}

export class KeyboardShortcutsModal {
  private modal: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;

  private shortcuts: Shortcut[] = [
    // File
    { keys: 'Ctrl+N', description: 'New Project', category: 'File' },
    { keys: 'Ctrl+O', description: 'Open Project', category: 'File' },
    { keys: 'Ctrl+S', description: 'Save Project', category: 'File' },
    { keys: 'Ctrl+Shift+S', description: 'Save As...', category: 'File' },

    // Edit
    { keys: 'Ctrl+Z', description: 'Undo', category: 'Edit' },
    { keys: 'Ctrl+Y', description: 'Redo', category: 'Edit' },
    { keys: 'Ctrl+C', description: 'Copy', category: 'Edit' },
    { keys: 'Ctrl+V', description: 'Paste', category: 'Edit' },
    { keys: 'Ctrl+X', description: 'Cut', category: 'Edit' },
    { keys: 'Ctrl+D', description: 'Duplicate', category: 'Edit' },
    { keys: 'Ctrl+A', description: 'Select All', category: 'Edit' },
    { keys: 'Delete', description: 'Delete Selection', category: 'Edit' },

    // Transform
    { keys: 'W', description: 'Move Tool', category: 'Transform' },
    { keys: 'E', description: 'Rotate Tool', category: 'Transform' },
    { keys: 'R', description: 'Scale Tool', category: 'Transform' },
    
    // View
    { keys: 'G', description: 'Toggle Grid', category: 'View' },
    { keys: 'X', description: 'Toggle Snap', category: 'View' },
    { keys: '[', description: 'Decrease Grid Size', category: 'View' },
    { keys: ']', description: 'Increase Grid Size', category: 'View' },
    { keys: 'F', description: 'Focus on Selection', category: 'View' },

    // Navigation
    { keys: 'Ctrl+K', description: 'Search', category: 'Navigation' },
    { keys: 'Esc', description: 'Cancel/Deselect', category: 'Navigation' },
    
    // Placement
    { keys: 'Enter', description: 'Confirm Placement', category: 'Placement' },
    { keys: 'Q', description: 'Rotate Left', category: 'Placement' },
    { keys: 'E (in placement)', description: 'Rotate Right', category: 'Placement' },

    // Help
    { keys: '?', description: 'Show Keyboard Shortcuts', category: 'Help' },
  ];

  /**
   * Shows the shortcuts modal
   */
  show(): void {
    if (this.modal) return;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay shortcuts-modal-overlay';
    
    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'modal shortcuts-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'shortcuts-modal-header';

    const title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    title.style.margin = '0';
    title.style.fontSize = 'var(--text-2xl)';
    title.style.fontWeight = 'var(--font-bold)';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-icon';
    closeBtn.appendChild(createIcon('close', 20));
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Search bar
    const searchBox = document.createElement('div');
    searchBox.className = 'search-box';
    searchBox.style.marginTop = 'var(--spacing-4)';

    const searchIcon = createIcon('search', 16, 'search-icon');
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'input search-input';
    searchInput.placeholder = 'Search shortcuts...';

    searchBox.appendChild(searchIcon);
    searchBox.appendChild(searchInput);

    // Content
    const content = document.createElement('div');
    content.className = 'shortcuts-modal-content';

    // Group shortcuts by category
    const categories = this.groupByCategory();
    
    Object.entries(categories).forEach(([category, shortcuts]) => {
      const section = document.createElement('div');
      section.className = 'shortcuts-category';

      const categoryTitle = document.createElement('h3');
      categoryTitle.textContent = category;
      categoryTitle.className = 'shortcuts-category-title';
      section.appendChild(categoryTitle);

      const list = document.createElement('div');
      list.className = 'shortcuts-list';

      shortcuts.forEach(shortcut => {
        const item = document.createElement('div');
        item.className = 'shortcuts-item';
        item.dataset.search = `${shortcut.keys} ${shortcut.description}`.toLowerCase();

        const keys = document.createElement('kbd');
        keys.className = 'shortcuts-keys';
        keys.textContent = shortcut.keys;

        const desc = document.createElement('span');
        desc.className = 'shortcuts-description';
        desc.textContent = shortcut.description;

        item.appendChild(keys);
        item.appendChild(desc);
        list.appendChild(item);
      });

      section.appendChild(list);
      content.appendChild(section);
    });

    // Search functionality
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const items = content.querySelectorAll('.shortcuts-item');
      
      items.forEach(item => {
        const searchText = (item as HTMLElement).dataset.search || '';
        const matches = searchText.includes(query);
        (item as HTMLElement).style.display = matches ? 'flex' : 'none';
      });

      // Hide empty categories
      const sections = content.querySelectorAll('.shortcuts-category');
      sections.forEach(section => {
        const visibleItems = section.querySelectorAll('.shortcuts-item[style="display: flex;"], .shortcuts-item:not([style*="display"])');
        (section as HTMLElement).style.display = visibleItems.length > 0 ? 'block' : 'none';
      });
    });

    // Assemble modal
    this.modal.appendChild(header);
    this.modal.appendChild(searchBox);
    this.modal.appendChild(content);
    this.overlay.appendChild(this.modal);

    // Add to DOM
    document.body.appendChild(this.overlay);

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Close on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus search input
    searchInput.focus();
  }

  /**
   * Hides the shortcuts modal
   */
  hide(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.modal = null;
    this.overlay = null;
  }

  /**
   * Groups shortcuts by category
   */
  private groupByCategory(): Record<string, Shortcut[]> {
    const groups: Record<string, Shortcut[]> = {};
    
    this.shortcuts.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category]!.push(shortcut);
    });

    return groups;
  }
}

