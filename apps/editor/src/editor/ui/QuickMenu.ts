/**
 * QuickMenu - Cursor-like Top Bar (single row, always visible)
 * Replaces legacy floating quick menu and EditorToolbar mounting.
 */

import { effect } from '@preact/signals-core';
import type { EditorState } from '../core/state';
import type { ProjectManager } from '../managers/ProjectManager';
import { createIcon } from '../utils/icons';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { WorkflowSelector } from './WorkflowSelector';

export interface QuickMenuConfig {
  state: EditorState;
  projectManager?: ProjectManager | null;
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
  onOpenBlockEditor?: () => void;
  onGizmoModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  onRotationSnapChange: (mode: 'free' | '15deg' | '45deg' | '90deg') => void;
}

export class QuickMenu {
  private container: HTMLElement | null = null;
  private activeMenu: HTMLElement | null = null;
  // private searchInput: HTMLInputElement | null = null; // REMOVED - searchbar disabled
  private btnUndo: HTMLButtonElement | null = null;
  private btnRedo: HTMLButtonElement | null = null;
  private saveStatusEl: HTMLSpanElement | null = null;
  private workflowSelector: WorkflowSelector | null = null;
  private modeBtn: HTMLButtonElement | null = null;
  private isPlayMode = false;

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

    // Center: search - REMOVED for cleaner UI
    // const center = this.createCenterSection();
    // root.appendChild(center);

    // New: Transform tools section
    const transformTools = this.createTransformToolsSection();
    root.appendChild(transformTools);

