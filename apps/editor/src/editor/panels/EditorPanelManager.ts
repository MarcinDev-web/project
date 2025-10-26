/**
 * EditorPanelManager - Manages editor UI panels with tabbed sidebar.
 * Extracted from EditorUI to reduce complexity and improve maintainability.
 * 
 * Features:
 * - Tabbed sidebar (Scene/Layers/Settings)
 * - Outliner with enhanced hierarchy
 * - Properties panel
 * - Asset browser
 */

import type { Scene, Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { AssetPreset, AssetMainCategory, AssetCategory } from '../assets/AssetTypes';
import type { Asset, AssetVariant } from '../assets/AssetTypes';
import type { RgbaColor } from '../../utils/colors';
import { OutlinerPanel } from './OutlinerPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { LogicPanel } from './LogicPanel';
import { LayersPanel } from './LayersPanel';
import { BookmarksPanel } from './BookmarksPanel';
import { HistoryPanel } from './HistoryPanel';
import { AssetPalette } from '../ui/AssetPalette';
import { DisposableGroup } from '../core/DisposableGroup';
import { initializeBaseColor } from '../visuals/SelectionVisuals';
import { ResizableSidebar } from '../ui/ResizableSidebar';
import { SidebarTabs } from '../ui/SidebarTabs';

export interface PanelVisibility {
  sidebar?: boolean;
  inspector?: boolean;
  hotbar?: boolean;
  assetCatalog?: boolean;
  logicPanel?: boolean;
  codeEditor?: boolean;
}

export interface EditorPanelManagerConfig {
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  updateSceneBuffers: () => void;
  onTransformChanged: (entity: Entity) => void;
  onColorChanged: (entity: Entity, color: RgbaColor) => void;
  onEntityRenamed: (entity: Entity) => void;
  onAssetSpawn: (entity: Entity, preset: AssetPreset) => void;
  onStartPlacement: (preset: AssetPreset) => void;
  onOpenScriptWorkbench?: () => void;
  onSelectionVisualsNeeded?: () => void;
  getRendererDeviceAndFormat?: () => {
    device: GPUDevice;
    presentationFormat: GPUTextureFormat;
  } | null;
}

/**
 * Manages editor panels with tabbed sidebar interface.
 */
export class EditorPanelManager {
  private readonly disposables = new DisposableGroup();

  private sidebarTabs: SidebarTabs | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private inspectorContainer: HTMLElement | null = null;
  private outlinerPanel: OutlinerPanel | null = null;
  private layersPanel: LayersPanel | null = null;
  private bookmarksPanel: BookmarksPanel | null = null;
  private historyPanel: HistoryPanel | null = null;
  private propertiesPanel: PropertiesPanel | null = null;
  private logicPanel: LogicPanel | null = null;
  private assetPalette: AssetPalette | null = null;
  private assetBrowserWrapper: { refresh: () => void } | null = null;
  private resizableSidebar: ResizableSidebar | null = null;

  constructor(private readonly config: EditorPanelManagerConfig) {}

  /**
   * Initializes all panels and mounts them to the provided containers.
   * @param sidebarContainer - Container for tabbed sidebar (left)
   * @param inspectorContainer - Container for properties and asset browser (right)
   */
  mount(sidebarContainer: HTMLElement, inspectorContainer: HTMLElement): void {
    if (this.outlinerPanel) {
      console.error('EditorPanelManager: Already mounted');
      return;
    }

    // Validate containers
    if (!(sidebarContainer instanceof HTMLElement) || !(inspectorContainer instanceof HTMLElement)) {
      throw new Error('EditorPanelManager: Invalid container elements provided');
    }

    // Initialize Tabbed Sidebar
    this.sidebarTabs = new SidebarTabs();

    // Initialize Outliner Panel
    this.outlinerPanel = new OutlinerPanel({
      scene: this.config.scene,
      selection: this.config.selection,
      state: this.config.state,
      onEntitySelected: (entity) => {
        this.config.selection.select(entity);
        this.refreshProperties();
        // Apply selection visuals immediately
        this.config.onSelectionVisualsNeeded?.();
      },
    });

    // Get outliner element via typed getter
    const outlinerElement = this.outlinerPanel.element ?? document.createElement('div');

    // Initialize Layers Panel
    this.layersPanel = new LayersPanel({
      scene: this.config.scene,
      onLayerChanged: () => {
        this.refreshOutliner();
      },
    });

    // Initialize Bookmarks Panel
    this.bookmarksPanel = new BookmarksPanel({
      selection: this.config.selection,
      onNavigate: (entityId) => {
        // Find and select the entity
        const targetEntity = this.findEntityById(entityId);
        if (targetEntity) {
          this.config.selection.select(targetEntity);
          this.refreshProperties();
          this.config.onSelectionVisualsNeeded?.();
        }
      },
    });

    // Initialize History Panel
    this.historyPanel = new HistoryPanel({
      onUndo: () => {
        console.log('Undo requested');
        // TODO: Integrate with command history system
      },
      onRedo: () => {
        console.log('Redo requested');
        // TODO: Integrate with command history system
      },
      onJumpTo: (index) => {
        console.log('Jump to history index:', index);
        // TODO: Integrate with command history system
      },
    });

    // Create logic panel
    this.logicPanel = new LogicPanel({
      selection: this.config.selection,
      onConfigChanged: () => {
        this.config.updateSceneBuffers();
        this.refreshProperties();
      },
    });

    // Create settings panel (placeholder for now)
    const settingsPanel = this.createSettingsPanel();

    // Add tabs to sidebar
    this.sidebarTabs.addTab({
      id: 'scene',
      label: 'Scene',
      icon: 'cube',
      content: outlinerElement,
      badge: () => this.config.scene.entityCount ?? 0,
    });

    this.sidebarTabs.addTab({
      id: 'layers',
      label: 'Layers',
      icon: 'layers',
      content: this.layersPanel.element,
    });

    this.sidebarTabs.addTab({
      id: 'bookmarks',
      label: 'Bookmarks',
      icon: 'star',
      content: this.bookmarksPanel.element,
    });

    this.sidebarTabs.addTab({
      id: 'history',
      label: 'History',
      icon: 'rotate-ccw',
      content: this.historyPanel.element,
    });

    this.sidebarTabs.addTab({
      id: 'logic',
      label: 'Logic',
      icon: 'sparkle',
      content: this.logicPanel.element,
    });

    this.sidebarTabs.addTab({
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      content: settingsPanel,
    });

    // Remember containers for visibility control
    this.sidebarContainer = sidebarContainer;
    this.inspectorContainer = inspectorContainer;

    // Mount tabbed sidebar
    this.sidebarTabs.mount(sidebarContainer);

    // Make sidebar resizable
    this.resizableSidebar = new ResizableSidebar({
      element: sidebarContainer,
      minWidth: 250,
      maxWidth: 600,
      defaultWidth: 320,
      snapPoints: [280, 320, 400, 500],
      storageKey: 'editor-sidebar-width',
      onResize: (width) => {
        console.log('Sidebar resized to:', width);
      },
    });

    // Initialize Properties Panel (goes in inspector)
    const propertiesPanelConfig = {
      selection: this.config.selection,
      state: this.config.state,
      onTransformChanged: this.config.onTransformChanged,
      onColorChanged: this.config.onColorChanged,
      onEntityRenamed: this.config.onEntityRenamed,
      ...(this.config.onOpenScriptWorkbench && { onOpenScriptWorkbench: this.config.onOpenScriptWorkbench }),
    };
    this.propertiesPanel = new PropertiesPanel(propertiesPanelConfig);
    this.propertiesPanel.mount(inspectorContainer);

    // Initialize Asset Palette (game-like hotbar at bottom of screen)
    this.assetPalette = new AssetPalette({
      scene: this.config.scene,
      state: this.config.state,
      onAssetSelect: (asset: Asset, variant?: AssetVariant) => {
        // Handle asset selection with variant support
        this.handleAssetSelection(asset, variant);
      },
      onStartPlacement: (asset: Asset, variant?: AssetVariant) => {
        // Convert asset to preset format for placement
        const preset = this.assetToPreset(asset, variant);
        this.config.onStartPlacement(preset);
      },
    });
    this.assetPalette.mount();
    this.disposables.add(() => this.assetPalette?.dispose());

    // Create asset browser wrapper for backward compatibility with tests
    this.assetBrowserWrapper = {
      refresh: () => this.assetPalette?.refresh(),
    };

    // Setup periodic badge updates
    const badgeInterval = window.setInterval(() => {
      this.sidebarTabs?.updateAllBadges();
    }, 1000);
    this.disposables.add(() => clearInterval(badgeInterval));
  }


  /**
   * Creates a placeholder settings panel.
   */
  private createSettingsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'panel-placeholder';
    panel.innerHTML = `
      <div class="inspector-empty">
        <div class="inspector-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2m-12.4 0l4.2-4.2m4.2-4.2l4.2-4.2"/>
          </svg>
        </div>
        <span>Editor Settings</span>
        <span class="text-xs text-3">Coming soon - configure editor preferences</span>
      </div>
    `;
    return panel;
  }

  /**
   * Refreshes the outliner panel (rebuilds scene hierarchy UI).
   */
  refreshOutliner(): void {
    this.outlinerPanel?.refresh();
  }

  /**
   * Refreshes the properties panel (updates displayed entity properties).
   */
  refreshProperties(): void {
    this.propertiesPanel?.refresh();
    this.logicPanel?.refresh();
  }

  /**
   * Refreshes all panels.
   */
  refreshAll(): void {
    this.refreshOutliner();
    this.refreshProperties();
    this.refreshAssetBrowser();
  }

  /**
   * Compatibility: tests expect an Asset Browser getter.
   * Now returns Asset Palette wrapper instead.
   */
  getAssetBrowser(): { refresh: () => void } | null {
    return this.assetBrowserWrapper;
  }

  /**
   * Compatibility: tests expect refreshAssetBrowser to exist.
   * Now refreshes Asset Palette through wrapper.
   */
  refreshAssetBrowser(): void {
    try {
      this.assetBrowserWrapper?.refresh();
    } catch (error) {
      console.warn('EditorPanelManager: Failed to refresh asset browser:', error);
    }
  }

  setVisibility(visibility: PanelVisibility): void {
    if (visibility.sidebar !== undefined && this.sidebarContainer) {
      this.sidebarContainer.style.display = visibility.sidebar ? 'flex' : 'none';
    }

    if (visibility.inspector !== undefined && this.inspectorContainer) {
      this.inspectorContainer.style.display = visibility.inspector ? 'flex' : 'none';
    }

    // Dispatch event with visibility details
    window.dispatchEvent(
      new CustomEvent('editor:panel-visibility-changed', {
        detail: this.getVisibility(),
      })
    );
  }

  getVisibility(): PanelVisibility {
    return {
      sidebar: this.sidebarContainer?.style.display === 'flex',
      inspector: this.inspectorContainer?.style.display === 'flex',
      hotbar: true, // Asset palette is always visible when mounted
      assetCatalog: true,
      logicPanel: false, // Not separately controlled
      codeEditor: false, // Not separately controlled
    };
  }

  /**
   * Finds an entity by ID in the scene, with early termination.
   */
  private findEntityById(entityId: string): Entity | null {
    let targetEntity: Entity | null = null;
    this.config.scene.traverse((entity) => {
      if (entity.id === entityId) {
        targetEntity = entity;
        return false; // Stop traversal early if supported
      }
    });
    return targetEntity;
  }

  /**
   * Converts Asset to AssetPreset format for backward compatibility.
   */
  private assetToPreset(asset: Asset, variant?: AssetVariant): AssetPreset {
    const finalColor = variant?.color || asset.color;
    const finalScale = variant?.scale || asset.scale;
    
    return {
      name: asset.metadata.name,
      description: asset.metadata.description,
      scale: finalScale,
      color: finalColor,
      category: this.convertMainCategoryToCategory(asset.category),
      ...(asset.blockData?.id && { blockId: asset.blockData.id }),
    };
  }

  /**
   * Converts AssetMainCategory to AssetCategory format.
   */
  private convertMainCategoryToCategory(mainCategory: AssetMainCategory): AssetCategory {
    // Map new categories to asset category format (legacy)
    // AssetCategory = 'Blocks' | 'Primitives' | 'Architecture' | 'Furniture' | 'Nature' | 'Decoration' | 'Gameplay'
    const categoryMap: Partial<Record<AssetMainCategory, AssetCategory>> = {
      'Building': 'Blocks',
      'Architecture': 'Architecture',
      'Furniture': 'Furniture',
      'Decoration': 'Decoration',
      'Nature': 'Nature',
      'Lighting': 'Decoration',
      'Gameplay': 'Gameplay',
      'Vehicles': 'Primitives',
      'Characters': 'Primitives',
      'Electronics': 'Furniture',
      'Plumbing': 'Furniture',
      'Landscaping': 'Nature',
      'Effects': 'Decoration',
      'Materials': 'Primitives',
      'Custom': 'Primitives',
    };
    return categoryMap[mainCategory] || 'Blocks';
  }

  /**
   * Handles asset selection from AssetPalette with variant support
   */
  private handleAssetSelection(asset: Asset, variant?: AssetVariant): void {
    const finalColor = variant?.color || asset.color;
    const finalScale = variant?.scale || asset.scale;
    const preset = this.assetToPreset(asset, variant);

    // Check if we should start placement mode
    if (this.config.onStartPlacement && asset.isPlaceable) {
      this.config.onStartPlacement(preset);
    } else {
      // Direct spawn without placement mode
      const entity = this.config.scene.createEntity(`${asset.metadata.name} ${this.config.scene.entityCount + 1}`);
      entity.userData.asset = asset.metadata.name;
      
      // Place at world origin for predictable behavior
      const position: [number, number, number] = [0, finalScale[1] / 2, 0];
      entity.transform.position = position;
      entity.transform.scale = [...finalScale];
      initializeBaseColor(entity, [...finalColor]);
      
      this.config.selection.select(entity);
      this.config.onAssetSpawn(entity, preset);
    }
  }

  /**
   * Gets the outliner panel instance.
   */
  getOutliner(): OutlinerPanel | null {
    return this.outlinerPanel;
  }

  /**
   * Gets the properties panel instance.
   */
  getProperties(): PropertiesPanel | null {
    return this.propertiesPanel;
  }

  /**
   * Gets the asset palette instance.
   */
  getAssetPalette(): AssetPalette | null {
    return this.assetPalette;
  }

  /**
   * Checks if panels are mounted.
   */
  isMounted(): boolean {
    return this.outlinerPanel !== null;
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    // Dispose all managed resources
    this.disposables.dispose();

    // Dispose sidebar tabs
    this.sidebarTabs?.dispose();
    this.sidebarTabs = null;

    // Dispose panels that have dispose methods
    this.propertiesPanel?.dispose();
    this.propertiesPanel = null;

    this.logicPanel?.dispose();
    this.logicPanel = null;

    this.resizableSidebar?.dispose();
    this.resizableSidebar = null;

    this.assetPalette?.dispose();
    this.assetPalette = null;

    // Clear references to panels without dispose methods
    // (Their DOM elements will be removed when parent is cleared)
    this.outlinerPanel = null;
    this.layersPanel = null;
    this.bookmarksPanel = null;
    this.historyPanel = null;

    // Clear container references
    this.sidebarContainer = null;
    this.inspectorContainer = null;
    this.assetBrowserWrapper = null;
  }
}
