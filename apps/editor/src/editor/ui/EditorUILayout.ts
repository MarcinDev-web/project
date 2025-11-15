/**
 * EditorUILayout - Fullscreen Canvas Layout Manager
 *
 * Creates a modern fullscreen canvas layout with floating panels:
 * - Canvas: 100% viewport, fullscreen background
 * - Top: Floating toolbar (compact, glassmorphism)
 * - Left: Collapsible scene hierarchy panel
 * - Right: Collapsible properties inspector panel
 *
 * Features:
 * - Fullscreen canvas for maximum scene visibility
 * - Glassmorphism floating panels
 * - Smooth animations and transitions
 * - Toggle buttons for panels
 * - Professional aesthetics
 */

export interface EditorUILayoutConfig {
  canvas: HTMLCanvasElement;
  statusEl: HTMLElement;
  sceneMetricsProvider?: () => SceneMetrics;
}

export interface SceneMetrics {
  entityCount: number;
  selectedEntity: string | null;
  fps?: number;
  triangles?: number;
}

export class EditorUILayout {
  private layoutRoot: HTMLElement | null = null;
  private sidebar: HTMLElement | null = null;
  private inspector: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private inspectorToggle: HTMLElement | null = null;
  private keyboardCleanup: (() => void) | null = null;
  private shortcutsOverlay: HTMLElement | null = null;

  private sidebarCollapsed = true;  // Start closed - cleaner canvas
  private inspectorCollapsed = true; // Start closed - cleaner canvas

  constructor(private readonly config: EditorUILayoutConfig) {}

  /**
   * Creates and mounts the main editor layout.
   */
  mount(): {
    toolbar: HTMLElement;
    sidebar: HTMLElement;
    inspector: HTMLElement;
    canvasContainer: HTMLElement;
  } {
    if (this.layoutRoot) {
      throw new Error('EditorUILayout: Already mounted');
    }

    // Main layout container
    this.layoutRoot = document.createElement('div');
    this.layoutRoot.className = 'editor-layout';

    // Canvas container (fullscreen background)
    this.canvasContainer = document.createElement('main');
    this.canvasContainer.className = 'editor-canvas';
    this.canvasContainer.appendChild(this.config.canvas);

    // Toolbar hover trigger (invisible strip at top)
    const toolbarTrigger = document.createElement('div');
    toolbarTrigger.className = 'toolbar-hover-trigger';

    // Toolbar (floating at top, auto-hide)
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'editor-toolbar-container';
    
    // Append trigger first
    this.layoutRoot.appendChild(toolbarTrigger);

    // Sidebar (left panel - Scene hierarchy, collapsible)
    this.sidebar = document.createElement('aside');
    this.sidebar.className = 'editor-sidebar custom-scrollbar';
    this.sidebar.setAttribute('aria-label', 'Scene Hierarchy');

    // Inspector (right panel - Properties, collapsible)
    this.inspector = document.createElement('aside');
    this.inspector.className = 'editor-inspector custom-scrollbar';
    this.inspector.setAttribute('aria-label', 'Properties Inspector');


    // Create toggle button for inspector panel
    this.inspectorToggle = this.createToggleButton('right', () => this.toggleInspector());

    // Create keyboard shortcuts overlay
    this.shortcutsOverlay = this.createShortcutsOverlay();

    // Mark panels as open initially (better discoverability)
    if (this.sidebarCollapsed) {
      this.sidebar.classList.add('collapsed');
    }
    if (this.inspectorCollapsed) {
      this.inspector.classList.add('collapsed');
    }

    // Assemble layout
    document.body.appendChild(this.layoutRoot);
    this.layoutRoot.appendChild(this.canvasContainer);
    this.layoutRoot.appendChild(this.toolbar);
    this.layoutRoot.appendChild(this.sidebar);
    this.layoutRoot.appendChild(this.inspector);
    this.layoutRoot.appendChild(this.inspectorToggle);
    this.layoutRoot.appendChild(this.shortcutsOverlay);

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    return {
      toolbar: this.toolbar,
      sidebar: this.sidebar,
      inspector: this.inspector,
      canvasContainer: this.canvasContainer,
    };
  }

