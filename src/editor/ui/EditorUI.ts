/**
 * EditorUI - Main editor UI controller (REFACTORED).
 * Orchestrates editor managers and handles high-level editor lifecycle.
 *
 * Responsibilities reduced to:
 * - Initialization orchestration
 * - History management (undo/redo)
 * - Scene persistence
 * - Mode switching (edit/play)
 * - Event coordination between managers
 *
 * Extracted components:
 * - EditorPanelManager - UI panels (outliner, properties, assets)
 * - EditorToolbar - Modern Toolbar UI with menus, search, breadcrumbs
 * - EditorVisualManager - Gizmo, grid, selection visuals
 * - DisposableGroup - Resource cleanup
 */

import type { OrbitControls } from '../../input';
import type { Renderer } from '../../rendering/index';
import { Entity, Scene } from '../../engine/scene';
import type { SelectionManager } from '../../scene/Selection';
import { MaterialComponent } from '../../scene/components/MaterialComponent';
import type { Vec3 } from '@engine/core/math';
import type { AssetPreset } from '../assets/AssetTypes';
import { initializeBaseColor } from '../visuals/SelectionVisuals';
import { persistCamera, restoreCamera, persistLastPlacementPreset, restoreLastPlacementPreset, persistUIPreferences, restoreUIPreferences, persistWorkflowPreset, restoreWorkflowPreset } from '../core/EditorPersistence';
import { storageLoad, storageSave } from '../../utils/storage';
import type { RgbaColor } from '../../utils/colors';
import { effect } from '@preact/signals-core';
import { EditorState } from '../core/state';
import {
  computeEntityPath,
  hydrateScene,
  resolveEntityByPath,
  serializeScene,
} from '../history/HistoryHelpers';
import { snapshotsEqual, type SceneSnapshot } from '../history/HistoryManager';
import { SnapSystem } from '../snap/SnapSystem';
import { CollisionDetector } from '../placement/CollisionDetector';
import { PlacementMode } from '../placement/PlacementMode';
import { ProjectManager } from '../managers/ProjectManager';
import { EditorModeManager } from '../managers/EditorModeManager';
import { EditorClipboardManager } from '../managers/EditorClipboardManager';
import { EditorSearchManager } from '../managers/EditorSearchManager';
import { EditorPlacementController } from '../controllers/EditorPlacementController';
import { BlockDragController } from '../controllers/BlockDragController';
import { EasyPlaceController } from '../controllers/EasyPlaceController';
import { LightManager } from '../../rendering/lighting/LightManager';
import { KeyboardHandler } from '../controllers/KeyboardHandler';
import { DisposableGroup } from '../core/DisposableGroup';
import { EditorPanelManager } from '../panels/EditorPanelManager';
import { EditorVisualManager } from '../visuals/EditorVisualManager';
import { EditorUILayout } from './EditorUILayout';
import { QuickMenu } from './QuickMenu';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { WelcomeOverlay } from './WelcomeOverlay';
import { BuildStats } from './BuildStats';
import { FloatingHints } from './FloatingHints';
import { ScriptWorkbench } from './ScriptWorkbench';
import { AssetsDropdown } from './AssetsDropdown';
import { BlockEditorUI } from './BlockEditorUI';
import { AudioManager } from '../../audio/AudioManager';
import { EnvironmentComponent } from '../../scene/components/EnvironmentComponent';
import { AdaptiveUIManager } from './AdaptiveUIManager';
import { FeatureIntroduction } from './FeatureIntroduction';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import type { CharacterControllerSystem } from '../../scene/CharacterControllerSystem';
import { CharacterInputHandler } from '../../input/CharacterInput';
import { FPSCamera } from '../camera/FPSCamera';
import { PauseMenu } from './PauseMenu';

export interface EditorUIConfig {
  canvas: HTMLCanvasElement;
  statusEl: HTMLElement;
  controls: OrbitControls;
  scene: Scene;
  selection: SelectionManager;
  updateSceneBuffers: () => void;
  projectWorldToScreen: (world: Vec3) => { x: number; y: number } | null;
  getRenderer: () => Renderer | null;
  physicsWorld?: PhysicsWorld | null;
  characterSystem?: CharacterControllerSystem | null;
}

export class EditorUI {
  private readonly disposables = new DisposableGroup();

  private layout: EditorUILayout | null = null;
  private panelHover = false;
  private lastSnapshot?: SceneSnapshot;
  private statusTimeout: number | null = null;

  // Managers
  private panelManager: EditorPanelManager | null = null;
  private visualManager: EditorVisualManager | null = null;
  private quickMenu: QuickMenu | null = null;
  private assetsDropdown: AssetsDropdown | null = null;
  private blockEditor: BlockEditorUI | null = null;
  private unifiedBuildPanel: import('./UnifiedBuildPanel').UnifiedBuildPanel | null = null;
  private welcomeOverlay: WelcomeOverlay | null = null;
  private buildStats: BuildStats | null = null;
  private floatingHints: FloatingHints | null = null;
  private scriptWorkbench: ScriptWorkbench | null = null;
  private audio: AudioManager | null = null;
  private adaptiveUI: AdaptiveUIManager | null = null;
  private featureIntro: FeatureIntroduction | null = null;
  private pauseMenu: PauseMenu | null = null;
  private pauseMenuOpen = false;

