/**
 * SidebarTabs - Tabbed interface for sidebar panels
 *
 * Features:
 * - Multiple tabs (Scene, Layers, Settings)
 * - Smooth tab switching
 * - Keyboard navigation
 * - Badge support for counts
 */

import { createIcon } from '../../utils/icons';

export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
  content: HTMLElement;
  badge?: () => string | number;
}

export class SidebarTabs {
  private readonly root: HTMLElement;
  private readonly tabsBar: HTMLElement;
  private readonly contentArea: HTMLElement;
  private readonly tabs: Map<string, TabConfig> = new Map();
  private activeTabId: string | null = null;
  private readonly announcer: HTMLElement;
  private readonly scrollPositions: Map<string, number> = new Map();

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'sidebar-tabs';

    // Tabs bar
    this.tabsBar = document.createElement('div');
    this.tabsBar.className = 'sidebar-tabs-bar';
    this.tabsBar.setAttribute('role', 'tablist');
    this.root.appendChild(this.tabsBar);

    // Content area
    this.contentArea = document.createElement('div');
    this.contentArea.className = 'sidebar-tabs-content';
    this.root.appendChild(this.contentArea);

    // Screen reader announcer (visually hidden)
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('role', 'status');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.style.position = 'absolute';
    this.announcer.style.left = '-10000px';
    this.announcer.style.width = '1px';
    this.announcer.style.height = '1px';
    this.announcer.style.overflow = 'hidden';
    this.root.appendChild(this.announcer);
  }

  /**
   * Adds a new tab to the sidebar.
   */
  addTab(config: TabConfig): void {
    this.tabs.set(config.id, config);

    // Create tab button
    const tabButton = document.createElement('button');
    tabButton.type = 'button';
    tabButton.className = 'sidebar-tab';
    tabButton.dataset.tabId = config.id;
    tabButton.setAttribute('role', 'tab');
    tabButton.setAttribute('aria-selected', 'false');
    tabButton.setAttribute('aria-controls', `tab-panel-${config.id}`);
    tabButton.id = `tab-${config.id}`;

    // Icon
    if (config.icon) {
      const icon = createIcon(config.icon as any, 16);
      tabButton.appendChild(icon);
    }

    // Label
    const label = document.createElement('span');
    label.className = 'sidebar-tab-label';
    label.textContent = config.label;
    tabButton.appendChild(label);

    // Badge
    if (config.badge) {
      const badge = document.createElement('span');
      badge.className = 'sidebar-tab-badge';
      badge.textContent = String(config.badge());
      badge.id = `tab-badge-${config.id}`;
      tabButton.appendChild(badge);
    }

    // Click handler
    tabButton.addEventListener('click', () => {
      this.activateTab(config.id);
    });

    this.tabsBar.appendChild(tabButton);

    // Setup content panel
    if (!config.content) {
      throw new Error(`SidebarTabs: content is required for tab ${config.id}`);
    }
    
    // Add sidebar-tab-panel class, preserving any existing classes
    const existingClasses = config.content.className || '';
    config.content.className = existingClasses 
      ? `${existingClasses} sidebar-tab-panel` 
      : 'sidebar-tab-panel';
    config.content.id = `tab-panel-${config.id}`;
    config.content.setAttribute('role', 'tabpanel');
    config.content.setAttribute('aria-labelledby', `tab-${config.id}`);
    config.content.setAttribute('hidden', 'true');
    config.content.style.display = 'none';
    
    // Track scroll position for this panel
    // Try to find a specific scrollable element, or fallback to content itself
    const scrollableElement = (config.content.classList.contains('custom-scrollbar') 
      ? config.content 
      : config.content.querySelector('.custom-scrollbar')) as HTMLElement || config.content;
      
    if (scrollableElement) {
      scrollableElement.addEventListener('scroll', () => {
        this.scrollPositions.set(config.id, scrollableElement.scrollTop);
      });
    }
    
    this.contentArea.appendChild(config.content);

    // Activate first tab by default
    if (this.tabs.size === 1) {
      this.activateTab(config.id);
    }
  }

  /**
   * Activates a specific tab.
   */
  activateTab(tabId: string): void {
    const config = this.tabs.get(tabId);
    if (!config) return;

    // Deactivate current tab
    if (this.activeTabId) {
      const currentButton = this.tabsBar.querySelector(`[data-tab-id="${this.activeTabId}"]`);
      if (currentButton) {
        currentButton.classList.remove('active');
        currentButton.setAttribute('aria-selected', 'false');
      }
      
      const currentPanel = document.getElementById(`tab-panel-${this.activeTabId}`);
      if (currentPanel) {
        // Save scroll position before hiding
        const scrollableElement = currentPanel.querySelector('.custom-scrollbar') as HTMLElement;
        if (scrollableElement) {
          this.scrollPositions.set(this.activeTabId, scrollableElement.scrollTop);
        }
        
        currentPanel.setAttribute('hidden', 'true');
        currentPanel.style.display = 'none';
      }
    }

    // Activate new tab
    const newButton = this.tabsBar.querySelector(`[data-tab-id="${tabId}"]`);
    if (newButton) {
      newButton.classList.add('active');
      newButton.setAttribute('aria-selected', 'true');
    }

    config.content.removeAttribute('hidden');
    config.content.style.display = 'flex';
    this.activeTabId = tabId;

    // Restore scroll position for the activated tab
    requestAnimationFrame(() => {
      const scrollableElement = (config.content.classList.contains('custom-scrollbar') 
        ? config.content 
        : config.content.querySelector('.custom-scrollbar')) as HTMLElement || config.content;
        
      if (scrollableElement) {
        const savedScroll = this.scrollPositions.get(tabId) || 0;
        scrollableElement.scrollTop = savedScroll;
      }
    });

    // Announce tab change to screen readers
    this.announcer.textContent = `${config.label} tab activated`;

    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent('sidebar:tab-changed', { detail: { tabId } })
    );
  }

  /**
   * Updates badge for a specific tab.
   */
  updateBadge(tabId: string): void {
    const config = this.tabs.get(tabId);
    if (!config || !config.badge) return;

    // Check if document is available (for test environment)
    if (typeof document === 'undefined') return;

    const badgeEl = document.getElementById(`tab-badge-${tabId}`);
    if (badgeEl) {
      badgeEl.textContent = String(config.badge());
    }
  }

  /**
   * Updates all badges.
   */
  updateAllBadges(): void {
    this.tabs.forEach((_, tabId) => {
      this.updateBadge(tabId);
    });
  }

  /**
   * Gets the root element.
   */
  get element(): HTMLElement {
    return this.root;
  }

  /**
   * Gets the active tab ID.
   */
  get activeTab(): string | null {
    return this.activeTabId;
  }

  /**
   * Mounts the tabs to a parent element.
   */
  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  /**
   * Disposes the component.
   */
  dispose(): void {
    this.tabs.clear();
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}

