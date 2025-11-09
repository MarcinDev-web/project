/**
 * EditorPanelManager - Manages editor UI panels with tabbed sidebar.
 * Extracted from EditorUI to reduce complexity and improve maintainability.
 * 
 * Features:
 * - Tabbed sidebar (Layers/Bookmarks/History/Logic/Settings)
 * - Properties panel
 * - Asset palette
 */

import type { Scene, Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { AssetPreset, Asset } from '../types/BlockAssetTypes';
import type { RgbaColor } from '../../utils/colors';
import type { VegetationPresetManager } from '../managers/VegetationPresetManager';
import type { NpcPresetManager } from '../managers/NpcPresetManager';
import { PropertiesPanel } from './PropertiesPanel';
import { LogicPanel } from './LogicPanel';
import { LayersPanel } from './LayersPanel';
import { BookmarksPanel } from './BookmarksPanel';
import { HistoryPanel } from './HistoryPanel';
import { AssetPalette } from '../ui/AssetPalette';
import { DisposableGroup } from '@engine/core/utils';
import { initializeBaseColor } from '../visuals/SelectionVisuals';
import { ResizableSidebar } from '../ui/ResizableSidebar';
import { SidebarTabs } from '../ui/SidebarTabs';
import { TemplateGalleryPanel } from './TemplateGalleryPanel';
import { VegetationPanel } from './VegetationPanel';
import { EconomyPanel } from './EconomyPanel';
import { UIPanel } from './UIPanel';
import { NpcPanel } from './NpcPanel';
import { WeaponPanel } from './WeaponPanel';
import { UICanvasComponent } from '@engine/world/components/UICanvasComponent';
import { UIElementComponent } from '@engine/world/components/UIElementComponent';
import { TerrainPanel } from '../terrain/ui/TerrainPanel';
import type { TerrainBuilderStudio } from '../terrain/TerrainBuilderStudio';
import { RenderSettingsPanel } from './RenderSettingsPanel';
import { SettingsPanel } from './SettingsPanel';
import { QuickActionsPanel } from './QuickActionsPanel';
import { hydrateScene, resolveEntityByPath, type SceneSnapshot } from '@engine/editor-utils';
import { MaterialComponent } from '@engine/world/components/MaterialComponent';

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
  getVegetationPaintController?: () => {
    activate: (preset: AssetPreset) => void;
    updateConfig: (config: { brushRadius?: number; density?: number; minSpacing?: number }) => void;
    isActive: () => boolean;
  } | null;
  getTerrainBuilderStudio?: () => TerrainBuilderStudio | null;
  getRenderer?: () => import('@engine/gfx-webgpu').Renderer | null;
  vegetationPresetManager?: VegetationPresetManager | null;
  npcPresetManager?: NpcPresetManager | null;
}

/**
 * Manages editor panels with tabbed sidebar interface.
 */
export class EditorPanelManager {
  private readonly disposables = new DisposableGroup();

  private sidebarTabs: SidebarTabs | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private inspectorContainer: HTMLElement | null = null;
  private layersPanel: LayersPanel | null = null;
  private bookmarksPanel: BookmarksPanel | null = null;
  private historyPanel: HistoryPanel | null = null;
  private propertiesPanel: PropertiesPanel | null = null;
  private logicPanel: LogicPanel | null = null;
  private templateGallery: TemplateGalleryPanel | null = null;
  private vegetationPanel: VegetationPanel | null = null;
  private npcPanel: NpcPanel | null = null;
  private weaponPanel: WeaponPanel | null = null;
  private uiPanel: UIPanel | null = null;
  private terrainPanel: TerrainPanel | null = null;
  private renderSettingsPanel: RenderSettingsPanel | null = null;
  private settingsPanel: SettingsPanel | null = null;
  private quickActionsPanel: QuickActionsPanel | null = null;
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
    if (this.layersPanel) {
      console.error('EditorPanelManager: Already mounted');
      return;
    }

    // Validate containers
    if (!(sidebarContainer instanceof HTMLElement) || !(inspectorContainer instanceof HTMLElement)) {
      throw new Error('EditorPanelManager: Invalid container elements provided');
    }

    // Initialize Tabbed Sidebar
    this.sidebarTabs = new SidebarTabs();