  // Core systems
  private state: EditorState | null = null;
  private snapSystem: SnapSystem | null = null;
  private collisionDetector: CollisionDetector | null = null;
  private placementMode: PlacementMode | null = null;
  private projectManager: ProjectManager | null = null;
  private keyboard: KeyboardHandler | null = null;

  // New managers
  private modeManager: EditorModeManager | null = null;
  private clipboardManager: EditorClipboardManager | null = null;
  private searchManager: EditorSearchManager | null = null;
  private placementController: EditorPlacementController | null = null;
  private dragController: BlockDragController | null = null;
  private easyPlaceController: EasyPlaceController | null = null;
  private characterInput: CharacterInputHandler | null = null;
  private fpsCamera: FPSCamera | null = null;

  constructor(private readonly config: EditorUIConfig) {}

  public async initialize(): Promise<void> {
    // 1. Initialize core state and systems
    this.initializeCoreState();

    // 2. Initialize UI
    this.initializeUI();

    // IMPORTANT: Some tests call initialize() without awaiting the Promise.
    // Ensure hotkeys and a seed scene are available before any awaited work.
    // 3a. Initialize keyboard handler early (safe even if some managers are not ready yet)
    this.initializeKeyboardHandler();

    // 3b. Seed demo scene synchronously so entities like 'Center' exist immediately
    this.seedDemoScene();

    // 4. Initialize managers (may contain awaited work)
    await this.initializeManagers();

    // 5. Setup reactivity
    this.setupReactivity();

    // 6. Restore persisted state
    this.restorePersistedState();

    // 8. Setup placement tracking
    const placementCleanup = this.placementController?.initialize();
    if (placementCleanup) {
      this.disposables.add(placementCleanup);
    }

    // 9. Setup block dragging
    const dragCleanup = this.dragController?.initialize();
    if (dragCleanup) {
      this.disposables.add(dragCleanup);
    }

    // 10. Setup Easy Place
    const easyPlaceCleanup = this.easyPlaceController?.initialize();
    if (easyPlaceCleanup) {
      this.disposables.add(easyPlaceCleanup);
    }

    // Hook renderer GPU timings if supported
    const renderer = this.config.getRenderer();
    if (renderer && this.state?.capabilities.value?.features.timestampQuery) {
      try {
        renderer.onGpuTimings((timings) => this.buildStats?.updateGpuTimings(timings));
      } catch (err) {
        console.warn('Failed to hook GPU timings', err);
      }
    }
  }

  /**
   * Opens the Custom Block Editor modal. On save, registers the block and refreshes asset UIs.
   */
  private openBlockEditor(): void {
    if (!this.blockEditor) {
      this.blockEditor = new BlockEditorUI();
    }
    this.blockEditor.show(undefined, async (block) => {
      try {
        // Lazy import to avoid circular deps in some test environments
        const mod = await import('../assets/AssetRegistry');
        mod.assetRegistry.registerBlockAsset(block, { origin: 'custom' });
      } catch {}
      // Refresh palette/browser where present
      try { this.panelManager?.getAssetPalette()?.refresh(); } catch {}
      try { this.assetsDropdown?.refresh(); } catch {}
      this.setStatusMessage(`Saved custom block: ${block.name}` as string, 1200);
    });
  }