    // Right: actions
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
      // Ctrl+K focus search - REMOVED (searchbar disabled)
      // if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      //   e.preventDefault();
      //   this.searchInput?.focus();
      // }
      // Escape closes dropdowns
      if (e.key === 'Escape') {
        this.closeAllMenus();
      }
    });

    // Initial state sync
    this.updateHistoryButtons();
    effect(() => this.updateModeButton());
  }

  public setPlayMode(active: boolean): void {
    this.isPlayMode = active;
    this.updateModeButton();
  }

  private createLeftSection(): HTMLElement {
    const left = document.createElement('div');
    left.className = 'top-bar-left';

    // Brand
    const brand = document.createElement('a');
    brand.className = 'top-bar-logo';
    brand.href = '#';
    const icon = createIcon('cube', 18);
    icon.classList.add('top-bar-logo-icon');
    const text = document.createElement('span');
    text.className = 'top-bar-logo-text';
    text.textContent = 'Scene Editor';
    brand.appendChild(icon);
    brand.appendChild(text);
    left.appendChild(brand);

    // Menu Bar
    const menuBar = document.createElement('div');
    menuBar.className = 'top-bar-menu-bar';
    menuBar.appendChild(this.createDropdownMenu('File', this.buildFileMenu()));
    menuBar.appendChild(this.createDropdownMenu('Edit', this.buildEditMenu()));
    menuBar.appendChild(this.createDropdownMenu('View', this.buildViewMenu()));
    menuBar.appendChild(this.createDropdownMenu('Help', this.buildHelpMenu()));
    left.appendChild(menuBar);

    // Workflow selector
    this.workflowSelector = new WorkflowSelector({
      state: this.config.state,
      onWorkflowChange: (preset) => {
        this.config.projectManager?.showStatusMessage?.(`Switched to ${preset} workflow`, 1500);
      },
    });
    const selectorElement = this.workflowSelector.render();
    selectorElement.classList.add('top-bar-workflow-selector');
    left.appendChild(selectorElement);

    return left;
  }

  // REMOVED - Searchbar disabled for cleaner UI
  // private createCenterSection(): HTMLElement {
  //   const center = document.createElement('div');
  //   center.className = 'top-bar-center';

  //   const search = document.createElement('div');
  //   search.className = 'top-bar-search';

  //   const searchIcon = createIcon('search', 14);
  //   searchIcon.classList.add('top-bar-search-icon');
  //   const input = document.createElement('input');
  //   input.type = 'search';
  //   input.className = 'top-bar-search-input';
  //   input.placeholder = 'Search entities... (Ctrl+K)';
  //   input.addEventListener('input', () => {
  //     this.config.onSearch?.(input.value);
  //   });

  //   search.appendChild(searchIcon);
  //   search.appendChild(input);
  //   center.appendChild(search);
  //   this.searchInput = input;
  //   return center;
  // }

  private createTransformToolsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'top-bar-transform-tools';

    // Transform Mode Group
    const transformGroup = document.createElement('div');
    transformGroup.className = 'top-bar-transform-group';

    // Move button (W)
    const moveBtn = document.createElement('button');
    moveBtn.className = 'top-bar-transform-button';
    moveBtn.title = 'Move Tool (W)';
    moveBtn.appendChild(createIcon('move', 14));
    const moveLabel = document.createElement('span');
    moveLabel.textContent = 'W';
    moveLabel.className = 'top-bar-transform-shortcut';
    moveBtn.appendChild(moveLabel);
    moveBtn.addEventListener('click', () => this.config.onGizmoModeChange('translate'));
    effect(() => {
      const active = this.config.state.gizmoMode.value === 'translate';
      moveBtn.classList.toggle('active', active);
    });

    // Rotate button (E)
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'top-bar-transform-button';
    rotateBtn.title = 'Rotate Tool (E)';
    rotateBtn.appendChild(createIcon('rotate', 14));
    const rotateLabel = document.createElement('span');
    rotateLabel.textContent = 'E';
    rotateLabel.className = 'top-bar-transform-shortcut';
    rotateBtn.appendChild(rotateLabel);
    rotateBtn.addEventListener('click', () => this.config.onGizmoModeChange('rotate'));
    effect(() => {
      const active = this.config.state.gizmoMode.value === 'rotate';
      rotateBtn.classList.toggle('active', active);
    });

    // Scale button (R)
    const scaleBtn = document.createElement('button');
    scaleBtn.className = 'top-bar-transform-button';
    scaleBtn.title = 'Scale Tool (R)';
    scaleBtn.appendChild(createIcon('scale', 14));
    const scaleLabel = document.createElement('span');
    scaleLabel.textContent = 'R';
    scaleLabel.className = 'top-bar-transform-shortcut';
    scaleBtn.appendChild(scaleLabel);
    scaleBtn.addEventListener('click', () => this.config.onGizmoModeChange('scale'));
    effect(() => {
      const active = this.config.state.gizmoMode.value === 'scale';
      scaleBtn.classList.toggle('active', active);
    });

    transformGroup.appendChild(moveBtn);
    transformGroup.appendChild(rotateBtn);
    transformGroup.appendChild(scaleBtn);

    // Rotation Snap Group - REMOVED for cleaner UI
    // const rotationGroup = document.createElement('div');
    // rotationGroup.className = 'top-bar-transform-group';

    // // Free rotation
    // const freeBtn = document.createElement('button');
    // freeBtn.className = 'top-bar-transform-button';
    // freeBtn.title = 'Free Rotation';
    // const freeLabel = document.createElement('span');
    // freeLabel.textContent = 'Free';
    // freeLabel.className = 'top-bar-transform-label';
    // freeBtn.appendChild(freeLabel);
    // freeBtn.addEventListener('click', () => this.config.onRotationSnapChange('free'));
    // effect(() => {
    //   const active = this.config.state.rotationSnapMode.value === 'free';
    //   freeBtn.classList.toggle('active', active);
    // });

    // // 15° snap
    // const snap15Btn = document.createElement('button');
    // snap15Btn.className = 'top-bar-transform-button';
    // snap15Btn.title = 'Snap to 15°';
    // const snap15Label = document.createElement('span');
    // snap15Label.textContent = '15°';
    // snap15Label.className = 'top-bar-transform-label';
    // snap15Btn.appendChild(snap15Label);
    // snap15Btn.addEventListener('click', () => this.config.onRotationSnapChange('15deg'));
    // effect(() => {
    //   const active = this.config.state.rotationSnapMode.value === '15deg';
    //   snap15Btn.classList.toggle('active', active);
    // });

    // // 45° snap
    // const snap45Btn = document.createElement('button');
    // snap45Btn.className = 'top-bar-transform-button';
    // snap45Btn.title = 'Snap to 45°';
    // const snap45Label = document.createElement('span');
    // snap45Label.textContent = '45°';
    // snap45Label.className = 'top-bar-transform-label';
    // snap45Btn.appendChild(snap45Label);
    // snap45Btn.addEventListener('click', () => this.config.onRotationSnapChange('45deg'));
    // effect(() => {
    //   const active = this.config.state.rotationSnapMode.value === '45deg';
    //   snap45Btn.classList.toggle('active', active);
    // });

    // // 90° snap
    // const snap90Btn = document.createElement('button');
    // snap90Btn.className = 'top-bar-transform-button';
    // snap90Btn.title = 'Snap to 90°';
    // const snap90Label = document.createElement('span');
    // snap90Label.textContent = '90°';
    // snap90Label.className = 'top-bar-transform-label';
    // snap90Btn.appendChild(snap90Label);
    // snap90Btn.addEventListener('click', () => this.config.onRotationSnapChange('90deg'));
    // effect(() => {
    //   const active = this.config.state.rotationSnapMode.value === '90deg';
    //   snap90Btn.classList.toggle('active', active);
    // });

    // rotationGroup.appendChild(freeBtn);
    // rotationGroup.appendChild(snap15Btn);
    // rotationGroup.appendChild(snap45Btn);
    // rotationGroup.appendChild(snap90Btn);

    section.appendChild(transformGroup);
    // section.appendChild(rotationGroup); // REMOVED

    return section;
  }

  private createRightSection(): HTMLElement {
    const right = document.createElement('div');
    right.className = 'top-bar-right';

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

    // Mode toggle (Edit/Play)
    const modeBtn = document.createElement('button');
    modeBtn.className = 'top-bar-action-button';
    modeBtn.title = 'Toggle Edit/Play Mode';
    this.modeBtn = modeBtn;
    modeBtn.addEventListener('click', () => {
      const current = this.config.state.editorMode.value;
      this.config.state.editorMode.value = current === 'edit' ? 'play' : 'edit';
    });
    this.updateModeButton();

    // Snap toggle
    const snapBtn = document.createElement('button');
    snapBtn.className = 'top-bar-icon-button';
    snapBtn.title = 'Toggle Snap (X)';
    snapBtn.appendChild(createIcon('snap', 14));
    snapBtn.addEventListener('click', () => this.config.toggleSnap());
    effect(() => {
      const enabled = this.config.state.snapConfig.value.enabled;
      snapBtn.classList.toggle('active', enabled);
    });

    // Grid toggle
    const gridBtn = document.createElement('button');
    gridBtn.className = 'top-bar-icon-button';
    gridBtn.title = 'Toggle Grid (G)';
    gridBtn.appendChild(createIcon('grid', 14));
    gridBtn.addEventListener('click', () => this.config.toggleGrid());
    effect(() => {
      const show = this.config.state.showGrid.value;
      gridBtn.classList.toggle('active', show);
    });

    // Assets Library - REMOVED for cleaner UI
    // const assetsBtn = document.createElement('button');
    // assetsBtn.className = 'top-bar-icon-button';
    // assetsBtn.title = 'Asset Library';
    // assetsBtn.appendChild(createIcon('package', 14));
    // assetsBtn.addEventListener('click', () => {
    //   if (this.config.onOpenAssets) {
    //     this.config.onOpenAssets();
    //   }
    // });

    // Custom Block Editor
    const blockEditorBtn = document.createElement('button');
    blockEditorBtn.className = 'top-bar-icon-button';
    blockEditorBtn.title = 'Custom Block Editor';
    blockEditorBtn.appendChild(createIcon('cube', 14));
    blockEditorBtn.addEventListener('click', () => {
      this.config.onOpenBlockEditor?.();
    });

    // Script Workbench
    const scriptBtn = document.createElement('button');
    scriptBtn.className = 'top-bar-icon-button';
    scriptBtn.title = 'Open Script Workbench (Ctrl+Shift+W)';
    scriptBtn.appendChild(createIcon('list', 14));
    scriptBtn.addEventListener('click', () => {
      if (this.config.onOpenScriptWorkbench) {
        this.config.onOpenScriptWorkbench();
      }
    });

    // Settings
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'top-bar-icon-button';
    settingsBtn.title = 'Settings';
    settingsBtn.appendChild(createIcon('settings', 14));

    // Save status (optional text)
    this.saveStatusEl = document.createElement('span');
    this.saveStatusEl.className = 'top-bar-save-status';

    right.appendChild(this.btnUndo);
    right.appendChild(this.btnRedo);
    right.appendChild(modeBtn);
    right.appendChild(snapBtn);
    right.appendChild(gridBtn);
    // right.appendChild(assetsBtn); // REMOVED - Asset Library button
    right.appendChild(blockEditorBtn);
    right.appendChild(scriptBtn);
    right.appendChild(settingsBtn);
    right.appendChild(this.saveStatusEl);

    return right;
  }

  private createDropdownMenu(label: string, items: Array<HTMLElement | 'divider'>): HTMLElement {
    const item = document.createElement('div');
    item.className = 'top-bar-menu-item';

    const button = document.createElement('button');
    button.className = 'top-bar-menu-button';
    button.textContent = label;

    const dropdown = document.createElement('div');
    dropdown.className = 'top-bar-dropdown';

    // Populate
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

    items.push(this.menuItem('New Project', 'new', undefined, () => pm?.newProject()));
    items.push(this.menuItem('Open...', 'load', 'Ctrl+O', () => pm?.showLoadDialog()));
    items.push(this.menuItem('Save', 'save', 'Ctrl+S', () => pm?.saveProject()));
    items.push(this.menuItem('Save As...', 'save', 'Ctrl+Shift+S', () => pm?.saveProjectAs?.()));
    items.push('divider');
    if (this.config.onOpenBlockEditor) {
      items.push(
        this.menuItem('Custom Block Editor', 'cube', 'Ctrl+Shift+B', () => {
          this.config.onOpenBlockEditor?.();
        })
      );
    }

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
    items.push(this.menuItem('Toggle Grid', 'grid', 'G', () => this.config.toggleGrid()));
    items.push(this.menuItem('Toggle Snap', 'snap', 'X', () => this.config.toggleSnap()));
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

  private menuItem(label: string, iconName: string, shortcut: string | undefined, action: () => void): HTMLElement {
    const el = document.createElement('button');
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

  private closeAllMenus(): void {
    if (!this.container) return;
    const open = this.container.querySelectorAll('.top-bar-menu-item.active');
    open.forEach((e) => e.classList.remove('active'));
    this.activeMenu = null;
  }

  /** Updates undo/redo button states. */
  public updateHistoryButtons(): void {
    if (this.btnUndo) this.btnUndo.disabled = !this.config.canUndo();
    if (this.btnRedo) this.btnRedo.disabled = !this.config.canRedo();
  }

  /** Optional status display from ProjectManager. */
  public setSaveStatus(_status: 'Saved' | 'Unsaved' | 'Saving...' | '' = ''): void {
    if (!this.saveStatusEl) return;
    // Keep minimal for now; can be enhanced later.
    this.saveStatusEl.textContent = _status;
  }

  /** Legacy no-op to preserve API. */
  public toggle(): void {
    // No-op; top bar is always visible
  }

  /** Disposes the top bar. */
  public dispose(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.activeMenu = null;
    // this.searchInput = null; // REMOVED - searchbar disabled
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
    label.textContent = mode === 'edit' ? 'Edit' : 'Play';
    this.modeBtn.appendChild(label);
    this.modeBtn.classList.toggle('primary', mode === 'play');
    this.modeBtn.classList.toggle('play-active', mode === 'play');
  }
}