    // Initialize Layers Panel
    this.layersPanel = new LayersPanel({
      scene: this.config.scene,
      onLayerChanged: () => {
        // Layer changed
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
      history: this.config.state.history,
      onUndo: () => {
        this.handleUndo();
      },
      onRedo: () => {
        this.handleRedo();
      },
      onJumpTo: (index) => {
        this.handleJumpTo(index);
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

    // Create templates panel
    this.templateGallery = new TemplateGalleryPanel({
      scene: this.config.scene,
      updateSceneBuffers: this.config.updateSceneBuffers,
    });

    // Create render settings panel
    const renderSettingsContainer = document.createElement('div');
    renderSettingsContainer.className = 'render-settings-container';
    this.renderSettingsPanel = new RenderSettingsPanel({
      state: this.config.state,
      onSettingsChanged: (settings) => {
        // Update renderer settings dynamically
        const renderer = this.config.getRenderer?.();
        if (renderer && typeof (renderer as any).updateRenderSettings === 'function') {
          (renderer as any).updateRenderSettings({
            enableHDR: settings.enableHDR,
            enableBloom: settings.enableBloom,
            enableFXAA: settings.enableFXAA,
            enableSSAO: settings.enableSSAO,
            enableShadows: settings.enableShadows,
            enableForwardPlus: settings.enableForwardPlus,
            enableScreenLOD: settings.enableScreenLOD,
            shadowQuality: settings.shadowQuality,
          });
        }
      },
    });
    this.renderSettingsPanel.mount(renderSettingsContainer);

    // Initialize Vegetation Panel
    this.vegetationPanel = new VegetationPanel({
      assetPreset: null,
      onConfigChanged: (config) => {
        // Configuration changed - could update active preset
        console.log('[VegetationPanel] Config changed:', config);
      },
      onCreatePreset: (config) => {
        // Create new vegetation preset
        if (this.config.vegetationPresetManager && config) {
          // Prompt for preset name
          const name = prompt('Enter preset name:');
          if (name && name.trim()) {
            try {
              const preset = this.config.vegetationPresetManager.createPreset(name.trim(), config);
              // Refresh asset palette to show new preset
              this.refreshAssetBrowser();
              console.log('[VegetationPanel] Created preset:', preset.name);
            } catch (error) {
              console.error('[VegetationPanel] Failed to create preset:', error);
            }
          }
        } else {
          console.warn('[VegetationPanel] VegetationPresetManager not available');
        }
      },
      onActivatePaint: (preset) => {
        const paintController = this.config.getVegetationPaintController?.();
        if (paintController) {
          paintController.activate(preset);
        } else {
          console.warn('[VegetationPanel] Paint controller not available');
        }
      },
      onUpdatePaintConfig: (config) => {
        const paintController = this.config.getVegetationPaintController?.();
        if (paintController) {
          paintController.updateConfig(config);
        }
      },
    });

    // Initialize NPC Panel
    const defaultNpcPreset: AssetPreset = {
      name: 'NPC',
      scale: [1, 1, 1],
      color: [0.5, 0.5, 0.5, 1],
      npcConfig: {
        unitType: 'soldier',
        faction: 'neutral',
        behavior: 'idle',
      },
    };
    this.npcPanel = new NpcPanel({
      assetPreset: defaultNpcPreset,
      onConfigChanged: (config) => {
        // Update the preset with new config
        if (defaultNpcPreset.npcConfig) {
          defaultNpcPreset.npcConfig = config;
        }
      },
      onCreatePreset: (config) => {
        // Create new NPC preset
        if (this.config.npcPresetManager && config) {
          // Prompt for preset name
          const name = prompt('Enter preset name:');
          if (name && name.trim()) {
            try {
              const preset = this.config.npcPresetManager.createPreset(name.trim(), config);
              // Refresh asset palette to show new preset
              this.refreshAssetBrowser();
              console.log('[NpcPanel] Created preset:', preset.name);
            } catch (error) {
              console.error('[NpcPanel] Failed to create preset:', error);
            }
          }
        } else {
          console.warn('[NpcPanel] NpcPresetManager not available');
        }
      },
      onStartPlacement: (preset) => {
        // Start placement with NPC preset
        this.config.onStartPlacement(preset);
      },
    });

    // Initialize Economy Panel
    const economyPanel = new EconomyPanel();

    // Initialize Weapon Panel
    this.weaponPanel = new WeaponPanel({
      selection: this.config.selection,
      scene: this.config.scene,
      onConfigChanged: () => {
        this.config.updateSceneBuffers();
        this.refreshProperties();
      },
      updateSceneBuffers: this.config.updateSceneBuffers,
    });

    // Initialize UI Panel
    this.uiPanel = new UIPanel({
      scene: this.config.scene,
      onElementSelect: (entity) => {
        this.config.selection.select(entity);
        this.refreshProperties();
      },
      onElementAdd: (type) => {
        // Create UI element entity with component
        const canvases = this.config.scene.queryEntities(UICanvasComponent);
        let canvasEntity;
        if (canvases.length === 0) {
          canvasEntity = this.config.scene.createEntity('UI Canvas');
          canvasEntity.addComponent(new UICanvasComponent());
        } else {
          canvasEntity = canvases[0]!;
        }

        const elementEntity = this.config.scene.createEntity(`UI ${type}`);
        canvasEntity.addChild(elementEntity);

        const component = new UIElementComponent(undefined, type);
        switch (type) {
          case 'button':
            component.buttonText = 'Button';
            component.size = { width: 120, height: 40 };
            break;
          case 'text':
            component.textContent = 'Text';
            component.fontSize = 16;
            component.color = '#ffffff';
            component.size = { width: 200, height: 30 };
            break;
          case 'image':
            component.size = { width: 100, height: 100 };
            break;
          case 'slider':
            component.minValue = 0;
            component.maxValue = 100;
            component.value = 50;
            component.step = 1;
            component.size = { width: 200, height: 20 };
            break;
          case 'progress':
            component.value = 0.5;
            component.size = { width: 200, height: 30 };
            break;
          case 'input':
            component.inputType = 'text';
            component.placeholder = 'Enter text...';
            component.size = { width: 200, height: 30 };
            break;
        }

        elementEntity.addComponent(component);
        this.config.selection.select(elementEntity);
        this.refreshProperties();
        this.config.updateSceneBuffers();
      },
    });

    // Initialize Terrain Panel
    const terrainStudio = this.config.getTerrainBuilderStudio?.();
    if (terrainStudio) {
      this.terrainPanel = new TerrainPanel({
        terrainStudio,
        onTerrainCreated: (entity) => {
          this.config.updateSceneBuffers();
          // Optionally select the new terrain entity
          this.config.selection.select(entity);
          this.refreshProperties();
        },
        onTerrainSelected: (entity) => {
          if (entity) {
            this.config.selection.select(entity);
            this.refreshProperties();
          }
        },
      });
    }

    // Initialize Quick Actions Panel
    this.quickActionsPanel = new QuickActionsPanel({
      selection: this.config.selection,
      onTransformChanged: this.config.onTransformChanged,
      onColorChanged: this.config.onColorChanged,
      getSnapConfig: () => this.getSnapConfig(),
      roundToIncrement: (value, increment) => this.roundToIncrement(value, increment),
      entityHasTexture: (entity, materialComp) => this.entityHasTexture(entity, materialComp),
      setManagedTimeout: (fn, ms) => window.setTimeout(fn, ms),
      registerUndo: (action) => {
        this.config.state.history.pushSnapshot();
        this.config.state.history.registerUndo(action);
      },
      announce: (message) => {
        // Could integrate with status message system
        console.log('[QuickActions]', message);
      },
      state: this.config.state,
    });

    // Add tabs to sidebar (Quick Actions first)
    this.sidebarTabs.addTab({
      id: 'quick-actions',
      label: 'Quick Actions',
      icon: 'sparkle',
      content: this.quickActionsPanel.element,
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
      id: 'templates',
      label: 'Templates',
      icon: 'gallery-horizontal',
      content: this.templateGallery.element,
    });

    this.sidebarTabs.addTab({
      id: 'vegetation',
      label: 'Vegetation',
      icon: 'leaf',
      content: this.vegetationPanel.element,
    });

    this.sidebarTabs.addTab({
      id: 'npcs',
      label: 'NPCs',
      icon: 'user',
      content: this.npcPanel.element,
    });

    this.sidebarTabs.addTab({
      id: 'weapons',
      label: 'Weapons',
      icon: 'target',
      content: this.weaponPanel.element,
    });

    this.sidebarTabs.addTab({
      id: 'ui',
      label: 'UI',
      icon: 'layout',
      content: this.uiPanel.element,
    });

    this.sidebarTabs.addTab({
      id: 'economy',
      label: 'Economy',
      icon: 'banknote',
      content: economyPanel.element,
    });

    if (this.terrainPanel) {
      this.sidebarTabs.addTab({
        id: 'terrain',
        label: 'Terrain',
        icon: 'grid',
        content: this.terrainPanel.element,
      });
    }

    // Initialize Settings Panel
    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'settings-container';
    this.settingsPanel = new SettingsPanel({
      state: this.config.state,
      onSettingsChanged: (settings) => {
        // Settings changed - could emit event or update UI visibility
        console.log('[SettingsPanel] Settings changed:', settings);
        // Update UI visibility based on preferences
        if (this.config.state.uiPreferences.value.showHotbar !== settings.uiPreferences.showHotbar) {
          // Hotbar visibility is managed by AssetPalette
        }
        if (this.config.state.uiPreferences.value.showInspector !== settings.uiPreferences.showInspector) {
          // Inspector visibility is managed by EditorPanelManager
          this.setVisibility({ inspector: settings.uiPreferences.showInspector });
        }
      },
    });
    this.settingsPanel.mount(settingsContainer);

    this.sidebarTabs.addTab({
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      content: settingsContainer,
    });

    // Add render settings tab
    this.sidebarTabs.addTab({
      id: 'render-settings',
      label: 'Render',
      icon: 'image',
      content: renderSettingsContainer,
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
      ...(this.config.getRenderer && { getRenderer: this.config.getRenderer }),
    };
    this.propertiesPanel = new PropertiesPanel(propertiesPanelConfig);
    this.propertiesPanel.mount(inspectorContainer);

    // Initialize Asset Palette (game-like hotbar at bottom of screen)
    this.assetPalette = new AssetPalette({
      scene: this.config.scene,
      state: this.config.state,
      onAssetSelect: (asset: Asset) => {
        // Handle asset selection
        this.handleAssetSelection(asset);
      },
      onStartPlacement: (asset: Asset) => {
        // Convert asset to preset format for placement
        const preset = this.assetToPreset(asset);
        this.config.onStartPlacement(preset);
      },
      onStartPlacementPreset: (preset: AssetPreset) => {
        // Handle preset placement (vegetation or NPC)
        this.config.onStartPlacement(preset);
      },
      vegetationPresetManager: this.config.vegetationPresetManager ?? null,
      npcPresetManager: this.config.npcPresetManager ?? null,
    });
    this.assetPalette.mount();
    this.disposables.add(() => this.assetPalette?.dispose());

    // Create asset browser wrapper for backward compatibility with tests
    this.assetBrowserWrapper = {
      refresh: () => this.assetPalette?.refresh(),
    };

    // Setup periodic badge updates and history panel sync
    const badgeInterval = window.setInterval(() => {
      this.sidebarTabs?.updateAllBadges();
      // Sync history panel to reflect any changes (e.g., new snapshots added)
      this.historyPanel?.sync();
    }, 1000);
    this.disposables.add(() => clearInterval(badgeInterval));
  }



  /**
   * Refreshes the properties panel (updates displayed entity properties).
   */
  refreshProperties(): void {
    this.propertiesPanel?.refresh();
    this.quickActionsPanel?.refresh();
    this.logicPanel?.refresh();
    this.weaponPanel?.refresh();
  }

  /**
   * Refreshes the history panel (syncs with current history state).
   */
  refreshHistory(): void {
    this.historyPanel?.sync();
  }

  /**
   * Refreshes all panels.
   */
  refreshAll(): void {
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
   * Handles undo operation from history panel.
   */
  private handleUndo(): void {
    if (!this.config.state.history.canUndo()) {
      return;
    }
    const snapshot = this.config.state.history.undo();
    if (snapshot) {
      this.applySnapshot(snapshot);
      this.historyPanel?.sync();
    }
  }

  /**
   * Handles redo operation from history panel.
   */
  private handleRedo(): void {
    if (!this.config.state.history.canRedo()) {
      return;
    }
    const snapshot = this.config.state.history.redo();
    if (snapshot) {
      this.applySnapshot(snapshot);
      this.historyPanel?.sync();
    }
  }

  /**
   * Handles jump to specific history index.
   */
  private handleJumpTo(index: number): void {
    const snapshot = this.config.state.history.jumpTo(index);
    if (snapshot) {
      this.applySnapshot(snapshot);
      this.historyPanel?.sync();
    }
  }

  /**
   * Applies a scene snapshot (used for undo/redo/jump to).
   */
  private applySnapshot(snapshot: SceneSnapshot): void {
    this.config.state.disableHistory();
    try {
      hydrateScene(this.config.scene, snapshot.sceneJSON);
      this.config.updateSceneBuffers();
      const resolved = resolveEntityByPath(this.config.scene, snapshot.selectedPath ?? null);
      if (resolved) {
        this.config.selection.select(resolved);
      } else {
        this.config.selection.clearSelection();
      }
      this.refreshProperties();
      this.config.onSelectionVisualsNeeded?.();
    } finally {
      this.config.state.enableHistory();
    }
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
  private assetToPreset(asset: Asset): AssetPreset {
    // Default scale for blocks is 1x1x1
    const finalScale: [number, number, number] = [1, 1, 1];
    
    return {
      name: asset.name,
      scale: finalScale,
      color: asset.color,
      ...(asset.blockData?.id && { blockId: asset.blockData.id }),
    };
  }

  /**
   * Handles asset selection from AssetPalette
   */
  private handleAssetSelection(asset: Asset): void {
    // Default scale for blocks is 1x1x1
    const finalScale: [number, number, number] = [1, 1, 1];
    const preset = this.assetToPreset(asset);

    // All blocks are placeable in the simplified system
    if (this.config.onStartPlacement) {
      this.config.onStartPlacement(preset);
    } else {
      // Direct spawn without placement mode
      const entity = this.config.scene.createEntity(`${asset.name} ${this.config.scene.entityCount + 1}`);
      entity.userData.asset = asset.name;
      
      // Place at world origin for predictable behavior
      const position: [number, number, number] = [0, finalScale[1] / 2, 0];
      entity.transform.position = position;
      entity.transform.scale = [...finalScale];
      initializeBaseColor(entity, asset.color);
      
      this.config.selection.select(entity);
      this.config.onAssetSpawn(entity, preset);
    }
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
   * Gets the vegetation panel instance.
   */
  getVegetationPanel(): VegetationPanel | null {
    return this.vegetationPanel;
  }

  /**
   * Gets the terrain panel instance.
   */
  getTerrainPanel(): TerrainPanel | null {
    return this.terrainPanel;
  }

  /**
   * Gets snap configuration from state.
   */
  private getSnapConfig(): {
    enabled: boolean;
    increment: number;
    axes: { x: boolean; y: boolean; z: boolean };
    rotationIncrement: number;
    scaleIncrement: number;
    minScale: number;
  } | null {
    const cfg = this.config.state.snapConfig.value;
    if (!cfg || !cfg.enabled) return null;
    return cfg;
  }

  /**
   * Rounds a value to the nearest increment.
   */
  private roundToIncrement(value: number, increment: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) return value;
    return Math.round(value / increment) * increment;
  }

  /**
   * Checks if entity has a texture (and thus color picker should be hidden).
   */
  private entityHasTexture(entity: Entity, materialComp: MaterialComponent | null): boolean {
    if (!materialComp) {
      // No material component = custom entity with solid color
      return false;
    }

    const matId = materialComp.materialId;
    
    // Plastic blocks (10-13) are solid color and can be tinted
    if (matId >= 10 && matId <= 13) {
      return false;
    }

    // materialId 0 = default/custom entity without specific texture
    // Allow color change unless it has blockId/asset indicating it uses texture atlas
    if (matId === 0) {
      const hasBlockId = entity.userData.blockId || entity.userData.asset;
      return !!hasBlockId;
    }

    // All other materialIds use texture atlas
    return true;
  }

  /**
   * Checks if panels are mounted.
   */
  isMounted(): boolean {
    return this.layersPanel !== null;
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

    this.vegetationPanel?.dispose();
    this.vegetationPanel = null;

    this.uiPanel?.dispose();
    this.uiPanel = null;

    this.quickActionsPanel?.dispose();
    this.quickActionsPanel = null;

    this.terrainPanel?.dispose();
    this.terrainPanel = null;

    this.renderSettingsPanel?.dispose();
    this.renderSettingsPanel = null;

    this.settingsPanel?.dispose();
    this.settingsPanel = null;

    // Clear references to panels without dispose methods
    // (Their DOM elements will be removed when parent is cleared)
    this.layersPanel = null;
    this.bookmarksPanel = null;
    this.historyPanel = null;

    // Clear container references
    this.sidebarContainer = null;
    this.inspectorContainer = null;
    this.assetBrowserWrapper = null;
  }
}