  /**
   * Initializes core state and systems.
   */
  private initializeCoreState(): void {
    this.state = new EditorState(this.config.scene);
    this.snapSystem = new SnapSystem(this.state.snapConfig.value);
    this.collisionDetector = new CollisionDetector(this.config.scene);
    this.placementMode = new PlacementMode(
      this.config.scene,
      this.snapSystem,
      this.collisionDetector
    );

    const physicsWorld = this.config.physicsWorld ?? null;
    const characterSystem = this.config.characterSystem ?? null;

    if (!this.characterInput) {
      this.characterInput = new CharacterInputHandler();
      this.disposables.add(() => this.characterInput?.destroy());
    }
    if (!this.fpsCamera) {
      this.fpsCamera = new FPSCamera(this.config.canvas);
      this.disposables.add(() => this.fpsCamera?.dispose());
    }

    this.modeManager = new EditorModeManager({
      scene: this.config.scene,
      selection: this.config.selection,
      state: this.state,
      updateSceneBuffers: this.config.updateSceneBuffers,
          onModeChanged: (mode) => {
            const isPlay = mode === 'play';
            this.setStatusMessage(isPlay ? 'Play Mode' : 'Edit Mode', 800);
            this.layout?.setPlayMode(isPlay);
            this.quickMenu?.setPlayMode(isPlay);
            this.panelManager?.refreshOutliner();
            this.panelManager?.refreshProperties();
            this.visualManager?.applySelectionVisuals();
          },
      canvas: this.config.canvas,
      controls: this.config.controls,
      physicsWorld,
      characterSystem,
      characterInput: this.characterInput,
      fpsCamera: this.fpsCamera,
      getRendererReady: () => this.config.getRenderer() !== null,
    });

    this.clipboardManager = new EditorClipboardManager({
      scene: this.config.scene,
      selection: this.config.selection,
      state: this.state,
      updateSceneBuffers: this.config.updateSceneBuffers,
      recordSnapshot: (d) => this.recordSnapshot(d),
      onStatusMessage: (msg, dur) => this.setStatusMessage(msg, dur),
    });

    this.searchManager = new EditorSearchManager({
      scene: this.config.scene,
      selection: this.config.selection,
      onSearchResults: () => {
        // Refresh outliner to show search results
        this.panelManager?.refreshOutliner();
      },
      onStatusMessage: (msg, dur) => this.setStatusMessage(msg, dur),
    });

    this.placementController = new EditorPlacementController({
      canvas: this.config.canvas,
      controls: this.config.controls,
      scene: this.config.scene,
      selection: this.config.selection,
      state: this.state,
      placementMode: this.placementMode,
      updateSceneBuffers: this.config.updateSceneBuffers,
      recordSnapshot: (d) => this.recordSnapshot(d),
      onStatusMessage: (msg, dur) => this.setStatusMessage(msg, dur),
    });

    this.dragController = new BlockDragController({
      canvas: this.config.canvas,
      controls: this.config.controls,
      scene: this.config.scene,
      selection: this.config.selection,
      state: this.state,
      placementMode: this.placementMode,
      collisionDetector: this.collisionDetector,
      updateSceneBuffers: this.config.updateSceneBuffers,
      recordSnapshot: (d) => this.recordSnapshot(d),
      onStatusMessage: (msg, dur) => this.setStatusMessage(msg, dur),
    });

    this.easyPlaceController = new EasyPlaceController({
      canvas: this.config.canvas,
      controls: this.config.controls,
      scene: this.config.scene,
      selection: this.config.selection,
      state: this.state,
      placementMode: this.placementMode,
      collisionDetector: this.collisionDetector,
      updateSceneBuffers: this.config.updateSceneBuffers,
      recordSnapshot: (d) => this.recordSnapshot(d),
      onStatusMessage: (msg, dur) => this.setStatusMessage(msg, dur),
    });

    // Sync SnapSystem when snap config changes
    effect(() => {
      if (this.snapSystem && this.state) {
        this.snapSystem.setConfig(this.state.snapConfig.value);
      }
    });

    // Bind selection manager to scene
    this.config.selection.setScene(this.config.scene);
  }

  /**
   * Initializes the modern UI layout.
   */
  private initializeUI(): void {
    // Create new layout system with scene metrics
    this.layout = new EditorUILayout({
      canvas: this.config.canvas,
      statusEl: this.config.statusEl,
      sceneMetricsProvider: () => {
        const renderer = this.config.getRenderer();
        const selectedEntity = this.config.selection.primarySelection;
        
        const metrics: { entityCount: number; selectedEntity: string | null; fps?: number; triangles?: number } = {
          entityCount: this.config.scene.entityCount,
          selectedEntity: selectedEntity ? selectedEntity.name : null,
        };
        
        if (renderer?.fps !== undefined && typeof renderer.fps === 'number') {
          metrics.fps = renderer.fps;
        }
        if (renderer?.triangleCount !== undefined && typeof renderer.triangleCount === 'number') {
          metrics.triangles = renderer.triangleCount;
        }
        
        return metrics;
      },
    });

    // Mount layout and get containers
    const containers = this.layout.mount();

    // Setup hover detection for inspector panel
    containers.inspector?.addEventListener('pointerenter', () => {
      this.panelHover = true;
      this.updateControlEnabledState();
    });
    containers.inspector?.addEventListener('pointerleave', () => {
      this.panelHover = false;
      this.updateControlEnabledState();
    });

    containers.sidebar?.addEventListener('pointerenter', () => {
      this.panelHover = true;
      this.updateControlEnabledState();
    });
    containers.sidebar?.addEventListener('pointerleave', () => {
      this.panelHover = false;
      this.updateControlEnabledState();
    });

    // Cleanup on dispose
    this.disposables.add(() => this.layout?.dispose());
  }

