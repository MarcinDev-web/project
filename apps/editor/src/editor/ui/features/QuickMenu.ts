/**
 * QuickMenu - Cursor-like Top Bar (single row, always visible)
 * Replaces legacy floating quick menu and EditorToolbar mounting.
 */

import { effect } from '@preact/signals-core';
import type { EditorState, CameraType } from '../../core/state';
import type { ProjectManager } from '../../managers/ProjectManager';
import { createIcon } from '../../utils/icons';
import { KeyboardShortcutsModal } from '../modals/KeyboardShortcutsModal';

export interface QuickMenuConfig {
  state: EditorState;
  projectManager?: ProjectManager | null;
  onNewProject?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  onSearch?: (query: string) => void;
  toggleSnap: () => void;
  toggleGrid: () => void;
  showShortcuts?: () => void;
  onOpenAssets?: () => void;
  onOpenScriptWorkbench?: () => void;
  onOpenUIEditor?: () => void;
  onToggleCollaboration?: () => void;
  isCollaborating?: () => boolean;
  onGizmoModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  onRotationSnapChange: (mode: 'free' | '15deg' | '45deg' | '90deg') => void;
  onCameraChange?: (type: CameraType) => void;
  // Auth callbacks restored
  onLogin?: () => void;
  onRegister?: () => void;
  isUserLoggedIn?: () => boolean;
  getUserName?: () => string | null;
  getUserCoins?: () => number;
}

export class QuickMenu {
  private container: HTMLElement | null = null;
  private activeMenu: HTMLElement | null = null;
  private btnUndo: HTMLButtonElement | null = null;
  private btnRedo: HTMLButtonElement | null = null;
  private saveStatusEl: HTMLSpanElement | null = null;
  private modeBtn: HTMLButtonElement | null = null;
  private authContainer: HTMLElement | null = null;
  private cameraButtons: Partial<Record<CameraType, HTMLButtonElement>> = {};

  constructor(private readonly config: QuickMenuConfig) {}

  /** Mounts the top bar. */
  public mount(): void {
    if (this.container) {
      console.warn('QuickMenu: Already mounted');
      return;
    }

    const root = document.createElement('div');
    root.className = 'quick-menu-container';

    // Left: brand + menus
    const left = this.createLeftSection();
    root.appendChild(left);

    // Center: Play Mode only (Tools removed)
    const center = this.createCenterSection();
    root.appendChild(center);

    // Right: Undo/Redo + Collaboration + Settings + Auth
    const right = this.createRightSection();
    root.appendChild(right);

    document.body.appendChild(root);
    this.container = root;

    // Global listeners
    document.addEventListener('click', (e) => {
      if (this.activeMenu && !this.activeMenu.contains(e.target as Node)) {
        this.closeAllMenus();
      }
    });

    document.addEventListener('keydown', (e) => {
      // Escape closes dropdowns
      if (e.key === 'Escape') {
        this.closeAllMenus();
      }
    });

    // Initial state sync
    this.updateHistoryButtons();
    this.updateAuthButtons(); // Restore auth buttons update
    effect(() => this.updateModeButton());
    effect(() => {
      const activeCamera = this.config.state.cameraType.value;
      this.updateCameraSelection(activeCamera);
    });
  }

  public setPlayMode(_active: boolean): void {
    this.updateModeButton();
  }

  public updateAuthState(): void {
    this.updateAuthButtons();
  }

  private createLeftSection(): HTMLElement {
    const left = document.createElement('div');
    left.className = 'top-bar-left';

    // Brand (Forge style)
    const brand = document.createElement('a');
    brand.className = 'top-bar-logo';
    brand.href = '#';
    // Icon with fire emoji style
    const icon = document.createElement('span');
    icon.className = 'top-bar-logo-icon';
    icon.textContent = '⚡'; // Lightning bolt like Forge
    const text = document.createElement('span');
    text.className = 'top-bar-logo-text';
    text.textContent = 'FORGE';
    brand.appendChild(icon);
    brand.appendChild(text);
    left.appendChild(brand);

    // Menu Bar
    const menuBar = document.createElement('div');
    menuBar.className = 'top-bar-menu-bar';
    menuBar.appendChild(this.createDropdownMenu('File', this.buildFileMenu()));
    menuBar.appendChild(this.createDropdownMenu('Edit', this.buildEditMenu()));
    menuBar.appendChild(this.createDropdownMenu('View', this.buildViewMenu()));
    menuBar.appendChild(this.createDropdownMenu('Camera', this.buildCameraMenu()));
    menuBar.appendChild(this.createDropdownMenu('Help', this.buildHelpMenu()));
    left.appendChild(menuBar);

    return left;
  }