  /**
   * Enables or disables play mode presentation (hides editor UI).
   */
  setPlayMode(active: boolean): void {
    if (!this.layoutRoot) return;

    this.layoutRoot.classList.toggle('play-mode', active);

    const toggleElements: Array<HTMLElement | null> = [
      this.sidebar,
      this.inspector,
      this.inspectorToggle,
      this.toolbar,
      this.shortcutsOverlay,
    ];

    for (const el of toggleElements) {
      if (!el) continue;
      el.classList.toggle('hidden-in-play', active);
    }

    if (this.layoutRoot) {
      this.layoutRoot.setAttribute('data-play-mode', active ? 'true' : 'false');
    }
  }

  /**
   * Sets up keyboard shortcuts for panel toggling.
   */
  private setupKeyboardShortcuts(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Show keyboard shortcuts: ?
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.toggleShortcutsOverlay();
        return;
      }

      // Toggle left panel: Ctrl/Cmd + B
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        this.toggleSidebar();
      }
      
      // Toggle right panel: Ctrl/Cmd + I
      if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        event.preventDefault();
        this.toggleInspector();
      }

      // Toggle both panels: Ctrl/Cmd + \
      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault();
        if (this.sidebarCollapsed && this.inspectorCollapsed) {
          // Both collapsed, show both
          if (this.sidebarCollapsed) this.toggleSidebar();
          if (this.inspectorCollapsed) this.toggleInspector();
        } else {
          // At least one visible, hide both
          if (!this.sidebarCollapsed) this.toggleSidebar();
          if (!this.inspectorCollapsed) this.toggleInspector();
        }
      }

      // Toggle precision controls: P key
      if (event.key === 'p' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Check if we're not in a text input
        const target = event.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent('editor:toggle-precision-controls'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    this.keyboardCleanup = () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Creates a panel toggle button with tooltip and label.
   */
  private createToggleButton(position: 'left' | 'right', onClick: () => void): HTMLElement {
    const button = document.createElement('button');
    button.className = `panel-toggle ${position}`;
    button.setAttribute('type', 'button');
    
    const label = position === 'left' ? 'Scene' : 'Inspector';
    const shortcut = position === 'left' ? 'Ctrl+B' : 'Ctrl+I';
    const isCollapsed = position === 'left' ? this.sidebarCollapsed : this.inspectorCollapsed;
    
    button.setAttribute('aria-label', `Toggle ${label} Panel (${shortcut})`);
    button.setAttribute('aria-expanded', String(!isCollapsed));
    button.setAttribute('title', `Toggle ${label} Panel (${shortcut})`);
    
    // Icon direction based on collapsed state and position
    let icon: string;
    if (position === 'left') {
      // Left toggle: points right when collapsed, left when open
      icon = isCollapsed
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4L6 8l4 4"/></svg>';
    } else {
      // Right toggle: points left when collapsed, right when open
      icon = isCollapsed
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4L6 8l4 4"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';
    }
    
    button.innerHTML = `
      ${icon}
      <span class="panel-toggle-label">${label}</span>
    `;
    
    button.addEventListener('click', onClick);
    
    return button;
  }


  /**
   * Creates the keyboard shortcuts overlay.
   */
  private createShortcutsOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'shortcuts-overlay hidden';
    overlay.innerHTML = `
      <div class="shortcuts-panel">
        <div class="shortcuts-header">
          <h3>Keyboard Shortcuts</h3>
          <button class="shortcuts-close" aria-label="Close">×</button>
        </div>
        <div class="shortcuts-content">
          <div class="shortcuts-section">
            <h4>Panels</h4>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>B</kbd>
              <span>Toggle Scene Hierarchy</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>I</kbd>
              <span>Toggle Properties Inspector</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>\\</kbd>
              <span>Toggle All Panels</span>
            </div>
          </div>
          <div class="shortcuts-section">
            <h4>Precision Tools</h4>
            <div class="shortcut-item">
              <kbd>P</kbd>
              <span>Toggle Precision Tools Panel</span>
            </div>
            <div class="shortcut-item">
              <kbd>X</kbd>
              <span>Toggle Snap to Grid</span>
            </div>
            <div class="shortcut-item">
              <kbd>G</kbd>
              <span>Toggle Grid Visibility</span>
            </div>
            <div class="shortcut-item">
              <kbd>W</kbd>
              <span>Move Tool (Translate)</span>
            </div>
            <div class="shortcut-item">
              <kbd>E</kbd>
              <span>Rotate Tool</span>
            </div>
            <div class="shortcut-item">
              <kbd>R</kbd>
              <span>Scale Tool</span>
            </div>
          </div>
          <div class="shortcuts-section">
            <h4>General</h4>
            <div class="shortcut-item">
              <kbd>?</kbd>
              <span>Show Keyboard Shortcuts</span>
            </div>
            <div class="shortcut-item">
              <kbd>Esc</kbd>
              <span>Close Overlay</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Close button handler
    const closeBtn = overlay.querySelector('.shortcuts-close') as HTMLButtonElement;
    closeBtn?.addEventListener('click', () => this.toggleShortcutsOverlay());

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.toggleShortcutsOverlay();
      }
    });

    // ESC to close
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
        this.toggleShortcutsOverlay();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return overlay;
  }

  /**
   * Toggles the keyboard shortcuts overlay.
   */
  private toggleShortcutsOverlay(): void {
    if (!this.shortcutsOverlay) return;
    this.shortcutsOverlay.classList.toggle('hidden');
  }

  /**
   * Updates breadcrumb display (for future extension).
   * No-op: breadcrumbs removed from UI.
   */
  updateBreadcrumb(_items: { label: string; icon?: string }[]): void {
    // Breadcrumbs removed from UI
  }

  /**
   * Toggles sidebar visibility.
   */
  toggleSidebar(): void {
    if (!this.sidebar) return;

    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
    
    // Update ARIA attributes
    this.sidebar.setAttribute('aria-hidden', String(this.sidebarCollapsed));
  }

  /**
   * Toggles inspector visibility.
   */
  toggleInspector(): void {
    if (!this.inspector || !this.inspectorToggle) return;

    this.inspectorCollapsed = !this.inspectorCollapsed;
    this.inspector.classList.toggle('collapsed', this.inspectorCollapsed);
    
    // Update ARIA attributes
    this.inspectorToggle.setAttribute('aria-expanded', String(!this.inspectorCollapsed));
    this.inspector.setAttribute('aria-hidden', String(this.inspectorCollapsed));
    
    // Update toggle button icon direction
    const icon = this.inspectorCollapsed
      ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4L6 8l4 4"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';
    
    this.inspectorToggle.innerHTML = `
      ${icon}
      <span class="panel-toggle-label">Inspector</span>
    `;
  }

  /**
   * Gets the layout container elements.
   */
  getContainers(): {
    toolbar: HTMLElement | null;
    sidebar: HTMLElement | null;
    inspector: HTMLElement | null;
    canvasContainer: HTMLElement | null;
  } {
    return {
      toolbar: this.toolbar,
      sidebar: this.sidebar,
      inspector: this.inspector,
      canvasContainer: this.canvasContainer,
    };
  }

  /**
   * Disposes the layout.
   */
  dispose(): void {
    if (this.keyboardCleanup) {
      this.keyboardCleanup();
      this.keyboardCleanup = null;
    }

    if (this.layoutRoot && this.layoutRoot.parentNode) {
      this.layoutRoot.parentNode.removeChild(this.layoutRoot);
    }

    this.layoutRoot = null;
    this.toolbar = null;
    this.sidebar = null;
    this.inspector = null;
    this.canvasContainer = null;
    this.inspectorToggle = null;
    this.shortcutsOverlay = null;
  }
}