  /**
   * Initializes all managers.
   */
  private async initializeManagers(): Promise<void> {
    if (!this.state || !this.layout) {
      throw new Error('EditorUI: State and layout must be initialized before managers');
    }

    const containers = this.layout.getContainers();

    if (!containers.toolbar || !containers.sidebar || !containers.inspector) {
      throw new Error('EditorUI: Layout containers not available');
    }

    // Initialize ProjectManager
    this.projectManager = new ProjectManager({
      scene: this.config.scene,
      state: this.state,
      updateSceneBuffers: this.config.updateSceneBuffers,
      refreshOutliner: () => this.panelManager?.refreshOutliner(),
      showStatusMessage: (message, duration) => this.setStatusMessage(message, duration),
      onSaveStatusChange: (status) => this.quickMenu?.setSaveStatus(status),
    });
    this.projectManager.initialize();
    this.disposables.add(() => this.projectManager?.dispose());

    // Initialize ModeManager state machine
    if (this.modeManager) {
      const modeManagerCleanup = this.modeManager.initialize();
      this.disposables.add(modeManagerCleanup);
    }

    // Top bar via QuickMenu (Cursor-like, single row, always visible)
    this.quickMenu = new QuickMenu({
      state: this.state,
      projectManager: this.projectManager,
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      canUndo: () => this.state?.history.canUndo() ?? false,
      canRedo: () => this.state?.history.canRedo() ?? false,
      onSearch: (query) => this.handleSearch(query),
      toggleSnap: () => {
        if (!this.state) return;
        this.state.snapConfig.value = {
          ...this.state.snapConfig.value,
          enabled: !this.state.snapConfig.value.enabled,
        };
      },
      toggleGrid: () => {
        if (!this.state) return;
        this.state.showGrid.value = !this.state.showGrid.value;
      },
      showShortcuts: () => {
        try {
          new KeyboardShortcutsModal().show();
        } catch {}
      },
      onOpenAssets: () => this.assetsDropdown?.toggle(),
      onOpenScriptWorkbench: () => this.openScriptWorkbench(),
      onOpenBlockEditor: () => this.openBlockEditor(),
      onGizmoModeChange: (mode) => {
        if (!this.state) return;
        this.state.gizmoMode.value = mode;
        this.visualManager?.updateGizmoOverlay();
      },
      onRotationSnapChange: (mode) => {
        if (!this.state) return;
        this.state.rotationSnapMode.value = mode;
        this.setStatusMessage(`Rotation snap: ${mode}`, 1000);
      },
    });
    this.quickMenu.mount();
    this.quickMenu.setPlayMode(this.state.editorMode.value === 'play');
    this.disposables.add(() => this.quickMenu?.dispose());

    this.pauseMenu = new PauseMenu({
      onResume: () => this.resumePlayMode(),
      onExitToEdit: () => this.stopPlayMode(),
    });
    this.disposables.add(() => this.pauseMenu?.hide());
    if (this.state) {
      this.state.editorUI = {
        setPauseMenuVisible: (visible) => this.setPauseMenuVisible(visible),
      };
      this.disposables.add(() => {
        if (this.state) {
          this.state.editorUI = undefined;
        }
      });
    }

    // Initialize PanelManager
    this.panelManager = new EditorPanelManager({
      scene: this.config.scene,
      selection: this.config.selection,
      state: this.state,
      updateSceneBuffers: this.config.updateSceneBuffers,
      onTransformChanged: (_entity) => {
        this.config.updateSceneBuffers();
        this.state!.transformRev.value = this.state!.transformRev.value + 1;
        this.recordSnapshot('Transform change');
        requestAnimationFrame(() => this.visualManager?.updateGizmoOverlay());
      },
      onColorChanged: (entity, color) => {
        try {
          entity.color = color;
        } catch {
          // ignore
        }
        this.state!.colorRev.value = this.state!.colorRev.value + 1;
        this.recordSnapshot('Color change');
      },
      onEntityRenamed: () => {
        this.state!.renameRev.value = this.state!.renameRev.value + 1;
        this.recordSnapshot('Rename entity');
      },
      onAssetSpawn: (_entity, _preset) => {
        this.config.updateSceneBuffers();
        this.panelManager?.refreshOutliner();
        this.recordSnapshot('Add asset');
      },
      onStartPlacement: (preset: AssetPreset) => {
        if (this.state?.editorMode.value === 'play') {
          this.config.statusEl.textContent = 'Cannot place in play mode';
          setTimeout(() => {
            this.config.statusEl.textContent = '';
          }, 1500);
          return;
        }
        if (this.placementMode && this.state) {
          // Persist last chosen preset for placement memory
          try {
            const last = {
              name: preset.name,
              scale: [...preset.scale] as [number, number, number],
              color: [...preset.color] as [number, number, number, number],
              ...(preset.blockId ? { blockId: preset.blockId } : {}),
            };
            this.state.lastPlacementPreset.value = last;
            persistLastPlacementPreset(this.state);
          } catch {}

          this.placementMode.startPlacement(preset);
          this.state.placementMode.value = true;
          this.config.statusEl.textContent = `Placing ${preset.name} (Q/E rotate, Double-click or Enter confirm, Esc cancel)`;
          try {
            this.floatingHints?.dismissAll();
            this.floatingHints?.showPlacementHint(preset.name);
          } catch {}
        }
      },
      onSelectionVisualsNeeded: () => {
        // Apply selection visuals when entity is selected from outliner
        this.visualManager?.applySelectionVisuals();
      },
      onOpenScriptWorkbench: () => {
        this.openScriptWorkbench();
      },
      getRendererDeviceAndFormat: () => {
        const renderer = this.config.getRenderer();
        if (!renderer) return null;
        try {
          return {
            device: renderer.getDevice(),
            presentationFormat: renderer.getPresentationFormat(),
          };
        } catch {
          return null;
        }
      },
    });
    this.panelManager.mount(containers.sidebar, containers.inspector);
    this.disposables.add(() => this.panelManager?.dispose());

    // Initialize VisualManager
    this.visualManager = new EditorVisualManager({
      scene: this.config.scene,
      selection: this.config.selection,
      state: this.state,
      canvas: this.config.canvas,
      snapSystem: this.snapSystem,
      getRenderer: this.config.getRenderer,
      projectWorldToScreen: this.config.projectWorldToScreen,
      updateSceneBuffers: this.config.updateSceneBuffers,
      setControlsEnabled: (enabled) => this.config.controls.setEnabled(enabled),
    });
    void this.visualManager.initialize();
    this.disposables.add(() => this.visualManager?.dispose());

    // (Old floating QuickMenu removed; replaced with top bar above)

    // Initialize WelcomeOverlay (first-time tutorial)
    this.welcomeOverlay = new WelcomeOverlay();
    this.welcomeOverlay.mount();

    // Initialize BuildStats (performance overlay) - only if renderer available
    try {
      const renderer = this.config.getRenderer();
      if (renderer) {
        this.buildStats = new BuildStats({
          scene: this.config.scene,
          renderer,
        });
        this.buildStats.mount();
        this.disposables.add(() => this.buildStats?.dispose());
      }
    } catch {
      // In test environments renderer may be unavailable
    }

    // Initialize FloatingHints (contextual action feedback)
    this.floatingHints = new FloatingHints();
    this.floatingHints.mount();
    this.disposables.add(() => this.floatingHints?.dispose());

    // Initialize ScriptWorkbench (modal for editing entity scripts)
    this.scriptWorkbench = new ScriptWorkbench({
      onClose: () => {
        // Optional: Refresh properties panel when workbench closes
        this.panelManager?.refreshProperties();
      },
      onScriptsApplied: (_entity, _state) => {
        // Refresh UI and record history when scripts are applied
        this.config.updateSceneBuffers();
        this.panelManager?.refreshProperties();
        this.recordSnapshot('Script changes');
      },
      onRebuildRequested: (_entity, _component) => {
        // Optional: Show status message when rebuild is triggered
        this.setStatusMessage('Script instances rebuilt', 1000);
      },
    });
    this.disposables.add(() => this.scriptWorkbench?.dispose());

    // Initialize Assets Dropdown (dropdown panel for Asset Browser)
    this.assetsDropdown = new AssetsDropdown({
      scene: this.config.scene,
      state: this.state,
      onAssetSelect: (asset, variant) => {
        // Handle asset selection from dropdown
        const finalColor = variant?.color || asset.color;
        const finalScale = variant?.scale || asset.scale;
        
        // Convert Asset to AssetPreset for placement
        const preset: AssetPreset = {
          name: asset.metadata.name,
          description: asset.metadata.description,
          category: asset.category as AssetPreset['category'],
          scale: finalScale,
          color: finalColor,
          ...(asset.blockData?.id && { blockId: asset.blockData.id }),
        };
        
        // Start placement mode
        if (this.placementMode && this.state) {
          this.placementMode.startPlacement(preset);
          this.state.placementMode.value = true;
          this.config.statusEl.textContent = `Placing ${preset.name} (Q/E rotate, Double-click or Enter confirm, Esc cancel)`;
          try {
            this.floatingHints?.dismissAll();
            this.floatingHints?.showPlacementHint(preset.name);
          } catch {}
        }
      },
    });
    this.assetsDropdown.mount();
    this.disposables.add(() => this.assetsDropdown?.dispose());

    // Initialize Unified Build Panel (combines hotbar + catalog for Build Mode)
    const { UnifiedBuildPanel } = await import('./UnifiedBuildPanel');
    this.unifiedBuildPanel = new UnifiedBuildPanel({
      scene: this.config.scene,
      state: this.state,
      placementMode: this.placementMode!,
      // inventoryManager is optional, not provided here
      onAssetSelect: (asset, _variant, source) => {
        // Track selection source
        this.setStatusMessage(`Selected ${asset.metadata.name} from ${source}`, 1000);
      },
      onPlacementStart: (asset, variant) => {
        const finalColor = variant?.color || asset.color;
        const finalScale = variant?.scale || asset.scale;
        
        // Convert Asset to AssetPreset for placement
        const preset: AssetPreset = {
          name: asset.metadata.name,
          description: asset.metadata.description || '',
          category: asset.category as AssetPreset['category'],
          scale: finalScale,
          color: finalColor,
          ...(asset.blockData?.id && { blockId: asset.blockData.id }),
        };

        // Persist last placement
        try {
          const last = {
            name: preset.name,
            scale: [...preset.scale] as [number, number, number],
            color: [...preset.color] as [number, number, number, number],
            ...(preset.blockId ? { blockId: preset.blockId } : {}),
          };
          this.state!.lastPlacementPreset.value = last;
          persistLastPlacementPreset(this.state!);
        } catch {}

        this.state!.placementMode.value = true;
        this.floatingHints?.dismissAll();
        this.floatingHints?.showPlacementHint(preset.name);
      },
      onPlacementEnd: (confirmed) => {
        if (confirmed) {
          this.config.updateSceneBuffers();
          this.panelManager?.refreshOutliner();
          this.recordSnapshot('Place asset');
          this.setStatusMessage('Asset placed', 1000);
        }
        this.state!.placementMode.value = false;
      },
      onStatusUpdate: (message) => {
        this.config.statusEl.textContent = message;
      },
    });
    this.unifiedBuildPanel.mount();
    this.disposables.add(() => this.unifiedBuildPanel?.dispose());

    this.audio = new AudioManager({ scene: this.config.scene, orbitControls: this.config.controls });
    this.disposables.add(() => this.audio?.dispose());
    
    // Initialize Adaptive UI Manager
    this.adaptiveUI = new AdaptiveUIManager();
    this.disposables.add(() => this.adaptiveUI?.dispose());
    
    // Initialize Feature Introduction
    this.featureIntro = new FeatureIntroduction();
    this.disposables.add(() => this.featureIntro?.dispose());
  }