  private createCenterSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'top-bar-center';

    // Play Mode Toggle (Prominent)
    const modeBtn = document.createElement('button');
    modeBtn.className = 'top-bar-action-button';
    modeBtn.title = 'Toggle Edit/Play Mode';
    this.modeBtn = modeBtn;
    modeBtn.addEventListener('click', () => {
      const current = this.config.state.editorMode.value;
      this.config.state.editorMode.value = current === 'edit' ? 'play' : 'edit';
    });
    this.updateModeButton();
    section.appendChild(modeBtn);

    // Removed: Transform Tools Group (Move/Rotate/Scale)
    // Removed: Grid/Snap Tools Group (Snap/Grid)

    return section;
  }

  private createRightSection(): HTMLElement {
    const right = document.createElement('div');
    right.className = 'top-bar-right';

    // Auth Buttons (Restored)
    const authContainer = document.createElement('div');
    authContainer.className = 'top-bar-auth-group';
    this.authContainer = authContainer;
    right.appendChild(authContainer);

    // Undo / Redo
    this.btnUndo = document.createElement('button');
    this.btnUndo.className = 'top-bar-icon-button';
    this.btnUndo.title = 'Undo (Ctrl+Z)';
    this.btnUndo.appendChild(createIcon('undo', 14));
    this.btnUndo.addEventListener('click', () => this.config.onUndo());

    this.btnRedo = document.createElement('button');
    this.btnRedo.className = 'top-bar-icon-button';
    this.btnRedo.title = 'Redo (Ctrl+Y)';
    this.btnRedo.appendChild(createIcon('redo', 14));
    this.btnRedo.addEventListener('click', () => this.config.onRedo());

    // Collaboration button
    const collaborationBtn = document.createElement('button');
    collaborationBtn.className = 'top-bar-icon-button';
    collaborationBtn.title = 'Toggle Collaboration';
    collaborationBtn.appendChild(createIcon('users', 14));
    collaborationBtn.addEventListener('click', () => {
      this.config.onToggleCollaboration?.();
    });
    
    if (this.config.isCollaborating) {
      effect(() => {
        const isActive = this.config.isCollaborating?.() ?? false;
        collaborationBtn.classList.toggle('active', isActive);
      });
    }

    // Settings
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'top-bar-icon-button';
    settingsBtn.title = 'Settings';
    settingsBtn.appendChild(createIcon('settings', 14));

    // Save status
    this.saveStatusEl = document.createElement('span');
    this.saveStatusEl.className = 'top-bar-save-status';

    right.appendChild(this.btnUndo);
    right.appendChild(this.btnRedo);
    
    // Separator
    const sep = document.createElement('div');
    sep.className = 'top-bar-separator';
    right.appendChild(sep);

    right.appendChild(collaborationBtn);
    right.appendChild(settingsBtn);
    right.appendChild(this.saveStatusEl);

    return right;
  }

  private updateAuthButtons(): void {
    if (!this.authContainer) return;

    this.authContainer.innerHTML = '';

    if (this.config.isUserLoggedIn?.()) {
      // User logged in
      const userInfoContainer = document.createElement('div');
      userInfoContainer.className = 'top-bar-user-info';
      
      const userButton = document.createElement('button');
      userButton.className = 'top-bar-user-button';
      const userName = this.config.getUserName?.() || 'User';
      const initials = userName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('') || userName.charAt(0).toUpperCase();
      userButton.textContent = initials;
      userButton.title = userName;
      userInfoContainer.appendChild(userButton);

      const divider = document.createElement('div');
      divider.className = 'top-bar-user-divider';
      userInfoContainer.appendChild(divider);

      const coinsDisplay = document.createElement('div');
      coinsDisplay.className = 'top-bar-coins-display';
      
      const coinsIcon = document.createElement('span');
      coinsIcon.className = 'top-bar-coins-icon';
      coinsIcon.textContent = '🪙';
      
      const coinsAmount = document.createElement('span');
      coinsAmount.className = 'top-bar-coins-amount';
      const coins = this.config.getUserCoins?.() ?? 0;
      coinsAmount.textContent = coins.toLocaleString();
      
      coinsDisplay.appendChild(coinsIcon);
      coinsDisplay.appendChild(coinsAmount);
      coinsDisplay.title = `${coins.toLocaleString()} coins`;
      
      userInfoContainer.appendChild(coinsDisplay);
      this.authContainer.appendChild(userInfoContainer);
    } else {
      // Not logged in
      const loginBtn = document.createElement('button');
      loginBtn.className = 'top-bar-auth-button';
      loginBtn.textContent = 'Login';
      loginBtn.addEventListener('click', () => this.config.onLogin?.());
      
      const registerBtn = document.createElement('button');
      registerBtn.className = 'top-bar-auth-button primary';
      registerBtn.textContent = 'Register';
      registerBtn.addEventListener('click', () => this.config.onRegister?.());
      
      this.authContainer.appendChild(loginBtn);
      this.authContainer.appendChild(registerBtn);
    }
  }

  // ... (rest of the class remains the same: dropdowns, menus, etc.)

  private createDropdownMenu(label: string, items: Array<HTMLElement | 'divider'>): HTMLElement {
    const item = document.createElement('div');
    item.className = 'top-bar-menu-item';

    const button = document.createElement('button');
    button.className = 'top-bar-menu-button';
    button.textContent = label;

    const dropdown = document.createElement('div');
    dropdown.className = 'top-bar-dropdown';

    for (const entry of items) {
      if (entry === 'divider') {
        const divider = document.createElement('div');
        divider.className = 'top-bar-dropdown-divider';
        dropdown.appendChild(divider);
      } else {
        dropdown.appendChild(entry);
      }
    }

    const toggle = (open?: boolean) => {
      const shouldOpen = open ?? !item.classList.contains('active');
      this.closeAllMenus();
      if (shouldOpen) {
        item.classList.add('active');
        this.activeMenu = dropdown;
      }
    };

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    dropdown.addEventListener('click', (e) => e.stopPropagation());

    item.appendChild(button);
    item.appendChild(dropdown);
    return item;
  }

  private buildFileMenu(): Array<HTMLElement | 'divider'> {
    const pm = this.config.projectManager;
    const items: Array<HTMLElement | 'divider'> = [];

    const newProjectAction =
      this.config.onNewProject !== undefined
        ? () => this.config.onNewProject?.()
        : () => pm?.newProject?.();
    items.push(this.menuItem('New Project', 'new', 'Ctrl+N', newProjectAction));
    
    items.push(this.menuItem('Open...', 'load', 'Ctrl+O', () => pm?.showLoadDialog()));
    items.push(this.menuItem('Save', 'save', 'Ctrl+S', () => pm?.saveProject()));
    items.push(this.menuItem('Save As...', 'save', 'Ctrl+Shift+S', () => pm?.saveProjectAs?.()));
    
    return items;
  }

  private buildEditMenu(): Array<HTMLElement | 'divider'> {
    const items: Array<HTMLElement | 'divider'> = [];
    items.push(this.menuItem('Undo', 'undo', 'Ctrl+Z', () => this.config.onUndo()));
    items.push(this.menuItem('Redo', 'redo', 'Ctrl+Y', () => this.config.onRedo()));
    return items;
  }

  private buildViewMenu(): Array<HTMLElement | 'divider'> {
    const items: Array<HTMLElement | 'divider'> = [];
    // Snap/Grid moved here only (already present in previous version, confirming they stay)
    items.push(this.menuItem('Toggle Grid', 'grid', 'G', () => this.config.toggleGrid()));
    items.push(this.menuItem('Toggle Snap', 'snap', 'X', () => this.config.toggleSnap()));
    items.push('divider');
    items.push(this.menuItem('Script Workbench', 'code', 'Ctrl+Shift+S', () => this.config.onOpenScriptWorkbench?.()));
    if (this.config.onOpenUIEditor) {
      items.push(this.menuItem('UI Editor', 'layout', 'Ctrl+Shift+U', () => this.config.onOpenUIEditor?.()));
    }
    return items;
  }

  private buildCameraMenu(): Array<HTMLElement | 'divider'> {
    this.cameraButtons = {};
    const items: Array<HTMLElement | 'divider'> = [];
    items.push(this.createCameraMenuItem('Editor Free-Fly', 'move', 'free-fly'));
    return items;
  }

  private buildHelpMenu(): Array<HTMLElement | 'divider'> {
    const items: Array<HTMLElement | 'divider'> = [];
    items.push(this.menuItem('Keyboard Shortcuts', 'help', '?', () => {
      if (this.config.showShortcuts) {
        this.config.showShortcuts();
      } else {
        try {
          new KeyboardShortcutsModal().show();
        } catch {}
      }
    }));
    return items;
  }

  private menuItem(label: string, iconName: string, shortcut: string | undefined, action: () => void): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'top-bar-dropdown-item';
    el.appendChild(createIcon(iconName as any, 14));
    const span = document.createElement('span');
    span.textContent = label;
    el.appendChild(span);
    if (shortcut) {
      const sc = document.createElement('span');
      sc.className = 'top-bar-dropdown-shortcut';
      sc.textContent = shortcut;
      el.appendChild(sc);
    }
    el.addEventListener('click', () => {
      action();
      this.closeAllMenus();
    });
    return el;
  }

  private createCameraMenuItem(label: string, iconName: string, type: CameraType): HTMLButtonElement {
    const button = this.menuItem(label, iconName, undefined, () => {
      this.config.onCameraChange?.(type);
    });
    button.dataset.cameraType = type;
    button.classList.add('top-bar-dropdown-camera-item');
    button.setAttribute('role', 'menuitemradio');
    button.setAttribute('aria-checked', 'false');

    this.cameraButtons[type] = button;
    return button;
  }

  private updateCameraSelection(active: CameraType): void {
    (Object.entries(this.cameraButtons) as Array<[CameraType, HTMLButtonElement | undefined]>).forEach(([type, button]) => {
      if (!button) return;
      const isActive = type === active;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-checked', String(isActive));
    });
  }

  private closeAllMenus(): void {
    if (!this.container) return;
    const open = this.container.querySelectorAll('.top-bar-menu-item.active');
    open.forEach((e) => e.classList.remove('active'));
    this.activeMenu = null;
  }

  public updateHistoryButtons(): void {
    if (this.btnUndo) this.btnUndo.disabled = !this.config.canUndo();
    if (this.btnRedo) this.btnRedo.disabled = !this.config.canRedo();
  }

  public setSaveStatus(_status: 'Saved' | 'Unsaved' | 'Saving...' | '' = ''): void {
    if (!this.saveStatusEl) return;
    this.saveStatusEl.textContent = _status;
  }

  /** Legacy no-op to preserve API. */
  public toggle(): void {
    // No-op; top bar is always visible
  }

  public dispose(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.activeMenu = null;
    this.btnUndo = null;
    this.btnRedo = null;
    this.saveStatusEl = null;
  }

  private updateModeButton(): void {
    if (!this.modeBtn) return;
    const mode = this.config.state.editorMode.value;
    this.modeBtn.innerHTML = '';
    this.modeBtn.appendChild(createIcon(mode === 'edit' ? 'edit' : 'play', 14));
    const label = document.createElement('span');
    label.textContent = mode === 'edit' ? 'Edit Mode' : 'Play Mode';
    this.modeBtn.appendChild(label);
    this.modeBtn.classList.toggle('primary', mode === 'play');
    this.modeBtn.classList.toggle('play-active', mode === 'play');
  }
}
