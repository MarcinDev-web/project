/**
 * EditorToolbar - Modern Toolbar with Advanced Features
 *
 * Features:
 * - Dropdown menu system (File, Edit, View, Help)
 * - Breadcrumbs navigation for entity hierarchy
 * - Integrated search bar
 * - Command palette
 * - Keyboard shortcuts display
 * - Modern design with better visual grouping
 * - Quick actions menu
 * - User settings dropdown
 */

import type { EditorState } from '../core/state';
import type { ProjectManager } from '../managers/ProjectManager';
import type { Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { DisposableGroup } from '@engine/core/utils';
import { Logger } from '../../utils/logger';
import { effect } from '@preact/signals-core';
import { createIcon, createIconButton } from '../utils/icons';
import { CameraComponent } from '@engine/world/components/CameraComponent';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
// use value import below to construct entities
import { Entity as EntityValue } from '@engine/world';
import { EnvironmentComponent } from '@engine/world/components/EnvironmentComponent';

export interface EditorToolbarConfig {
  state: EditorState;
  selection: SelectionManager;
  projectManager: ProjectManager | null;
  onNewProject?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getSelectedEntity?: () => Entity | null;
  onSearch?: (query: string) => void;
  onSelectEntity?: (entity: Entity) => void;
  onCreateCamera?: (entity: Entity) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onSelectAll?: () => void;
  onFocusPanel?: (panel: 'assets' | 'entities' | 'components' | 'settings') => void;
  onToggleCollaboration?: () => void;
  isCollaborating?: () => boolean;
  onEntityCreated?: (entity: Entity) => void;
  onEntityDeleted?: (entityId: string) => void;
}

interface DropdownMenuItem {
  label?: string;
  icon?: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  submenu?: DropdownMenuItem[];
}

/**
 * Modern toolbar with advanced features
 */
export class EditorToolbar {
  private readonly disposables = new DisposableGroup();

  private root: HTMLElement | null = null;
  private btnUndo: HTMLButtonElement | null = null;
  private btnRedo: HTMLButtonElement | null = null;
  private historyLimitInput: HTMLInputElement | null = null;
  private saveStatusEl: HTMLSpanElement | null = null;
  private breadcrumbsEl: HTMLElement | null = null;
  // private searchInput: HTMLInputElement | null = null; // Removed - searchbar disabled
  private activeMenu: HTMLElement | null = null;
  private shortcutsModal: KeyboardShortcutsModal | null = null;

  constructor(private readonly config: EditorToolbarConfig) {
    this.shortcutsModal = new KeyboardShortcutsModal();
  }

  /**
   * Mounts the toolbar to the specified container.
   */
  mount(container: HTMLElement): void {
    if (this.root) {
      Logger.warn('EditorToolbar: Already mounted');
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar-v2';

    // Top row - Menu bar and quick actions
    const topRow = this.createTopRow();
    toolbar.appendChild(topRow);

    // Bottom row - Tools and breadcrumbs
    const bottomRow = this.createBottomRow();
    toolbar.appendChild(bottomRow);

    container.appendChild(toolbar);
    this.root = toolbar;

    // Set up reactive updates
    this.setupReactivity();

    // Initial update
    this.updateHistoryButtons();
    this.updateBreadcrumbs();

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (this.activeMenu && !this.activeMenu.contains(e.target as Node)) {
        this.closeAllMenus();
      }
    });
  }

  /**
   * Creates the top row with menu bar
   */
  private createTopRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'toolbar-v2-top-row';

    // Brand section
    const brand = this.createBrandSection();
    row.appendChild(brand);

    // Menu bar
    const menuBar = this.createMenuBar();
    row.appendChild(menuBar);

    // Search bar - removed for cleaner UI
    // const search = this.createSearchBar();
    // row.appendChild(search);

    // Actions section (right-aligned)
    const actions = this.createQuickActions();
    row.appendChild(actions);

    return row;
  }

  /**
   * Creates the bottom row with tools and breadcrumbs
   */
  private createBottomRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'toolbar-v2-bottom-row';

    // History controls
    const history = this.createHistoryControls();
    row.appendChild(history);

    // Transform tools
    const transform = this.createTransformTools();
    row.appendChild(transform);

    // Snap & Grid
    const snapGrid = this.createSnapGridControls();
    row.appendChild(snapGrid);

    // Breadcrumbs navigation
    this.breadcrumbsEl = this.createBreadcrumbs();
    row.appendChild(this.breadcrumbsEl);

    // Status indicators
    const status = this.createStatusIndicators();
    row.appendChild(status);

    return row;
  }

  /**
   * Creates brand section with logo
   */
  private createBrandSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'toolbar-v2-brand';

    const logo = document.createElement('div');
    logo.className = 'toolbar-v2-logo';
    
    const icon = createIcon('cube', 20);
    logo.appendChild(icon);
    
    const title = document.createElement('span');
    title.className = 'toolbar-v2-title';
    title.textContent = 'Scene Editor';
    
    logo.appendChild(title);
    section.appendChild(logo);

    return section;
  }

  /**
   * Creates menu bar with dropdowns
   */
  private createMenuBar(): HTMLElement {
    const menuBar = document.createElement('div');
    menuBar.className = 'toolbar-v2-menu-bar';

    const menuConfig = this.buildMenuConfig();

    Object.entries(menuConfig).forEach(([label, items]) => {
      menuBar.appendChild(this.createDropdownMenu(label, items));
    });

    return menuBar;
  }

  private buildMenuConfig(): Record<string, DropdownMenuItem[]> {
    const isSharedView = this.config.state.isSharedView.value;

    const toggleSnap = (): void => {
      this.config.state.snapConfig.value = {
        ...this.config.state.snapConfig.value,
        enabled: !this.config.state.snapConfig.value.enabled,
      };
    };

    const toggleGrid = (): void => {
      this.config.state.showGrid.value = !this.config.state.showGrid.value;
    };

    // No-op action for disabled items in shared view
    const disabledAction = (): void => {
      // Silent - item is disabled
    };

    return {
      File: [
        {
          label: 'New Project',
          icon: 'new',
          shortcut: 'Ctrl+N',
          action: isSharedView ? disabledAction : (() => {
            if (this.config.onNewProject) {
              this.config.onNewProject();
            } else {
              void this.config.projectManager?.newProject();
            }
          }),
        },
        {
          label: 'Add Environment',
          icon: 'sun',
          action: isSharedView ? disabledAction : (() => this.addEnvironmentIfMissing()),
        },
        {
          label: 'Open...',
          icon: 'load',
          shortcut: 'Ctrl+O',
          action: isSharedView ? disabledAction : (() => this.config.projectManager?.showLoadDialog()),
        },
        {
          label: 'Save',
          icon: 'save',
          shortcut: 'Ctrl+S',
          action: isSharedView ? disabledAction : (() => this.config.projectManager?.saveProject()),
        },
        {
          label: 'Save As...',
          icon: 'save',
          shortcut: 'Ctrl+Shift+S',
          action: isSharedView ? disabledAction : (() => this.config.projectManager?.saveProjectAs()),
        },
        {
          label: 'Share Project',
          icon: 'share',
          action: isSharedView ? disabledAction : (() => this.config.projectManager?.shareProject()),
        },
        { divider: true },
        { label: 'Export...', icon: 'load', action: isSharedView ? disabledAction : (() => {}) },
        { label: 'Import...', icon: 'load', action: isSharedView ? disabledAction : (() => {}) },
      ],
      Edit: [
        { label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z', action: isSharedView ? disabledAction : (() => this.config.onUndo()) },
        { label: 'Redo', icon: 'redo', shortcut: 'Ctrl+Y', action: isSharedView ? disabledAction : (() => this.config.onRedo()) },
        { divider: true },
        { label: 'Cut', icon: 'trash', shortcut: 'Ctrl+X', action: isSharedView ? disabledAction : (() => this.config.onCut?.()) },
        { label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C', action: () => this.config.onCopy?.() }, // Copy is allowed
        { label: 'Paste', icon: 'paste', shortcut: 'Ctrl+V', action: isSharedView ? disabledAction : (() => this.config.onPaste?.()) },
        { label: 'Duplicate', icon: 'copy', shortcut: 'Ctrl+D', action: isSharedView ? disabledAction : (() => this.config.onDuplicate?.()) },
        { divider: true },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => this.config.onSelectAll?.() }, // Selection is allowed
      ],
      View: [
        { label: 'Toggle Grid', icon: 'grid', shortcut: 'G', action: toggleGrid },
        { label: 'Toggle Snap', icon: 'snap', shortcut: 'X', action: toggleSnap },
        { divider: true },
        { label: 'Wireframe Mode', action: () => {} },
        { label: 'Show Statistics', action: () => {} },
        {
          label: 'Camera Presets',
          submenu: [
            { label: 'Top View', action: () => {} },
            { label: 'Front View', action: () => {} },
            { label: 'Side View', action: () => {} },
            { label: 'Perspective', action: () => {} },
          ],
        },
      ],
      Help: [
        {
          label: 'Keyboard Shortcuts',
          icon: 'help',
          shortcut: '?',
          action: () => this.showKeyboardShortcuts(),
        },
        { label: 'Documentation', icon: 'help', action: () => {} },
        { divider: true },
        { label: 'About', icon: 'info', action: () => {} },
      ],
      Assets: [
        {
          label: 'Assets',
          icon: 'box',
          action: () => this.config.onFocusPanel?.('assets'),
        },
      ],
    };
  }

  private addEnvironmentIfMissing(): void {
    try {
      const scene = this.config.state.scene.value;
      const exists = scene.findEntitiesByName('Environment').length > 0;
      if (exists) {
        this.config.projectManager?.markUnsaved();
        return;
      }
      const env = new EntityValue('Environment');
      env.addComponent(new EnvironmentComponent());
      scene.addEntity(env);
      this.config.projectManager?.markUnsaved();
    } catch (err) {
      Logger.warn('Add Environment failed:', err as unknown as Error);
    }
  }

  /**
   * Creates a dropdown menu
   */
  private createDropdownMenu(label: string, items: DropdownMenuItem[]): HTMLElement {
    const menuContainer = document.createElement('div');
    menuContainer.className = 'toolbar-v2-menu';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'toolbar-v2-menu-btn';
    menuButton.textContent = label;

    const dropdown = document.createElement('div');
    dropdown.className = 'toolbar-v2-dropdown';
    dropdown.style.display = 'none';

    // Populate menu items
    items.forEach(item => {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'toolbar-v2-dropdown-divider';
        dropdown.appendChild(divider);
        return;
      }

      const menuItem = document.createElement('button');
      menuItem.type = 'button';
      menuItem.className = 'toolbar-v2-dropdown-item';

      if (item.icon) {
        menuItem.appendChild(createIcon(item.icon as any, 14));
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label ?? '';
      menuItem.appendChild(labelSpan);

      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.className = 'toolbar-v2-shortcut';
        shortcut.textContent = item.shortcut;
        menuItem.appendChild(shortcut);
      }

      if (item.submenu) {
        menuItem.classList.add('has-submenu');
        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.className = 'toolbar-v2-submenu-arrow';
        menuItem.appendChild(arrow);
        
        // Create submenu dropdown
        const submenu = this.createSubmenu(item.submenu, menuItem);
        menuItem.appendChild(submenu);
        
        // Prevent closing parent menu when clicking on submenu item
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          // Don't close menu if submenu exists - let hover handle it
        });
      } else {
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.action) {
            item.action();
          }
          this.closeAllMenus();
        });
      }

      dropdown.appendChild(menuItem);
    });

    menuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'block';
      this.closeAllMenus();
      if (!isOpen) {
        dropdown.style.display = 'block';
        this.activeMenu = dropdown;
      }
    });

    menuContainer.appendChild(menuButton);
    menuContainer.appendChild(dropdown);

    return menuContainer;
  }

  /**
   * Creates a submenu dropdown for a menu item
   */
  private createSubmenu(submenuItems: DropdownMenuItem[], parentItem: HTMLElement): HTMLElement {
    const submenu = document.createElement('div');
    submenu.className = 'toolbar-v2-submenu';

    submenuItems.forEach(subItem => {
      if (subItem.divider) {
        const divider = document.createElement('div');
        divider.className = 'toolbar-v2-dropdown-divider';
        submenu.appendChild(divider);
        return;
      }

      const submenuItem = document.createElement('button');
      submenuItem.type = 'button';
      submenuItem.className = 'toolbar-v2-dropdown-item';

      if (subItem.icon) {
        submenuItem.appendChild(createIcon(subItem.icon as any, 14));
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = subItem.label ?? '';
      submenuItem.appendChild(labelSpan);

      if (subItem.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.className = 'toolbar-v2-shortcut';
        shortcut.textContent = subItem.shortcut;
        submenuItem.appendChild(shortcut);
      }

      // Support nested submenus (recursive)
      if (subItem.submenu) {
        submenuItem.classList.add('has-submenu');
        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.className = 'toolbar-v2-submenu-arrow';
        submenuItem.appendChild(arrow);
        
        const nestedSubmenu = this.createSubmenu(subItem.submenu, submenuItem);
        submenuItem.appendChild(nestedSubmenu);
        
        submenuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          // Don't close menu if nested submenu exists
        });
      } else {
        submenuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          if (subItem.action) {
            subItem.action();
          }
          this.closeAllMenus();
        });
      }

      submenu.appendChild(submenuItem);
    });

    // Prevent clicks inside submenu from closing parent menu
    submenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    return submenu;
  }

  /**
   * Creates search bar
   * REMOVED - Searchbar disabled for cleaner UI
   */
  // private createSearchBar(): HTMLElement {
  //   const container = document.createElement('div');
  //   container.className = 'toolbar-v2-search';

  //   const searchIcon = createIcon('search', 16);
  //   searchIcon.setAttribute('class', 'toolbar-v2-search-icon');
  //   
  //   this.searchInput = document.createElement('input');
  //   this.searchInput.type = 'search';
  //   this.searchInput.className = 'toolbar-v2-search-input';
  //   this.searchInput.placeholder = 'Search entities... (Ctrl+K)';

  //   this.searchInput.addEventListener('input', () => {
  //     if (this.config.onSearch) {
  //       this.config.onSearch(this.searchInput!.value);
  //     }
  //   });

  //   // Focus on Ctrl+K
  //   document.addEventListener('keydown', (e) => {
  //     if (e.ctrlKey && e.key === 'k') {
  //       e.preventDefault();
  //       this.searchInput?.focus();
  //     }
  //   });

  //   container.appendChild(searchIcon);
  //   container.appendChild(this.searchInput);

  //   return container;
  // }

  /**
   * Creates quick actions section
   */
  private createQuickActions(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'toolbar-v2-actions';

    // Mode selector
    const modeBtn = document.createElement('button');
    modeBtn.type = 'button';
    modeBtn.className = 'toolbar-v2-mode-btn';
    
    effect(() => {
      const mode = this.config.state.editorMode.value;
      const isSharedView = this.config.state.isSharedView.value;
      modeBtn.innerHTML = '';
      modeBtn.appendChild(createIcon(mode === 'edit' ? 'edit' : 'play', 16));
      const text = document.createElement('span');
      if (isSharedView) {
        text.textContent = 'View Only';
        modeBtn.style.opacity = '0.6';
        modeBtn.style.cursor = 'not-allowed';
      } else {
        text.textContent = mode === 'edit' ? 'Edit Mode' : 'Play Mode';
        modeBtn.style.opacity = '1';
        modeBtn.style.cursor = 'pointer';
      }
      modeBtn.appendChild(text);
    });

    modeBtn.addEventListener('click', () => {
      // Block mode switching in shared view
      if (this.config.state.isSharedView.value) {
        return;
      }
      const current = this.config.state.editorMode.value;
      this.config.state.editorMode.value = current === 'edit' ? 'play' : 'edit';
    });

    // Build mode indicator
    const buildBtn = document.createElement('button');
    buildBtn.type = 'button';
    buildBtn.className = 'toolbar-v2-build-btn';
    
    effect(() => {
      const mode = this.config.state.buildMode.value;
      buildBtn.textContent = mode === 'free' ? '∞ Free' : '⚡ Survival';
      buildBtn.classList.toggle('limited', mode === 'limited');
    });

    buildBtn.addEventListener('click', () => {
      const current = this.config.state.buildMode.value;
      this.config.state.buildMode.value = current === 'free' ? 'limited' : 'free';
    });

    const cameraMenu = this.createCameraMenu();

    // Collaboration button
    const collaborationBtn = createIconButton('users', {
      title: 'Collaboration',
      className: 'toolbar-v2-icon-btn',
    });
    
    if (this.config.isCollaborating) {
      effect(() => {
        const isActive = this.config.isCollaborating?.() ?? false;
        collaborationBtn.classList.toggle('active', isActive);
        collaborationBtn.style.opacity = isActive ? '1' : '0.7';
      });
    }
    
    collaborationBtn.addEventListener('click', () => {
      this.config.onToggleCollaboration?.();
    });

    // Settings button
    const settingsBtn = createIconButton('settings', {
      title: 'Settings',
      className: 'toolbar-v2-icon-btn',
    });

    section.appendChild(modeBtn);
    section.appendChild(buildBtn);
    section.appendChild(cameraMenu);
    section.appendChild(collaborationBtn);
    section.appendChild(settingsBtn);

    return section;
  }

  private createCameraMenu(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'toolbar-v2-camera-menu';

    const button = createIconButton('camera', {
      title: 'Cameras',
      className: 'toolbar-v2-icon-btn',
    });

    const dropdown = document.createElement('div');
    dropdown.className = 'toolbar-v2-camera-dropdown';
    dropdown.style.display = 'none';

    const toggleDropdown = (open?: boolean) => {
      const shouldOpen = open ?? dropdown.style.display !== 'block';
      this.closeAllMenus();
      dropdown.style.display = shouldOpen ? 'block' : 'none';
      this.activeMenu = shouldOpen ? dropdown : null;
    };

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleDropdown();
      if (dropdown.style.display === 'block') {
        this.populateCameraDropdown(dropdown);
      }
    });

    dropdown.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    const dismiss = (event: MouseEvent) => {
      if (!dropdown.contains(event.target as Node) && event.target !== button) {
        toggleDropdown(false);
      }
    };

    document.addEventListener('click', dismiss);
    this.disposables.add(() => document.removeEventListener('click', dismiss));

    container.appendChild(button);
    container.appendChild(dropdown);
    return container;
  }

  private populateCameraDropdown(dropdown: HTMLElement): void {
    dropdown.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'camera-dropdown-header';
    header.textContent = 'Scene Cameras';
    dropdown.appendChild(header);

    const scene = this.config.state.scene.value;
    const cameras = scene.cameras;
    const primary = scene.primaryCamera;

    if (cameras.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'camera-dropdown-empty';
      empty.textContent = 'No cameras in scene';
      dropdown.appendChild(empty);
    } else {
      for (const cameraEntity of cameras) {
        dropdown.appendChild(this.createCameraEntry(cameraEntity, cameraEntity === primary));
      }
    }

    const divider = document.createElement('div');
    divider.className = 'camera-dropdown-divider';
    dropdown.appendChild(divider);

    const createButton = document.createElement('button');
    createButton.type = 'button';
    createButton.className = 'camera-dropdown-create';
    createButton.appendChild(createIcon('plus', 14));
    createButton.appendChild(document.createTextNode('Add Camera'));
    createButton.addEventListener('click', () => {
      const entity = this.handleCreateCamera();
      this.populateCameraDropdown(dropdown);
      if (entity) {
        this.config.onCreateCamera?.(entity);
      }
    });
    dropdown.appendChild(createButton);
  }

  private createCameraEntry(entity: Entity, isPrimary: boolean): HTMLElement {
    const row = document.createElement('div');
    row.className = 'camera-dropdown-item';

    const info = document.createElement('button');
    info.type = 'button';
    info.className = 'camera-dropdown-info';
    info.appendChild(createIcon('camera', 14));

    const name = document.createElement('span');
    name.className = 'camera-dropdown-name';
    name.textContent = entity.name;
    info.appendChild(name);

    info.addEventListener('click', () => {
      this.config.onSelectEntity?.(entity);
    });

    const primaryBtn = document.createElement('button');
    primaryBtn.type = 'button';
    primaryBtn.className = 'camera-dropdown-primary';
    primaryBtn.title = isPrimary ? 'Primary camera' : 'Set primary camera';
    primaryBtn.appendChild(createIcon(isPrimary ? 'check' : 'circle', 14));
    primaryBtn.addEventListener('click', () => {
      const scene = this.config.state.scene.value;
      scene.setPrimaryCamera(entity);
      this.populateCameraDropdown(row.parentElement as HTMLElement);
      this.config.onSelectEntity?.(entity);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'camera-dropdown-delete';
    deleteBtn.title = 'Delete camera';
    deleteBtn.appendChild(createIcon('trash', 14));
    deleteBtn.addEventListener('click', () => {
      const entityId = entity.id;
      if (entity.parent) {
        entity.removeFromParent();
      } else {
        this.config.state.scene.value.removeEntity(entity);
      }
      // Replicate entity deletion
      this.config.onEntityDeleted?.(entityId);
      this.populateCameraDropdown(row.parentElement as HTMLElement);
      this.config.projectManager?.markUnsaved();
      this.config.selection.clearSelection();
    });

    row.appendChild(info);
    row.appendChild(primaryBtn);
    row.appendChild(deleteBtn);
    return row;
  }

  private handleCreateCamera(): Entity | null {
    const scene = this.config.state.scene.value;
    const cameraEntity = scene.createEntity('Camera');
    if (!cameraEntity.hasComponent(CameraComponent)) {
      cameraEntity.addComponent(new CameraComponent());
    }
    cameraEntity.userData.isCamera = true;
    cameraEntity.transform.position = [0, 3, 6];
    this.config.projectManager?.markUnsaved();
    scene.setPrimaryCamera(cameraEntity);
    // Replicate entity creation
    this.config.onEntityCreated?.(cameraEntity);
    return cameraEntity;
  }

  /**
   * Creates history controls
   */
  private createHistoryControls(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'toolbar-v2-group';

    this.btnUndo = createIconButton('undo', {
      title: 'Undo (Ctrl+Z)',
      onClick: () => this.config.onUndo(),
      className: 'toolbar-v2-icon-btn',
    });

    this.btnRedo = createIconButton('redo', {
      title: 'Redo (Ctrl+Y)',
      onClick: () => this.config.onRedo(),
      className: 'toolbar-v2-icon-btn',
    });

    group.appendChild(this.btnUndo);
    group.appendChild(this.btnRedo);

    // History limit input (for tests and quick tweaking)
    const limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.className = 'toolbar-v2-input';
    limitInput.min = '1';
    limitInput.step = '1';
    limitInput.title = 'History limit';
    try {
      limitInput.value = String(this.config.state.history.limit);
    } catch {
      limitInput.value = '100';
    }
    limitInput.addEventListener('change', () => {
      const parsed = Number.parseInt(limitInput.value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        try {
          this.config.state.setHistoryLimit(parsed);
        } catch {
          // ignore invalid set in some environments
        }
      }
    });
    this.historyLimitInput = limitInput;
    group.appendChild(limitInput);

    return group;
  }

  /**
   * Creates transform tools
   */
  private createTransformTools(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'toolbar-v2-group toolbar-v2-transform-group';

    const btnMove = createIconButton('move', {
      title: 'Move (W)',
      onClick: () => { this.config.state.gizmoMode.value = 'translate'; },
      className: 'toolbar-v2-tool-btn',
    });

    const btnRotate = createIconButton('rotate', {
      title: 'Rotate (E)',
      onClick: () => { this.config.state.gizmoMode.value = 'rotate'; },
      className: 'toolbar-v2-tool-btn',
    });

    const btnScale = createIconButton('scale', {
      title: 'Scale (R)',
      onClick: () => { this.config.state.gizmoMode.value = 'scale'; },
      className: 'toolbar-v2-tool-btn',
    });

    // Highlight active mode
    effect(() => {
      const mode = this.config.state.gizmoMode.value;
      btnMove.classList.toggle('active', mode === 'translate');
      btnRotate.classList.toggle('active', mode === 'rotate');
      btnScale.classList.toggle('active', mode === 'scale');
    });

    group.appendChild(btnMove);
    group.appendChild(btnRotate);
    group.appendChild(btnScale);

    return group;
  }

  /**
   * Creates snap and grid controls
   */
  private createSnapGridControls(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'toolbar-v2-group';

    // Snap toggle
    const snapBtn = createIconButton('snap', {
      title: 'Toggle Snap (X)',
      onClick: () => {
        this.config.state.snapConfig.value = {
          ...this.config.state.snapConfig.value,
          enabled: !this.config.state.snapConfig.value.enabled,
        };
      },
      className: 'toolbar-v2-icon-btn',
    });

    // Grid toggle
    const gridBtn = createIconButton('grid', {
      title: 'Toggle Grid (G)',
      onClick: () => {
        this.config.state.showGrid.value = !this.config.state.showGrid.value;
      },
      className: 'toolbar-v2-icon-btn',
    });

    // Snap increment input
    const snapInput = document.createElement('input');
    snapInput.type = 'number';
    snapInput.className = 'toolbar-v2-input';
    snapInput.step = '0.25';
    snapInput.min = '0.1';
    snapInput.value = String(this.config.state.snapConfig.value.increment);
    snapInput.title = 'Grid size';
    snapInput.style.width = '4rem';

    snapInput.addEventListener('change', () => {
      const v = Number.parseFloat(snapInput.value);
      if (Number.isFinite(v) && v > 0) {
        this.config.state.snapConfig.value = {
          ...this.config.state.snapConfig.value,
          increment: v,
        };
      }
    });

    // React to state changes
    effect(() => {
      const config = this.config.state.snapConfig.value;
      snapBtn.classList.toggle('active', config.enabled);
      snapInput.value = String(config.increment);
    });

    effect(() => {
      gridBtn.classList.toggle('active', this.config.state.showGrid.value);
    });

    // Easy Place toggle
    const easyPlaceBtn = createIconButton('play', {
      title: 'Toggle Easy Place (P)',
      onClick: () => {
        this.config.state.easyPlaceMode.value = !this.config.state.easyPlaceMode.value;
      },
      className: 'toolbar-v2-icon-btn toolbar-v2-easyplace-btn',
    });

    effect(() => {
      easyPlaceBtn.classList.toggle('active', this.config.state.easyPlaceMode.value);
    });

    // Pattern selector dropdown (shown when Easy Place is active)
    const patternBtn = document.createElement('button');
    patternBtn.type = 'button';
    patternBtn.className = 'toolbar-v2-pattern-btn';
    patternBtn.title = 'Change Pattern';
    
    const updatePatternButton = () => {
      const pattern = this.config.state.easyPlacePattern.value;
      patternBtn.textContent = pattern.charAt(0).toUpperCase() + pattern.slice(1);
      patternBtn.style.display = this.config.state.easyPlaceMode.value ? 'block' : 'none';
    };

    effect(() => {
      void this.config.state.easyPlaceMode.value;
      void this.config.state.easyPlacePattern.value;
      updatePatternButton();
    });

    patternBtn.addEventListener('click', () => {
      const patterns: Array<'single' | 'line' | 'grid' | 'circle'> = ['single', 'line', 'grid', 'circle'];
      const current = this.config.state.easyPlacePattern.value;
      const currentIndex = patterns.indexOf(current);
      const nextIndex = (currentIndex + 1) % patterns.length;
      this.config.state.easyPlacePattern.value = patterns[nextIndex]!;
    });

    updatePatternButton();

    group.appendChild(snapBtn);
    group.appendChild(snapInput);
    group.appendChild(gridBtn);
    group.appendChild(easyPlaceBtn);
    group.appendChild(patternBtn);

    return group;
  }

  /**
   * Creates breadcrumbs navigation
   */
  private createBreadcrumbs(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'toolbar-v2-breadcrumbs';
    return container;
  }

  /**
   * Updates breadcrumbs based on selection
   */
  private updateBreadcrumbs(): void {
    if (!this.breadcrumbsEl) return;

    this.breadcrumbsEl.innerHTML = '';

    const entity = this.config.getSelectedEntity?.();
    if (!entity) {
      const empty = document.createElement('span');
      empty.className = 'toolbar-v2-breadcrumb-empty';
      empty.textContent = 'No selection';
      this.breadcrumbsEl.appendChild(empty);
      return;
    }

    // Build hierarchy path
    const path: Entity[] = [];
    let current: Entity | null = entity;
    while (current) {
      path.unshift(current);
      current = current.parent;
    }

    path.forEach((item, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'toolbar-v2-breadcrumb-separator';
        separator.textContent = '›';
        this.breadcrumbsEl!.appendChild(separator);
      }

      const crumb = document.createElement('button');
      crumb.type = 'button';
      crumb.className = 'toolbar-v2-breadcrumb';
      crumb.textContent = item.name;
      crumb.title = item.name;
      
      if (index === path.length - 1) {
        crumb.classList.add('active');
      }

      this.breadcrumbsEl!.appendChild(crumb);
    });
  }

  /**
   * Creates status indicators
   */
  private createStatusIndicators(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'toolbar-v2-status';

    this.saveStatusEl = document.createElement('span');
    this.saveStatusEl.className = 'toolbar-v2-status-item';
    
    container.appendChild(this.saveStatusEl);

    return container;
  }

  /**
   * Closes all open menus and submenus
   */
  private closeAllMenus(): void {
    if (this.activeMenu) {
      this.activeMenu.style.display = 'none';
      this.activeMenu = null;
    }
    const allDropdowns = document.querySelectorAll('.toolbar-v2-dropdown');
    allDropdowns.forEach(dropdown => {
      (dropdown as HTMLElement).style.display = 'none';
    });
    // Close all submenus
    const allSubmenus = document.querySelectorAll('.toolbar-v2-submenu');
    allSubmenus.forEach(submenu => {
      (submenu as HTMLElement).style.display = 'none';
    });
  }

  /**
   * Shows keyboard shortcuts modal
   */
  private showKeyboardShortcuts(): void {
    this.shortcutsModal?.show();
  }

  /**
   * Sets up reactive updates
   */
  private setupReactivity(): void {
    // Update history buttons when history changes
    const updateButtons = effect(() => {
      void this.config.state.history.limit;
      this.updateHistoryButtons();
      // Keep history limit input in sync
      if (this.historyLimitInput) {
        try {
          this.historyLimitInput.value = String(this.config.state.history.limit);
        } catch {
          // ignore
        }
      }
    });
    this.disposables.add(() => updateButtons());

    // Update breadcrumbs when selection changes
    const updateBreadcrumbs = effect(() => {
      void this.config.state.selection.value;
      this.updateBreadcrumbs();
    });
    this.disposables.add(() => updateBreadcrumbs());
  }

  /**
   * Updates undo/redo button states
   */
  updateHistoryButtons(): void {
    if (this.btnUndo) {
      this.btnUndo.disabled = !this.config.canUndo();
    }
    if (this.btnRedo) {
      this.btnRedo.disabled = !this.config.canRedo();
    }
  }

  /**
   * Updates save status display
   */
  setSaveStatus(status: 'Saved' | 'Unsaved' | 'Saving...' | ''): void {
    if (!this.saveStatusEl) return;

    this.saveStatusEl.innerHTML = '';
    
    if (status === 'Saved') {
      this.saveStatusEl.appendChild(createIcon('check', 14));
      const text = document.createElement('span');
      text.textContent = 'Saved';
      this.saveStatusEl.appendChild(text);
      this.saveStatusEl.classList.add('success');
      this.saveStatusEl.classList.remove('warning');
    } else if (status === 'Unsaved') {
      this.saveStatusEl.appendChild(createIcon('warning', 14));
      const text = document.createElement('span');
      text.textContent = 'Unsaved changes';
      this.saveStatusEl.appendChild(text);
      this.saveStatusEl.classList.add('warning');
      this.saveStatusEl.classList.remove('success');
    } else {
      this.saveStatusEl.textContent = status;
      this.saveStatusEl.classList.remove('success', 'warning');
    }
  }

  /**
   * Checks if toolbar is mounted
   */
  isMounted(): boolean {
    return this.root !== null;
  }

  /**
   * Cleans up resources
   */
  dispose(): void {
    this.disposables.dispose();
    this.closeAllMenus();

    this.root = null;
    this.btnUndo = null;
    this.btnRedo = null;
    this.saveStatusEl = null;
    this.breadcrumbsEl = null;
    // this.searchInput = null; // Removed - searchbar disabled
    this.activeMenu = null;
  }
}