  /**
   * Sets up reactive effects.
   */
  private setupReactivity(): void {
    if (!this.state) return;

    // React to selection changes
    effect(() => {
      const selectedId = this.state!.selectedEntity.value?.id ?? 'none';
      void selectedId;
      this.panelManager?.refreshOutliner();
      this.panelManager?.refreshProperties();
      this.visualManager?.applySelectionVisuals();
      
      // Adaptive UI: analyze context when selection changes
      const selected = this.state!.selectedEntity.value;
      if (this.adaptiveUI && this.state) {
        this.adaptiveUI.adaptToContext(selected, this.state);
      }
    });

    // React to transform/color/rename ticks
    effect(() => {
      void this.state!.transformRev.value;
      this.panelManager?.refreshProperties();
    });
    effect(() => {
      void this.state!.colorRev.value;
      this.panelManager?.refreshProperties();
      this.config.updateSceneBuffers();
    });
    effect(() => {
      void this.state!.renameRev.value;
      this.panelManager?.refreshOutliner();
      this.panelManager?.refreshProperties();
    });

    // Subscribe to selection manager changes
    const unsubscribe = this.config.selection.onSelectionChanged(() => {
      const selected = this.config.selection.primarySelection;
      if (this.state) {
        this.state.selection.value = selected ? [selected] : [];
      }
      this.persistSelection();
      this.panelManager?.refreshOutliner();
      this.panelManager?.refreshProperties();
      this.visualManager?.applySelectionVisuals();
    });
    this.disposables.add(unsubscribe);

    // Persist camera on changes
    const cameraInterval = window.setInterval(() => {
      persistCamera(this.config.controls);
    }, 100);
    this.disposables.add(() => clearInterval(cameraInterval));

    // React to Editor ↔ Play mode switching
    const modeEffect = effect(() => {
      const mode = this.state!.editorMode.value;
      if (mode === 'play' && this.modeManager) {
        this.modeManager.enterPlayMode();
      } else if (mode === 'edit' && this.modeManager) {
        this.modeManager.exitPlayMode();
      }
    });
    this.disposables.add(() => modeEffect());
    
    // React to UI preferences changes
    const uiPrefsEffect = effect(() => {
      const prefs = this.state!.uiPreferences.value;
      const preset = this.state!.workflowPreset.value;

      this.panelManager?.setVisibility({
        sidebar: true,
        inspector: prefs.showInspector,
      });

      // Show/hide unified build panel based on workflow and preferences
      // Unified build panel is shown when in 'build' mode with both hotbar and catalog enabled
      const shouldShowUnifiedBuild = preset === 'build' && prefs.showHotbar && prefs.showAssetCatalog;
      this.unifiedBuildPanel?.setVisibility(shouldShowUnifiedBuild);

      if (this.state) {
        persistUIPreferences(this.state);
      }
    });
    this.disposables.add(() => uiPrefsEffect());
    
    // React to workflow preset changes
    const workflowEffect = effect(() => {
      const preset = this.state!.workflowPreset.value;
      void preset; // Mark as used
      
      // Persist workflow preset
      if (this.state) {
        persistWorkflowPreset(this.state);
      }
    });
    this.disposables.add(() => workflowEffect());
  }

