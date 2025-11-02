/**
 * QuickStartGuide - Floating quick reference panel for new users
 * 
 * Features:
 * - Minimizable floating panel with key actions
 * - Common shortcuts reference
 * - Quick action buttons
 * - Dismissable after user gains experience
 */

import { storageLoad, storageSave } from '../../utils/storage';

const STORAGE_KEY = 'editor:quickGuideMinimized';

export interface QuickStartGuideConfig {
  onAddObject?: () => void;
  onSaveProject?: () => void;
  onPlayMode?: () => void;
  onOpenHelp?: () => void;
}

export class QuickStartGuide {
  private container: HTMLElement | null = null;
  private isMinimized = false;
  private config: QuickStartGuideConfig;

  constructor(config: QuickStartGuideConfig = {}) {
    this.config = config;
    // Load minimized state
    const minimized = storageLoad<boolean>(STORAGE_KEY);
    if (minimized === true) {
      this.isMinimized = true;
    }
  }

  /** Mounts the quick start guide. */
  public mount(): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'quick-start-guide';
    if (this.isMinimized) {
      this.container.classList.add('minimized');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'quick-start-header';

    const title = document.createElement('h4');
    title.className = 'quick-start-title';
    title.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2L3 7v5h3v-4h4v4h3V7z"/>
      </svg>
      <span>Quick Start</span>
    `;
    header.appendChild(title);

    const controls = document.createElement('div');
    controls.className = 'quick-start-controls';

    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'quick-start-control-btn';
    minimizeBtn.setAttribute('aria-label', 'Minimize');
    minimizeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3 8h10v1H3z"/>
      </svg>
    `;
    minimizeBtn.addEventListener('click', () => this.toggleMinimize());
    controls.appendChild(minimizeBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'quick-start-control-btn';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
    `;
    closeBtn.addEventListener('click', () => this.dismiss());
    controls.appendChild(closeBtn);

    header.appendChild(controls);
    this.container.appendChild(header);

    // Content (only visible when not minimized)
    const content = document.createElement('div');
    content.className = 'quick-start-content';

    // Quick Actions Section
    const actionsSection = document.createElement('div');
    actionsSection.className = 'quick-start-section';

    const actionsTitle = document.createElement('div');
    actionsTitle.className = 'quick-start-section-title';
    actionsTitle.textContent = 'Quick Actions';
    actionsSection.appendChild(actionsTitle);

    const actionsList = document.createElement('div');
    actionsList.className = 'quick-start-actions';

    const actions = [
      {
        icon: '➕',
        label: 'Add Object',
        onClick: () => this.config.onAddObject?.(),
      },
      {
        icon: '💾',
        label: 'Save Project',
        onClick: () => this.config.onSaveProject?.(),
      },
      {
        icon: '▶️',
        label: 'Play Mode',
        onClick: () => this.config.onPlayMode?.(),
      },
      {
        icon: '❓',
        label: 'Help',
        onClick: () => this.config.onOpenHelp?.(),
      },
    ];

    actions.forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'quick-start-action-btn';
      btn.innerHTML = `
        <span class="quick-start-action-icon">${action.icon}</span>
        <span class="quick-start-action-label">${action.label}</span>
      `;
      btn.addEventListener('click', () => action.onClick());
      actionsList.appendChild(btn);
    });

    actionsSection.appendChild(actionsList);
    content.appendChild(actionsSection);

    // Shortcuts Section
    const shortcutsSection = document.createElement('div');
    shortcutsSection.className = 'quick-start-section';

    const shortcutsTitle = document.createElement('div');
    shortcutsTitle.className = 'quick-start-section-title';
    shortcutsTitle.textContent = 'Essential Shortcuts';
    shortcutsSection.appendChild(shortcutsTitle);

    const shortcutsList = document.createElement('div');
    shortcutsList.className = 'quick-start-shortcuts';

    const shortcuts = [
      { keys: ['W', 'A', 'S', 'D'], label: 'Move Camera' },
      { keys: ['Right Click'], label: 'Rotate View' },
      { keys: ['F'], label: 'Focus Object' },
      { keys: ['Ctrl', 'Z'], label: 'Undo' },
      { keys: ['Ctrl', 'S'], label: 'Save' },
      { keys: ['Del'], label: 'Delete' },
      { keys: ['Space'], label: 'Play/Pause' },
      { keys: ['?'], label: 'All Shortcuts' },
    ];

    shortcuts.forEach((shortcut) => {
      const item = document.createElement('div');
      item.className = 'quick-start-shortcut-item';

      const keys = document.createElement('div');
      keys.className = 'quick-start-shortcut-keys';
      shortcut.keys.forEach((key) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = key;
        keys.appendChild(kbd);
      });
      item.appendChild(keys);

      const label = document.createElement('span');
      label.className = 'quick-start-shortcut-label';
      label.textContent = shortcut.label;
      item.appendChild(label);

      shortcutsList.appendChild(item);
    });

    shortcutsSection.appendChild(shortcutsList);
    content.appendChild(shortcutsSection);

    // Tips Section
    const tipsSection = document.createElement('div');
    tipsSection.className = 'quick-start-section quick-start-tips';

    const tipsTitle = document.createElement('div');
    tipsTitle.className = 'quick-start-section-title';
    tipsTitle.textContent = '💡 Pro Tips';
    tipsSection.appendChild(tipsTitle);

    const tipsList = document.createElement('ul');
    tipsList.className = 'quick-start-tips-list';

    const tips = [
      'Hold Shift while moving objects for precise placement',
      'Double-click objects in hierarchy to focus camera',
      'Use Ctrl+D to duplicate selected objects',
      'Press Tab to toggle between edit tools',
    ];

    tips.forEach((tip) => {
      const li = document.createElement('li');
      li.textContent = tip;
      tipsList.appendChild(li);
    });

    tipsSection.appendChild(tipsList);
    content.appendChild(tipsSection);

    this.container.appendChild(content);

    // Make draggable
    this.makeDraggable(header);

    document.body.appendChild(this.container);

    // Fade-in animation
    requestAnimationFrame(() => {
      this.container?.classList.add('visible');
    });
  }

  /** Makes the panel draggable. */
  private makeDraggable(handle: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    handle.style.cursor = 'move';

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.quick-start-control-btn')) {
        return; // Don't drag when clicking control buttons
      }
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.container!.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !this.container) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      this.container.style.left = `${initialLeft + deltaX}px`;
      this.container.style.top = `${initialTop + deltaY}px`;
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  /** Toggles minimize state. */
  private toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    
    if (this.isMinimized) {
      this.container?.classList.add('minimized');
    } else {
      this.container?.classList.remove('minimized');
    }

    // Save state
    storageSave(STORAGE_KEY, this.isMinimized);
  }

  /** Shows the guide (un-minimizes). */
  public show(): void {
    if (!this.container) {
      this.mount();
      return;
    }

    this.isMinimized = false;
    this.container.classList.remove('minimized');
    storageSave(STORAGE_KEY, false);
  }

  /** Dismisses and removes the guide. */
  public dismiss(): void {
    if (!this.container) return;

    this.container.classList.add('dismissed');
    setTimeout(() => {
      this.container?.remove();
      this.container = null;
    }, 300);
  }

  /** Disposes guide resources. */
  public dispose(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