  /**
   * Initializes keyboard handler.
   */
  private initializeKeyboardHandler(): void {
    if (!this.state) return;

    this.keyboard = new KeyboardHandler({
      state: this.state,
      scene: this.config.scene,
      selection: this.config.selection,
      controls: this.config.controls,
      statusEl: this.config.statusEl,
      snapSystem: this.snapSystem,
      placementMode: this.placementMode,
      dragController: this.dragController,
      projectManager: this.projectManager,
      updateSceneBuffers: this.config.updateSceneBuffers,
      updateGizmoOverlay: () => this.visualManager?.updateGizmoOverlay(),
      getClipboard: () => this.clipboardManager?.getClipboard() ?? null,
      recordSnapshot: (d) => this.recordSnapshot(d),
      showLoadDialog: () => this.projectManager?.showLoadDialog() ?? Promise.resolve(),
      openBlockEditor: () => this.openBlockEditor(),
      exitPlayMode: () => this.modeManager?.exitPlayMode(),
    });
    this.keyboard.initialize();
    this.disposables.add(() => this.keyboard?.dispose());

    // Listen for undo/redo custom events from keyboard handler
    const onUndo = () => this.undo();
    const onRedo = () => this.redo();
    window.addEventListener('editor:undo', onUndo);
    window.addEventListener('editor:redo', onRedo);
    this.disposables.add(() => {
      window.removeEventListener('editor:undo', onUndo);
      window.removeEventListener('editor:redo', onRedo);
    });

    // Listen for gizmo change events
    const onGizmoChanged = () => this.recordSnapshot('Gizmo transform');
    window.addEventListener('editor:gizmo:changed', onGizmoChanged);
    this.disposables.add(() => {
      window.removeEventListener('editor:gizmo:changed', onGizmoChanged);
    });

    // Register Script Workbench shortcut (Ctrl+Shift+W)
    this.keyboard.registerCommand('ctrl+shift+w', {
      shortcut: 'ctrl+shift+w',
      preventDefault: true,
      canExecute: () => true,
      execute: () => this.openScriptWorkbench(),
    });
  }

  /**
   * Restores persisted camera and scene state.
   */
  private restorePersistedState(): void {
    restoreCamera(this.config.controls);
    this.restoreSelectionAndScene();
    if (this.state) {
      restoreLastPlacementPreset(this.state);
      restoreUIPreferences(this.state);
      restoreWorkflowPreset(this.state);
    }
  }


  /**
   * Seeds demo scene if empty.
   */
  private seedDemoScene(): void {
    if (this.config.scene.entityCount > 0) return;

    // Create default Environment entity for skybox/atmosphere editing
    try {
      const envEntity = new Entity('Environment');
      envEntity.addComponent(new EnvironmentComponent());
      // Ensure environment has a non-white base color so selection highlight is visible in tests
      try {
        initializeBaseColor(envEntity, [0.6, 0.7, 0.9, 1]);
      } catch {}
      this.config.scene.addEntity(envEntity);
    } catch {
      // Ignore if component not available in certain test environments
    }

    const gridSize = 5;
    const spacing = 1.5;

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const entity = new Entity(`Cube_${x}_${z}`);
        entity.transform.position = [(x - gridSize / 2) * spacing, 0, (z - gridSize / 2) * spacing];
        const color: RgbaColor = [0.3 + (x / gridSize) * 0.5, 0.35 + (z / gridSize) * 0.5, 0.55, 1];
        initializeBaseColor(entity, color);
        // Assign varied material IDs across the grid so textures are not all identical
        try {
          const mat = entity.getComponent(MaterialComponent) ?? entity.addComponent(new MaterialComponent());
          mat.materialId = ((x + z * gridSize) % (MaterialComponent.MAX_MATERIAL_ID + 1));
        } catch {
          // ignore
        }
        this.config.scene.addEntity(entity);
      }
    }

    const centerpiece = new Entity('Center');
    centerpiece.transform.position = [0, 1, 0];
    centerpiece.transform.scale = [1, 2, 1];
    initializeBaseColor(centerpiece, [1, 0.7, 0.2, 1]);
    this.config.scene.addEntity(centerpiece);

    // Add default lighting after initial entities so first root entity is non-white for selection tests
    LightManager.createDefaultLights(this.config.scene);

    this.recordSnapshot('Seed scene', { force: true });

    // Ensure UI reflects new entities immediately
    this.panelManager?.refreshOutliner();
    this.panelManager?.refreshProperties();
  }

  /**
   * Updates control enabled state based on UI hover.
   */
  private updateControlEnabledState(): void {
    const shouldEnable = !this.panelHover;
    this.config.controls.setEnabled(shouldEnable);
  }

  /**
   * Persists current selection.
   */
  private persistSelection(): void {
    const selected = this.config.selection.primarySelection;
    storageSave('selectedId', selected ? selected.id : null);
  }

  /**
   * Restores selection and scene from storage.
   */
  private restoreSelectionAndScene(): void {
    const snapshot = storageLoad<PersistedScene>('scene');
    if (snapshot && Array.isArray(snapshot.entities)) {
      const byName = new Map<string, PersistedEntity>();
      snapshot.entities.forEach((entity) => byName.set(entity.name, entity));

      this.config.scene.traverse((entity) => {
        const persisted = byName.get(entity.name);
        if (!persisted) return;
        entity.transform.position = [...persisted.position];
        entity.transform.scale = [...persisted.scale];
        if (persisted.baseColor) {
          initializeBaseColor(entity, [...persisted.baseColor]);
        }
      });

      this.config.updateSceneBuffers();
      requestAnimationFrame(() => this.visualManager?.updateGizmoOverlay());

      const storedSelectedId = storageLoad<string | null>('selectedId');
      if (storedSelectedId) {
        try {
          const match = this.config.scene.findEntityById(storedSelectedId);
          if (match) {
            this.config.selection.select(match);
            return;
          }
        } catch {
          // Ignore lookup errors and continue fallback selection logic
        }
      }

      if (snapshot.selectedId) {
        const entry = snapshot.entities.find((entity) => entity.id === snapshot.selectedId);
        if (entry) {
          const candidates = this.config.scene.findEntitiesByName(entry.name);
          if (candidates.length > 0) {
            this.config.selection.select(candidates[0]!);
          }
        }
      }
    }
  }

  /**
   * Records a history snapshot.
   */
  private recordSnapshot(description: string, options?: { force?: boolean }): void {
    if (!this.state) return;

    const snapshot: SceneSnapshot = {
      sceneJSON: serializeScene(this.config.scene),
      selectedPath: computeEntityPath(this.config.scene, this.config.selection.primarySelection),
      description,
      timestamp: performance.now(),
    };

    if (!options?.force && snapshotsEqual(this.lastSnapshot ?? null, snapshot)) {
      return;
    }

    this.state.recordHistory(snapshot);
    this.lastSnapshot = snapshot;
    this.quickMenu?.updateHistoryButtons();
    this.persistSceneSnapshot();
    this.projectManager?.markUnsaved();
  }

  /**
   * Persists scene snapshot to storage.
   */
  private persistSceneSnapshot(): void {
    const entities: PersistedEntity[] = [];
    this.config.scene.traverse((entity) => {
      const baseColor = (entity.userData.baseColor as RgbaColor | undefined) ?? undefined;
      const persisted: PersistedEntity = {
        id: entity.id,
        name: entity.name,
        position: entity.transform.position,
        scale: entity.transform.scale,
      };
      if (baseColor) {
        persisted.baseColor = [...baseColor] as RgbaColor;
      }
      if (typeof entity.userData.asset === 'string') {
        persisted.asset = entity.userData.asset;
      }
      entities.push(persisted);
    });
    const selectedId = this.config.selection.primarySelection?.id ?? null;
    storageSave('scene', { entities, selectedId });
  }

  /**
   * Applies a history snapshot.
   */
  private applySnapshot(snapshot: SceneSnapshot): void {
    if (!this.state) return;

    this.state.disableHistory();
    try {
      hydrateScene(this.config.scene, snapshot.sceneJSON);
      this.config.updateSceneBuffers();
      const resolved = resolveEntityByPath(this.config.scene, snapshot.selectedPath ?? null);
      if (resolved) {
        this.config.selection.select(resolved);
      } else {
        this.config.selection.clearSelection();
      }
      this.panelManager?.refreshOutliner();
      this.panelManager?.refreshProperties();
      this.visualManager?.applySelectionVisuals();
      this.lastSnapshot = snapshot;
    } finally {
      this.state.enableHistory();
    }
    this.quickMenu?.updateHistoryButtons();
  }

  /**
   * Sets a status message.
   */
  private setStatusMessage(message: string, duration = 0): void {
    this.config.statusEl.textContent = message;
    if (this.statusTimeout !== null) {
      window.clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
    if (duration > 0) {
      this.statusTimeout = window.setTimeout(() => {
        this.config.statusEl.textContent = '';
        this.statusTimeout = null;
      }, duration);
    }
  }

  /**
   * Undo last action.
   */
  public undo(): void {
    if (!this.state) return;
    const snapshot = this.state.history.undo();
    if (!snapshot) return;
    this.applySnapshot(snapshot);
    this.quickMenu?.updateHistoryButtons();
  }

  /**
   * Redo last undone action.
   */
  public redo(): void {
    if (!this.state) return;
    const snapshot = this.state.history.redo();
    if (!snapshot) return;
    this.applySnapshot(snapshot);
    this.quickMenu?.updateHistoryButtons();
  }

  /**
   * Opens the Script Workbench for the currently selected entity.
   */
  public openScriptWorkbench(): void {
    if (!this.scriptWorkbench) return;
    const selected = this.config.selection.primarySelection;
    if (!selected) {
      this.setStatusMessage('Select an entity to edit scripts', 2000);
      return;
    }
    this.scriptWorkbench.open(selected);
  }

  /**
   * Handles search query from toolbar
   */
  private handleSearch(query: string): void {
    if (!this.searchManager) return;

    if (!query || query.trim().length === 0) {
      this.searchManager.clearSearch();
      this.panelManager?.refreshOutliner();
      return;
    }

    // Search entities by name (most common use case)
    this.searchManager.searchByName(query);
  }

  /**
   * Exposes gizmo overlay update for tests.
   */
  public updateGizmoOverlay(): void {
    this.visualManager?.updateGizmoOverlay();
  }

  /**
   * Disposes editor resources.
   */
  public dispose(): void {
    this.disposables.dispose();

    if (this.placementMode) {
      this.placementMode.cancelPlacement();
    }

    // Dispose new managers
    this.modeManager?.dispose();
    this.clipboardManager?.dispose();
    this.searchManager?.dispose();
    this.placementController?.dispose();

    this.layout = null;
    this.panelManager = null;
    this.visualManager = null;
    this.state = null;
    this.snapSystem = null;
    this.collisionDetector = null;
    this.placementMode = null;
    this.projectManager = null;
    this.keyboard = null;
    this.modeManager = null;
    this.clipboardManager = null;
    this.searchManager = null;
    this.placementController = null;
  }

  /** Returns true when Play Mode is active. */
  public isPlayMode(): boolean {
    return this.modeManager?.isPlayMode() ?? false;
  }

  public getModeManager(): EditorModeManager | null {
    return this.modeManager;
  }

  public getFPSCamera(): FPSCamera | null {
    return this.fpsCamera;
  }

  private resumePlayMode(): void {
    if (!this.modeManager || this.state.editorMode.value !== 'play') return;
    this.pauseMenuOpen = false;
    this.pauseMenu?.hide();
    this.modeManager.resumePlayMode();
  }

  private stopPlayMode(): void {
    if (!this.modeManager) return;
    this.pauseMenuOpen = false;
    this.pauseMenu?.hide();
    this.modeManager.exitPlayMode();
  }

  public showPauseMenu(): void {
    if (!this.pauseMenuOpen) {
      this.pauseMenuOpen = true;
      this.pauseMenu?.show();
    }
  }

  public hidePauseMenu(): void {
    if (this.pauseMenuOpen) {
      this.pauseMenuOpen = false;
      this.pauseMenu?.hide();
    }
  }

  public setPauseMenuVisible(visible: boolean): void {
    if (visible) {
      this.showPauseMenu();
    } else {
      this.hidePauseMenu();
    }
  }
}

// ========== Interfaces ==========

interface PersistedEntity {
  id: string;
  name: string;
  position: Vec3;
  scale: Vec3;
  baseColor?: RgbaColor;
  asset?: string;
}

interface PersistedScene {
  entities: PersistedEntity[];
  selectedId?: string | null;
}
