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
 * - EditorPanelManager - UI panels (properties, assets, layers)
 * - EditorToolbar - Modern Toolbar UI with menus, search, breadcrumbs
 * - EditorVisualManager - Gizmo, grid, selection visuals
 * - DisposableGroup - Resource cleanup
 */

import type { OrbitControls } from '@engine/camera';
import type { Renderer } from '@engine/gfx-webgpu/index';
import { Entity, Scene, LightComponent } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { MaterialComponent } from '@engine/world/components/MaterialComponent';
import type { Vec3 } from '@engine/core/math';
import type { AssetPreset } from '../types/BlockAssetTypes';
import { initializeBaseColor } from '../visuals/SelectionVisuals';
import { persistCamera, restoreCamera, persistLastPlacementPreset, restoreLastPlacementPreset, persistUIPreferences, restoreUIPreferences, persistCameraType, restoreCameraType } from '../core/EditorPersistence';
import { storageLoad, storageSave } from '../../utils/storage';
import type { RgbaColor } from '../../utils/colors';
import { effect } from '@preact/signals-core';
import { EditorState } from '../core/state';
import {
  computeEntityPath,
  hydrateScene,
  resolveEntityByPath,
  serializeScene,
} from '@engine/editor-utils';
import { snapshotsEqual, type SceneSnapshot } from '@engine/editor-utils';
import { SnapSystem } from '@engine/editor-utils';
import { CollisionDetector } from '../placement/CollisionDetector';
import { PlacementMode } from '../placement/PlacementMode';
import { ProjectManager } from '../managers/ProjectManager';
import { EditorModeManager } from '../managers/EditorModeManager';
import { EditorClipboardManager } from '../managers/EditorClipboardManager';
import { EditorSearchManager } from '../managers/EditorSearchManager';
import { EditorPlacementController } from '../controllers/EditorPlacementController';
import { VegetationPaintController } from '../controllers/VegetationPaintController';
import { TerrainBuilderStudio } from '../terrain/TerrainBuilderStudio';
import { BlockDragController } from '../controllers/BlockDragController';
import { EasyPlaceController } from '../controllers/EasyPlaceController';
import { LightManager } from '@engine/gfx-webgpu/lighting/LightManager';
import { KeyboardHandler } from '../controllers/KeyboardHandler';
import { DisposableGroup } from '@engine/core/utils';
import { EditorPanelManager } from '../panels/EditorPanelManager';
import { EditorVisualManager } from '../visuals/EditorVisualManager';
import { EditorUILayout } from './EditorUILayout';
import { QuickMenu } from './QuickMenu';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { LoginModal } from './LoginModal';
import { RegisterModal } from './RegisterModal';
import { WelcomeOverlay, type WelcomeOverlayConfig } from './WelcomeOverlay';
import { InteractiveTutorial, createEditorTutorial } from './InteractiveTutorial';
import { QuickStartGuide } from './QuickStartGuide';
import { BuildStats } from './BuildStats';
import { FloatingHints } from './FloatingHints';
import { ScriptWorkbench } from './ScriptWorkbench';
import { UIEditor } from './UIEditor';
import { Audio } from '@engine/stdlib';
import { EnvironmentComponent } from '@engine/world/components/EnvironmentComponent';
import { AdaptiveUIManager } from './AdaptiveUIManager';
import { FeatureIntroduction } from './FeatureIntroduction';
import type { PhysicsWorld } from '@engine/world';
import type { CharacterControllerSystem } from '@engine/stdlib/CharacterController';
import type { BlockBehaviorSystem } from '@engine/world/systems';
import { CharacterInputHandler } from '@engine/input';
import { EditorCameraController, FPSCamera } from '@engine/camera';
import { PauseMenu } from './PauseMenu';
import { TemplatePickerModal } from './TemplatePickerModal';
import { CollaborationManager } from '../managers/CollaborationManager';
import { VegetationPresetManager } from '../managers/VegetationPresetManager';
import { NpcPresetManager } from '../managers/NpcPresetManager';
import { BrandWatermark } from './BrandWatermark';
import { PlayModeInviteDialog } from './PlayModeInviteDialog';
import { showCustomProfileEditor } from './CustomProfileEditor';
import { WeaponHUD } from './WeaponHUD';
import { RuntimePlayerTag } from '@engine/world/components/RuntimePlayerTag';
import { CharacterController } from '@engine/world/components/CharacterController';
import { WeaponComponent } from '@engine/world/components/WeaponComponent';
import { InventoryComponent } from '@engine/world/components/InventoryComponent';
import type { PublicUser } from '@engine/net';
import { frameEditorCameraToScene } from '../utils/cameraFraming';

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
  blockBehaviorSystem?: BlockBehaviorSystem | null;
}

export class EditorUI {
  private readonly disposables = new DisposableGroup();

  private layout: EditorUILayout | null = null;
  private inspectorHover = false;
  private sidebarHover = false;
  private lastSnapshot?: SceneSnapshot;
  private statusTimeout: number | null = null;

  // Managers
  private panelManager: EditorPanelManager | null = null;
  private visualManager: EditorVisualManager | null = null;
  private quickMenu: QuickMenu | null = null;
  private templatePicker: TemplatePickerModal | null = null;
  private loginModal: LoginModal | null = null;
  private registerModal: RegisterModal | null = null;
  private welcomeOverlay: WelcomeOverlay | null = null;
  private interactiveTutorial: InteractiveTutorial | null = null;
  private quickStartGuide: QuickStartGuide | null = null;
  private buildStats: BuildStats | null = null;
  private floatingHints: FloatingHints | null = null;
  private scriptWorkbench: ScriptWorkbench | null = null;
  private uiEditor: UIEditor | null = null;
  private audio: Audio.AudioManager | null = null;
  private adaptiveUI: AdaptiveUIManager | null = null;
  private featureIntro: FeatureIntroduction | null = null;
  private pauseMenu: PauseMenu | null = null;
  private pauseMenuOpen = false;
  private brandWatermark: BrandWatermark | null = null;
  private collaborationManager: CollaborationManager | null = null;
  private collaborationPanelVisible = false;
  private playModeInviteDialog: PlayModeInviteDialog | null = null;
  private weaponHUD: WeaponHUD | null = null;

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
  private vegetationPaintController: VegetationPaintController | null = null;
  private vegetationPresetManager: VegetationPresetManager | null = null;
  private npcPresetManager: NpcPresetManager | null = null;
  private terrainBuilderStudio: TerrainBuilderStudio | null = null;
  private dragController: BlockDragController | null = null;
  private easyPlaceController: EasyPlaceController | null = null;
  private characterInput: CharacterInputHandler | null = null;
  private editorCamera: EditorCameraController | null = null;
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

    // 6b. If no persisted camera state, auto-frame the scene for a better starting view
    try {
      const persistedCam = storageLoad<{ yaw: number; pitch: number; distance: number }>('camera');
      if (!persistedCam && this.editorCamera && this.modeManager) {
        frameEditorCameraToScene({
          scene: this.config.scene,
          canvas: this.config.canvas,
          editorCamera: this.editorCamera,
          controls: this.config.controls,
        });
      }
    } catch {}

    // Ensure scene isn't completely dark when loading persisted scenes without lights
    // If there are no light entities, create a default ambient + directional setup
    try {
      const hasAnyLights = this.config.scene.queryEntities(LightComponent).length > 0;
      if (!hasAnyLights) {
        LightManager.createDefaultLights(this.config.scene);
        // Scene buffers will pick this up automatically next frame, but prompt an update now
        this.config.updateSceneBuffers();
      }
    } catch {
      // ignore – lighting system may be unavailable in certain minimal test environments
    }

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

    // Hook renderer GPU and CPU timings if supported
    const renderer = this.config.getRenderer();
    if (renderer) {
      try {
        if (this.state?.capabilities.value?.features.timestampQuery) {
          renderer.onGpuTimings((timings) => this.buildStats?.updateGpuTimings(timings));
        }
        // CPU timings are always available (performance.now)
        renderer.onCpuTimings((timings) => this.buildStats?.updateCpuTimings(timings));
        // Shadow metrics (if available)
        if (typeof (renderer as any).onShadowMetrics === 'function') {
          (renderer as any).onShadowMetrics((metrics: readonly [number, number, number, number]) => {
            this.buildStats?.updateShadowMetrics(metrics);
          });
        }
      } catch (err) {
        console.warn('Failed to hook renderer timings', err);
      }
    }
  }

  /**
   * Launches the new project flow (template picker is now handled by ProjectManager).
   */
  private async startNewProjectFlow(): Promise<void> {
    if (!this.projectManager) return;
    await this.projectManager.newProject();
    // Auto-frame after creating a new project
    if (this.editorCamera) {
      frameEditorCameraToScene({
        scene: this.config.scene,
        canvas: this.config.canvas,
        editorCamera: this.editorCamera,
        controls: this.config.controls,
      });
    }
  }

  /**
   * Loads a template into the current scene (clears existing scene).
   */
  private async loadTemplate(): Promise<void> {
    if (!this.projectManager) return;

    if (typeof document === 'undefined') {
      return;
    }

    this.templatePicker ??= new TemplatePickerModal();
    const result = await this.templatePicker.pickTemplate({
      title: 'Load Template',
      subtitle: 'This will replace the current scene with the selected template.',
      confirmLabel: 'Load Template',
      includeSeeds: true,
    });

    if (!result) return;

    await this.projectManager.newProjectFromTemplate(result.template);
    // Auto-frame after loading a template as a new project
    if (this.editorCamera) {
      frameEditorCameraToScene({
        scene: this.config.scene,
        canvas: this.config.canvas,
        editorCamera: this.editorCamera,
        controls: this.config.controls,
      });
    }
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
      this.collisionDetector,
      {
        onEntityCreated: (entity) => {
          // Replicate entity creation
          // Note: collaborationManager may not be initialized yet, but will be checked at runtime
          const manager = this.collaborationManager;
          if (manager?.isCollaborating()) {
            manager.replicateEntityCreate(entity);
          }
        },
      }
    );

    const physicsWorld = this.config.physicsWorld ?? null;
    const characterSystem = this.config.characterSystem ?? null;
    const blockBehaviorSystem = this.config.blockBehaviorSystem ?? null;

    if (!this.characterInput) {
      this.characterInput = new CharacterInputHandler();
      this.disposables.add(() => this.characterInput?.destroy());
    }
    if (!this.editorCamera) {
      this.editorCamera = new EditorCameraController(this.config.canvas, {
        moveSpeed: 5.0,
        initialPosition: [0, 3, 8],
        initialYaw: 0,
        initialPitch: -0.35,
      });
      this.disposables.add(() => this.editorCamera?.dispose());
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
            this.panelManager?.refreshProperties();
            this.visualManager?.applySelectionVisuals();
          },
      canvas: this.config.canvas,
      controls: this.config.controls,
      physicsWorld,
      characterSystem,
      blockBehaviorSystem,
      characterInput: this.characterInput,
      fpsCamera: this.fpsCamera,
      editorCamera: this.editorCamera,
      thirdPersonCamera: null, // Not used in editor - only in play mode
      getRendererReady: () => this.config.getRenderer() !== null,
      collaborationManager: this.collaborationManager,
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
        // Search results updated
      },
      onStatusMessage: (msg, dur) => this.setStatusMessage(msg, dur),
    });

    // Initialize VegetationPresetManager
    this.vegetationPresetManager = new VegetationPresetManager();

    // Initialize NpcPresetManager
    this.npcPresetManager = new NpcPresetManager();

    this.placementController = new EditorPlacementController({
      canvas: this.config.canvas,
      controls: this.config.controls,
      cameraDirector: this.modeManager.getCameraDirector(),
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
      cameraDirector: this.modeManager.getCameraDirector(),
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

    // Initialize Vegetation Paint Controller
    this.vegetationPaintController = new VegetationPaintController({
      canvas: this.config.canvas,
      scene: this.config.scene,
      controls: this.config.controls,
      cameraDirector: this.modeManager.getCameraDirector(),
      state: this.state,
      onStatusMessage: (msg, dur) => this.setStatusMessage(msg, dur),
    });
    const paintCleanup = this.vegetationPaintController.initialize();
    this.disposables.add(paintCleanup);

    // Initialize Terrain Builder Studio
    this.terrainBuilderStudio = new TerrainBuilderStudio({
      canvas: this.config.canvas,
      scene: this.config.scene,
      controls: this.config.controls,
      state: this.state,
      onStatusMessage: (msg, dur) => this.setStatusMessage(msg, dur),
      onTerrainChanged: (_entity) => {
        this.config.updateSceneBuffers();
        this.recordSnapshot('Terrain changed');
      },
    });
    this.terrainBuilderStudio.initialize();
    this.disposables.add(() => this.terrainBuilderStudio?.dispose());

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
      this.inspectorHover = true;
      this.updateControlEnabledState();
    });
    containers.inspector?.addEventListener('pointerleave', () => {
      this.inspectorHover = false;
      this.updateControlEnabledState();
    });

    containers.sidebar?.addEventListener('pointerenter', () => {
      this.sidebarHover = true;
      this.updateControlEnabledState();
    });
    containers.sidebar?.addEventListener('pointerleave', () => {
      this.sidebarHover = false;
      this.updateControlEnabledState();
    });

    // Initialize brand watermark (FORGE ENGINE branding)
    this.brandWatermark = new BrandWatermark({
      container: document.body,
      showFPS: true, // Show FPS counter in dev mode
      position: 'top-left',
    });

    // Cleanup on dispose
    this.disposables.add(() => this.layout?.dispose());
    this.disposables.add(() => this.brandWatermark?.dispose());
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
      onNewProject: () => this.startNewProjectFlow(),
      onLoadTemplate: () => this.loadTemplate(),
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
      onOpenAssets: () => {}, // Removed: assetsDropdown no longer exists
      onOpenBlockEditor: () => this.openBlockEditor(),
      onOpenScriptWorkbench: () => this.openScriptWorkbench(),
      onOpenUIEditor: () => this.openUIEditor(),
      onToggleCollaboration: () => this.toggleCollaborationPanel(),
      isCollaborating: () => this.collaborationManager?.isCollaborating() ?? false,
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
      onCameraChange: (type) => {
        if (!this.state || !this.modeManager) return;
        const cameraDirector = this.modeManager.getCameraDirector();
        
        // In editor, only free-fly is allowed (fps and third-person are for play mode only)
        if (type === 'fps' || type === 'third-person') {
          // These camera types are not available in editor
          this.setStatusMessage('FPS and Third Person cameras are only available in Play mode', 2000);
          return;
        }
        
        cameraDirector.setMode(type);
        this.state.cameraType.value = type;
        
        this.setStatusMessage('Camera: Free Fly', 1000);
      },
      onLogin: () => {
        console.log('[EditorUI] Login requested');
        if (!this.loginModal) {
          this.loginModal = new LoginModal({
            onLogin: async (email, password) => {
              // TODO: Implement actual authentication
              console.log('[EditorUI] Login attempt:', { email });
              // For now, just show success message
              this.setStatusMessage('Login feature coming soon', 2000);
              // In production, call auth service here
              // await authService.login(email, password);
            },
            onClose: () => {
              this.loginModal = null;
            },
          });
        }
        this.loginModal.show();
      },
      onRegister: () => {
        console.log('[EditorUI] Register requested');
        if (!this.registerModal) {
          this.registerModal = new RegisterModal({
            onRegister: async (email, password) => {
              // TODO: Implement actual authentication
              console.log('[EditorUI] Register attempt:', { email });
              // For now, just show success message
              this.setStatusMessage('Register feature coming soon', 2000);
              // In production, call auth service here
              // await authService.register(email, password);
            },
            onClose: () => {
              this.registerModal = null;
            },
          });
        }
        this.registerModal.show();
      },
      isUserLoggedIn: () => false, // Mock for now
      getUserName: () => null,
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
        
        // Replicate transform changes
        if (this.collaborationManager?.isCollaborating()) {
          this.collaborationManager.replicateTransformUpdate(
            _entity.id,
            _entity.transform.position,
            _entity.transform.rotation,
            _entity.transform.scale
          );
        }
        
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
        
        // Replicate component property change (color)
        if (this.collaborationManager?.isCollaborating()) {
          // Color is stored in entity.userData.baseColor, but we can replicate it as component property
          // For now, we'll replicate it as a transform update since color change doesn't have a dedicated operation type
          this.collaborationManager.replicateTransformUpdate(
            entity.id,
            entity.transform.position,
            entity.transform.rotation,
            entity.transform.scale
          );
        }
      },
      onEntityRenamed: () => {
        this.state!.renameRev.value = this.state!.renameRev.value + 1;
        this.recordSnapshot('Rename entity');
      },
      onAssetSpawn: (_entity, _preset) => {
        this.config.updateSceneBuffers();
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
          // Block placement in shared view
          if (this.state.isSharedView.value) {
            this.config.statusEl.textContent = 'View-only mode: Editing is disabled';
            return;
          }

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
        }
      },
      onSelectionVisualsNeeded: () => {
        // Apply selection visuals when entity is selected
        this.visualManager?.applySelectionVisuals();
      },
      onOpenScriptWorkbench: () => {
        this.openScriptWorkbench();
      },
      getVegetationPaintController: () => {
        const controller = this.getVegetationPaintController();
        if (!controller) return null;
        return {
          activate: (preset: AssetPreset) => controller.activate(preset),
          updateConfig: (config: { brushRadius?: number; density?: number; minSpacing?: number }) => {
            controller.updatePaintConfig(config);
          },
          isActive: () => controller.isPaintModeActive(),
        };
      },
      getTerrainBuilderStudio: () => {
        return this.terrainBuilderStudio;
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
      getRenderer: () => this.config.getRenderer(),
      vegetationPresetManager: this.vegetationPresetManager,
      npcPresetManager: this.npcPresetManager,
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
      onTransformChanged: (entity) => {
        // Replicate transform changes
        if (this.collaborationManager?.isCollaborating()) {
          this.collaborationManager.replicateTransformUpdate(
            entity.id,
            entity.transform.position,
            entity.transform.rotation,
            entity.transform.scale
          );
        }
      },
      getRemoteCursors: () => this.collaborationManager?.getRemoteCursors() ?? new Map(),
    });
    void this.visualManager.initialize();
    this.disposables.add(() => this.visualManager?.dispose());

    // (Old floating QuickMenu removed; replaced with top bar above)

    // Initialize Enhanced WelcomeOverlay (first-time experience)
    const welcomeConfig: WelcomeOverlayConfig = {
      onStartTutorial: () => this.startInteractiveTutorial(),
      onQuickStart: () => this.showQuickStartGuide(),
      onShowQuickGuide: () => this.showQuickStartGuide(),
    };
    this.welcomeOverlay = new WelcomeOverlay(welcomeConfig);
    this.welcomeOverlay.mount();
    this.disposables.add(() => this.welcomeOverlay?.dispose());

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

    // Removed: AssetsDropdown and UnifiedBuildPanel (replaced by simplified AssetPalette)

    this.audio = new Audio.AudioManager({ scene: this.config.scene, orbitControls: this.config.controls });
    this.disposables.add(() => this.audio?.dispose());
    
    // Initialize Adaptive UI Manager
    this.adaptiveUI = new AdaptiveUIManager();
    this.disposables.add(() => this.adaptiveUI?.dispose());
    
    // Initialize Feature Introduction
    this.featureIntro = new FeatureIntroduction();
    this.disposables.add(() => this.featureIntro?.dispose());

    // Initialize Collaboration Manager (optional - requires auth token)
    try {
      // Get JWT token from localStorage (using same key as platform app)
      const jwtToken = localStorage.getItem('forge_token') || 'temp_token';
      this.collaborationManager = new CollaborationManager({
        scene: this.config.scene,
        physicsWorld: this.config.physicsWorld ?? null,
        jwtToken,
        wsUrl: 'ws://localhost:3001',
        onStart: () => {
          this.setStatusMessage('Collaboration started', 2000);
        },
        onStop: () => {
          this.setStatusMessage('Collaboration stopped', 2000);
        },
      });
      this.collaborationManager.initialize();
      
      // Mount collaboration panel (initially hidden)
      if (this.collaborationManager) {
        this.collaborationManager.mountPanel(document.body);
        // Hide panel initially
        const panel = this.collaborationManager.getPanel();
        if (panel) {
          const root = panel.getRoot();
          if (root) {
            root.style.display = 'none';
          }
        }

        // Subscribe to Play Mode synchronization events
        const unsubscribeRequested = this.collaborationManager.onPlayModeRequested((fromUser, requestId) => {
          this.handlePlayModeRequest(fromUser, requestId);
        });

        const unsubscribeStarted = this.collaborationManager.onPlayModeStarted(() => {
          this.handlePlayModeStart();
        });

        this.disposables.add(() => {
          unsubscribeRequested();
          unsubscribeStarted();
        });

        // Wire follow/stop-follow actions to ModeManager camera follow
        if (this.modeManager) {
          this.collaborationManager.setFollowHandlers(
            (userId: string) => {
              this.modeManager?.followUser(userId);
              this.collaborationManager?.setFollowingUser(userId);
              this.setStatusMessage(`Following ${userId}`, 1200);
            },
            () => {
              this.modeManager?.stopFollowingUser();
              this.collaborationManager?.setFollowingUser(null);
              this.setStatusMessage('Stopped following', 800);
            }
          );

          // Wire presenter toggle handler
          this.collaborationManager.setPresenterToggleHandler((active: boolean) => {
            if (active) {
              this.collaborationManager?.enablePresenterMode();
            } else {
              this.collaborationManager?.disablePresenterMode();
            }
          });

          // React to presenter changes: auto-follow presenter on non-presenters
          const unbindPresenter = this.collaborationManager.onPresenterChanged((userId) => {
            const presenterId = userId;
            if (!presenterId) {
              this.modeManager?.stopFollowingUser();
              this.collaborationManager?.setFollowingUser(null);
              this.setStatusMessage('Presenter mode off', 1000);
              return;
            }
            // If presenter is someone else, follow
            try {
              const rid = this.collaborationManager?.getLocalUserId() ?? null;
              if (!rid || presenterId !== rid) {
                this.modeManager?.followUser(presenterId);
                this.collaborationManager?.setFollowingUser(presenterId);
                this.setStatusMessage('Presenter mode on', 1000);
              }
            } catch {}
          });
          this.disposables.add(unbindPresenter);
        }
      }
      
      this.disposables.add(() => {
        this.playModeInviteDialog?.dispose();
        this.collaborationManager?.dispose();
      });
    } catch (error) {
      console.warn('Failed to initialize collaboration manager:', error);
    }
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
      this.panelManager?.refreshProperties();
    });

    // Subscribe to selection manager changes
    const unsubscribe = this.config.selection.onSelectionChanged(() => {
      const selected = this.config.selection.primarySelection;
      if (this.state) {
        this.state.selection.value = selected ? [selected] : [];
      }
      this.persistSelection();
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
        this.initializeWeaponHUD();
      } else if (mode === 'edit' && this.modeManager) {
        this.modeManager.exitPlayMode();
        this.disposeWeaponHUD();
      }
    });
    this.disposables.add(() => modeEffect());
    
    // React to UI preferences changes
    const uiPrefsEffect = effect(() => {
      const prefs = this.state!.uiPreferences.value;

      this.panelManager?.setVisibility({
        sidebar: true,
        inspector: prefs.showInspector,
      });

      // Removed: unifiedBuildPanel no longer exists

      if (this.state) {
        persistUIPreferences(this.state);
      }
    });
    this.disposables.add(() => uiPrefsEffect());

    // React to camera type changes
    const cameraTypeEffect = effect(() => {
      const cameraType = this.state!.cameraType.value;
      if (this.modeManager) {
        // In editor, only free-fly is allowed
        const effectiveCameraType = cameraType === 'fps' || cameraType === 'third-person' ? 'free-fly' : cameraType;
        this.modeManager.setEditCameraInputMode(effectiveCameraType);
        const cameraDirector = this.modeManager.getCameraDirector();

        // Always use free-fly in editor
        cameraDirector.setMode('free-fly');
        this.config.controls.setEnabled(false);
      }
      if (this.state) {
        persistCameraType(this.state);
      }
    });
    this.disposables.add(() => cameraTypeEffect());

    // Camera mode is now always free-fly in edit mode
    // No need for camera mode switching in editor
    // (Camera switching between FPS/Third Person happens in Play mode only)
    
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
      restoreCameraType(this.state);
    }

    // Safety: ensure no stale placement preview is active after startup
    try {
      this.cancelActivePlacement();
    } catch {}
  }


  /**
   * Seeds demo scene if empty.
   * Creates an advanced arena with architectural features: spiral stairs, bridges, 
   * parkour paths, alcoves, balconies, and multi-level structures.
   */
  private seedDemoScene(): void {
    if (this.config.scene.entityCount > 0) return;

    // Create default Environment entity for skybox/atmosphere editing
    try {
      const envEntity = new Entity('Environment');
      envEntity.addComponent(new EnvironmentComponent());
      // Position far away to avoid collision/interaction - this is not a visible mesh
      envEntity.transform.position = [0, -1000, 0];
      try {
        initializeBaseColor(envEntity, [0.6, 0.7, 0.9, 1]);
      } catch {}
      this.config.scene.addEntity(envEntity);
    } catch {
      // Ignore if component not available in certain test environments
    }

    // ========== HELPER FUNCTIONS ==========
    
    const createBlock = (
      name: string,
      pos: Vec3,
      scale: Vec3,
      matId: number,
      color?: RgbaColor
    ): Entity => {
      const entity = new Entity(name);
      entity.transform.position = pos;
      entity.transform.scale = scale;
      if (color) {
        initializeBaseColor(entity, color);
      }
      try {
        const mat = entity.getComponent(MaterialComponent) ?? entity.addComponent(new MaterialComponent());
        mat.materialId = matId;
      } catch {
        // ignore
      }
      this.config.scene.addEntity(entity);
      return entity;
    };

    // Spiral staircase helper
    const createSpiralStairs = (
      centerX: number,
      centerZ: number,
      radius: number,
      height: number,
      startAngle: number,
      matId: number
    ): void => {
      const steps = height * 6; // 6 steps per level
      for (let i = 0; i < steps; i++) {
        const angle = startAngle + (i / steps) * Math.PI * 3; // 1.5 rotations
        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;
        const y = (i / steps) * height;
        createBlock(`Spiral_${centerX}_${centerZ}_${i}`, [x, y, z], [1, 1, 1], matId);
      }
    };

    // Bridge helper
    const createBridge = (
      startPos: Vec3,
      endPos: Vec3,
      width: number,
      matId: number,
      name: string
    ): void => {
      const dx = endPos[0] - startPos[0];
      const dz = endPos[2] - startPos[2];
      const length = Math.sqrt(dx * dx + dz * dz);
      const steps = Math.ceil(length);
      const stepX = dx / steps;
      const stepZ = dz / steps;
      
      for (let i = 0; i <= steps; i++) {
        for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
          const perpX = (-stepZ / length) * w;
          const perpZ = (stepX / length) * w;
          const x = startPos[0] + stepX * i + perpX;
          const z = startPos[2] + stepZ * i + perpZ;
          const y = startPos[1];
          createBlock(`${name}_${i}_${w}`, [x, y, z], [1, 1, 1], matId);
          
          // Glass railings on edges
          if (Math.abs(w) === Math.floor(width / 2) && i % 2 === 0) {
            createBlock(`${name}_Rail_${i}_${w}`, [x, y + 1, z], [1, 1, 1], 7); // glass
          }
        }
      }
    };

    const arenaSize = 35;
    const halfSize = Math.floor(arenaSize / 2);

    // ========== 1. CHECKERBOARD FLOOR with CONCENTRIC CIRCLES ==========
    for (let x = -halfSize; x <= halfSize; x++) {
      for (let z = -halfSize; z <= halfSize; z++) {
        const distFromCenter = Math.sqrt(x * x + z * z);
        let matId: number;
        let color: RgbaColor | undefined;
        
        // Concentric circles in center
        if (distFromCenter < 3) {
          matId = 13; // yellow plastic
          color = [0.95, 0.85, 0.15, 1];
        } else if (distFromCenter < 6) {
          matId = 10; // red plastic
          color = [0.9, 0.15, 0.15, 1];
        } else if (distFromCenter < 9) {
          matId = 11; // blue plastic
          color = [0.15, 0.45, 0.95, 1];
        } else {
          // Checkerboard pattern for outer area
          const isEven = (x + z) % 2 === 0;
          matId = isEven ? 4 : 1; // grass : stone
        }
        
        createBlock(`Floor_${x}_${z}`, [x, -0.5, z], [1, 1, 1], matId, color);
      }
    }

    // ========== 2. ENHANCED WALLS (2 blocks thick) with CRENELLATIONS ==========
    const wallHeight = 5;
    
    // North wall (double thickness)
    for (let i = -halfSize; i <= halfSize; i++) {
      const matId = i % 5 === 0 ? 14 : 1; // buttresses every 5 blocks (concrete : stone)
      for (let h = 0; h < wallHeight; h++) {
        createBlock(`Wall_North_Outer_${i}_${h}`, [i, h, halfSize], [1, 1, 1], matId);
        createBlock(`Wall_North_Inner_${i}_${h}`, [i, h, halfSize - 1], [1, 1, 1], matId);
      }
      // Crenellations (pattern: block-gap-block)
      if (i % 2 === 0) {
        createBlock(`Wall_North_Cren_${i}`, [i, wallHeight, halfSize], [1, 1, 1], matId);
      }
    }
    
    // South wall
    for (let i = -halfSize; i <= halfSize; i++) {
      const matId = i % 5 === 0 ? 14 : 1;
      for (let h = 0; h < wallHeight; h++) {
        createBlock(`Wall_South_Outer_${i}_${h}`, [i, h, -halfSize], [1, 1, 1], matId);
        createBlock(`Wall_South_Inner_${i}_${h}`, [i, h, -halfSize + 1], [1, 1, 1], matId);
      }
      if (i % 2 === 0) {
        createBlock(`Wall_South_Cren_${i}`, [i, wallHeight, -halfSize], [1, 1, 1], matId);
      }
    }
    
    // East wall
    for (let i = -halfSize; i <= halfSize; i++) {
      const matId = i % 5 === 0 ? 14 : 1;
      for (let h = 0; h < wallHeight; h++) {
        createBlock(`Wall_East_Outer_${i}_${h}`, [halfSize, h, i], [1, 1, 1], matId);
        createBlock(`Wall_East_Inner_${i}_${h}`, [halfSize - 1, h, i], [1, 1, 1], matId);
      }
      if (i % 2 === 0) {
        createBlock(`Wall_East_Cren_${i}`, [halfSize, wallHeight, i], [1, 1, 1], matId);
      }
    }
    
    // West wall
    for (let i = -halfSize; i <= halfSize; i++) {
      const matId = i % 5 === 0 ? 14 : 1;
      for (let h = 0; h < wallHeight; h++) {
        createBlock(`Wall_West_Outer_${i}_${h}`, [-halfSize, h, i], [1, 1, 1], matId);
        createBlock(`Wall_West_Inner_${i}_${h}`, [-halfSize + 1, h, i], [1, 1, 1], matId);
      }
      if (i % 2 === 0) {
        createBlock(`Wall_West_Cren_${i}`, [-halfSize, wallHeight, i], [1, 1, 1], matId);
      }
    }

    // ========== 3. HIDDEN ALCOVES in walls ==========
    const alcoves = [
      { x: 0, z: halfSize - 2, dir: 'north', wallNormal: [0, 0, -1] },
      { x: 0, z: -halfSize + 2, dir: 'south', wallNormal: [0, 0, 1] },
      { x: halfSize - 2, z: 0, dir: 'east', wallNormal: [-1, 0, 0] },
      { x: -halfSize + 2, z: 0, dir: 'west', wallNormal: [1, 0, 0] },
    ];
    
    for (const alcove of alcoves) {
      // Create 3x3x2 room
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (let h = 0; h < 2; h++) {
            const normalX = alcove.wallNormal[0] ?? 0;
            const normalZ = alcove.wallNormal[2] ?? 0;
            const x = normalX === 0 ? alcove.x + dx : alcove.x + dz * normalX;
            const z = normalZ === 0 ? alcove.z + dz : alcove.z + dx * normalZ;
            createBlock(`Alcove_${alcove.dir}_${dx}_${dz}_${h}`, [x, h + 1, z], [1, 1, 1], 14); // concrete
          }
        }
      }
      // Treasure light in center
      const normalX = alcove.wallNormal[0] ?? 0;
      const normalZ = alcove.wallNormal[2] ?? 0;
      const centerX = normalX === 0 ? alcove.x : alcove.x + normalX;
      const centerZ = normalZ === 0 ? alcove.z : alcove.z + normalZ;
      createBlock(`Alcove_Light_${alcove.dir}`, [centerX, 1.5, centerZ], [0.5, 0.5, 0.5], 8, [1, 1, 0.8, 1]);
    }

    // ========== 4. CORNER TOWERS (height 8) with SPIRAL STAIRS ==========
    const towerPositions: [Vec3, number, string][] = [
      [[halfSize - 3, 0, halfSize - 3], 10, 'Red'],
      [[-halfSize + 3, 0, halfSize - 3], 11, 'Blue'],
      [[halfSize - 3, 0, -halfSize + 3], 12, 'Green'],
      [[-halfSize + 3, 0, -halfSize + 3], 13, 'Yellow'],
    ];

    for (const [basePos, matId, colorName] of towerPositions) {
      // Tower core (3x3)
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          for (let y = 0; y < 8; y++) {
            // Hollow center for stairs
            if (x === 0 && z === 0 && y > 0) continue;
            createBlock(
              `Tower_${colorName}_${x}_${y}_${z}`,
              [basePos[0] + x, basePos[1] + y, basePos[2] + z],
              [1, 1, 1],
              matId
            );
          }
        }
      }
      
      // Spiral staircase around tower
      createSpiralStairs(basePos[0], basePos[2], 2.2, 8, 0, 5); // dirt stairs
      
      // Balconies at y=5 and y=7
      for (const balconyY of [5, 7]) {
        for (let dx = -2; dx <= 2; dx++) {
          createBlock(
            `Tower_${colorName}_Balcony_${balconyY}_${dx}`,
            [basePos[0] + dx, balconyY, basePos[2] + (dx < 0 ? -3 : 3)],
            [1, 1, 1],
            14 // concrete
          );
          // Glass railing
          if (Math.abs(dx) === 2) {
            createBlock(
              `Tower_${colorName}_Balcony_Rail_${balconyY}_${dx}`,
              [basePos[0] + dx, balconyY + 1, basePos[2] + (dx < 0 ? -3 : 3)],
              [1, 1, 1],
              7 // glass
            );
          }
        }
      }
    }

    // ========== 5. BRIDGES connecting towers ==========
    createBridge(
      [halfSize - 3, 3, halfSize - 3],
      [-halfSize + 3, 3, halfSize - 3],
      3,
      5,
      'Bridge_North'
    ); // North bridge
    
    createBridge(
      [halfSize - 3, 3, -halfSize + 3],
      [-halfSize + 3, 3, -halfSize + 3],
      3,
      5,
      'Bridge_South'
    ); // South bridge
    
    createBridge(
      [halfSize - 3, 3, halfSize - 3],
      [halfSize - 3, 3, -halfSize + 3],
      3,
      5,
      'Bridge_East'
    ); // East bridge
    
    createBridge(
      [-halfSize + 3, 3, halfSize - 3],
      [-halfSize + 3, 3, -halfSize + 3],
      3,
      5,
      'Bridge_West'
    ); // West bridge

    // ========== 6. PARKOUR PATH - floating platforms ==========
    const parkourPath: [Vec3, Vec3][] = [
      [[10, 0.5, 10], [1, 1, 1]],
      [[12, 1, 12], [0.8, 0.8, 0.8]],
      [[13, 1.8, 14], [0.6, 0.6, 0.6]],
      [[14, 2.5, 15], [1, 1, 1]],
      [[13, 3.2, 13], [0.7, 0.7, 0.7]],
      [[11, 4, 12], [0.9, 0.9, 0.9]],
      [[9, 4.8, 13], [0.6, 0.6, 0.6]],
      [[7, 5.5, 14], [0.8, 0.8, 0.8]],
      [[5, 6.2, 13], [1, 1, 1]],
      [[3, 7, 12], [0.7, 0.7, 0.7]],
      [[1, 7.8, 11], [0.9, 0.9, 0.9]],
      [[-1, 8.5, 10], [0.6, 0.6, 0.6]],
      [[-3, 9.2, 9], [1, 1, 1]],
      [[-5, 10, 8], [0.8, 0.8, 0.8]],
    ];
    
    for (let i = 0; i < parkourPath.length; i++) {
      const [pos, scale] = parkourPath[i]!;
      const colors = [
        [0.9, 0.15, 0.15, 1],
        [0.15, 0.45, 0.95, 1],
        [0.15, 0.85, 0.25, 1],
        [0.95, 0.85, 0.15, 1],
      ] as RgbaColor[];
      const color = colors[i % 4]!;
      const matId = 10 + (i % 4); // rotating plastic colors
      createBlock(`Parkour_${i}`, pos, scale, matId, color);
    }

    // ========== 7. DIAGONAL RAMPS in corners ==========
    const ramps = [
      { start: [12, 0, 12], dir: [-1, 0.3, -1], length: 8, name: 'NE' },
      { start: [-12, 0, 12], dir: [1, 0.3, -1], length: 8, name: 'NW' },
      { start: [12, 0, -12], dir: [-1, 0.3, 1], length: 8, name: 'SE' },
      { start: [-12, 0, -12], dir: [1, 0.3, 1], length: 8, name: 'SW' },
    ];
    
    for (const ramp of ramps) {
      for (let i = 0; i < ramp.length; i++) {
        const startX = ramp.start[0] ?? 0;
        const startY = ramp.start[1] ?? 0;
        const startZ = ramp.start[2] ?? 0;
        const dirX = ramp.dir[0] ?? 0;
        const dirY = ramp.dir[1] ?? 0;
        const dirZ = ramp.dir[2] ?? 0;
        const x = startX + dirX * i;
        const y = startY + dirY * i;
        const z = startZ + dirZ * i;
        createBlock(`Ramp_${ramp.name}_${i}`, [x, y, z], [1, 1, 1], 5); // dirt
      }
    }

    // ========== 8. CENTRAL PIT with elevated column ==========
    // Pit (depression)
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist < 4) {
          createBlock(`Pit_${x}_${z}`, [x, -1.5, z], [1, 1, 1], 5); // dirt pit
        }
      }
    }
    
    // Tall central column
    for (let y = 0; y < 12; y++) {
      createBlock(`Central_Column_${y}`, [0, y, 0], [1, 1, 1], 13, [0.95, 0.85, 0.15, 1]);
    }

    // ========== 9. ENHANCED TUNNELS (5x5 with lighting) ==========
    for (let z = -5; z <= 5; z++) {
      for (let y = 0; y < 4; y++) {
        for (let w = -1; w <= 1; w++) {
          // East tunnel
          if (y === 0 || y === 3 || Math.abs(w) === 1) {
            createBlock(`Tunnel_East_${z}_${y}_${w}`, [halfSize - 6 + w, y, z], [1, 1, 1], 14);
          }
          // West tunnel
          if (y === 0 || y === 3 || Math.abs(w) === 1) {
            createBlock(`Tunnel_West_${z}_${y}_${w}`, [-halfSize + 6 + w, y, z], [1, 1, 1], 14);
          }
        }
      }
      // Tunnel lighting every 3 blocks
      if (z % 3 === 0) {
        createBlock(`Tunnel_East_Light_${z}`, [halfSize - 6, 2.5, z], [0.5, 0.5, 0.5], 8, [1, 1, 1, 1]);
        createBlock(`Tunnel_West_Light_${z}`, [-halfSize + 6, 2.5, z], [0.5, 0.5, 0.5], 8, [1, 1, 1, 1]);
      }
    }

    // ========== 10. PARTIAL ROOF with SKYLIGHTS ==========
    const roofY = 7;
    for (let x = -halfSize + 5; x <= halfSize - 5; x += 3) {
      for (let z = -halfSize + 5; z <= halfSize - 5; z += 3) {
        // Roof panels (concrete)
        for (let dx = 0; dx < 2; dx++) {
          for (let dz = 0; dz < 2; dz++) {
            createBlock(`Roof_${x}_${z}_${dx}_${dz}`, [x + dx, roofY, z + dz], [1, 1, 1], 14);
          }
        }
        // Skylight (glass) in center of some panels
        if ((x + z) % 6 === 0) {
          createBlock(`Skylight_${x}_${z}`, [x + 1, roofY + 0.5, z + 1], [1, 1, 1], 7);
        }
      }
    }

    // ========== 11. VIEWING BALCONIES on walls ==========
    const balconies = [
      { x: 0, z: halfSize - 3, y: 5, dir: 'north', extend: [0, -1] },
      { x: 0, z: -halfSize + 3, y: 5, dir: 'south', extend: [0, 1] },
      { x: halfSize - 3, z: 0, y: 5, dir: 'east', extend: [-1, 0] },
      { x: -halfSize + 3, z: 0, y: 5, dir: 'west', extend: [1, 0] },
    ];
    
    for (const balcony of balconies) {
      for (let i = -2; i <= 2; i++) {
        for (let d = 0; d < 2; d++) {
          const extendX = balcony.extend[0] ?? 0;
          const extendZ = balcony.extend[1] ?? 0;
          const x = balcony.x + (extendX === 0 ? i : extendX * d);
          const z = balcony.z + (extendZ === 0 ? i : extendZ * d);
          createBlock(`Balcony_${balcony.dir}_${i}_${d}`, [x, balcony.y, z], [1, 1, 1], 14);
          
          // Glass railings
          if (d === 1 && Math.abs(i) === 2) {
            createBlock(`Balcony_Rail_${balcony.dir}_${i}`, [x, balcony.y + 1, z], [1, 1, 1], 7);
          }
        }
      }
    }

    // ========== 12. DECORATIVE LIGHTS in strategic positions ==========
    const lightPositions: Vec3[] = [
      [halfSize - 4, 6, halfSize - 4],
      [-halfSize + 4, 6, halfSize - 4],
      [halfSize - 4, 6, -halfSize + 4],
      [-halfSize + 4, 6, -halfSize + 4],
      [0, 10, 10],
      [0, 10, -10],
      [10, 10, 0],
      [-10, 10, 0],
    ];
    
    for (let i = 0; i < lightPositions.length; i++) {
      const pos = lightPositions[i]!;
      createBlock(`Light_${i}`, pos, [0.8, 0.8, 0.8], 8, [1.0, 1.0, 0.9, 1]);
    }

    // Add default scene lighting
    LightManager.createDefaultLights(this.config.scene);

    this.recordSnapshot('Seed scene', { force: true });
    this.panelManager?.refreshProperties();
  }

  /**
   * Updates control enabled state based on UI hover.
   */
  private updateControlEnabledState(): void {
    const isHoveringAnyPanel = this.inspectorHover || this.sidebarHover;
    const shouldEnable = !isHoveringAnyPanel;
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

  public openUIEditor(): void {
    if (!this.uiEditor) return;
    this.uiEditor.open();
  }

  public openBlockEditor(): void {
    showCustomProfileEditor();
  }

  /**
   * Handles search query from toolbar
   */
  private handleSearch(query: string): void {
    if (!this.searchManager) return;

    if (!query || query.trim().length === 0) {
      this.searchManager.clearSearch();
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
    this.vegetationPaintController?.dispose();

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
    this.vegetationPaintController = null;
    // Dispose modals
    this.loginModal?.hide();
    this.registerModal?.hide();
    this.loginModal = null;
    this.registerModal = null;
  }

  /** Returns true when Play Mode is active. */
  public isPlayMode(): boolean {
    return this.modeManager?.isPlayMode() ?? false;
  }

  /**
   * Gets the vegetation paint controller instance.
   */
  public getVegetationPaintController(): VegetationPaintController | null {
    return this.vegetationPaintController;
  }

  /**
   * Update brand watermark FPS counter (call from render loop)
   */
  public updateBrandWatermark(): void {
    this.brandWatermark?.updateFPS();
  }

  public getModeManager(): EditorModeManager | null {
    return this.modeManager;
  }


  private resumePlayMode(): void {
    if (!this.modeManager || !this.state || this.state.editorMode.value !== 'play') return;
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

  /**
   * Initializes weapon HUD for play mode
   */
  private initializeWeaponHUD(): void {
    if (this.weaponHUD) {
      this.weaponHUD.dispose();
    }

    if (!this.layout) return;

    // Get canvas container from layout
    const containers = this.layout.getContainers();
    const canvasContainer = containers.canvasContainer || document.body;
    if (!canvasContainer) return;

    // Find player entity (entity with RuntimePlayerTag or CharacterController)
    let playerEntity: Entity | null = null;
    const playerTagged = this.config.scene.queryEntities(RuntimePlayerTag);
    if (playerTagged.length > 0) {
      playerEntity = playerTagged[0]!;
    } else {
      // Fallback: find entity with CharacterController and weapon
      const withController = this.config.scene.queryEntities(CharacterController);
      for (const entity of withController) {
        if (entity.getComponent(WeaponComponent) || entity.getComponent(InventoryComponent)) {
          playerEntity = entity;
          break;
        }
      }
    }

    this.weaponHUD = new WeaponHUD({
      scene: this.config.scene,
      playerEntity,
      container: canvasContainer,
    });

    this.weaponHUD.show();
  }

  /**
   * Disposes weapon HUD
   */
  private disposeWeaponHUD(): void {
    if (this.weaponHUD) {
      this.weaponHUD.dispose();
      this.weaponHUD = null;
    }
  }

  /**
   * Starts the interactive tutorial for new users.
   */
  private startInteractiveTutorial(): void {
    if (this.interactiveTutorial) {
      // If tutorial already exists, restart it
      this.interactiveTutorial.dispose();
    }

    const tutorialConfig = createEditorTutorial();
    tutorialConfig.onComplete = () => {
      this.setStatusMessage('Tutorial completed! You\'re ready to create.', 3000);
      this.showQuickStartGuide();
    };
    tutorialConfig.onSkip = () => {
      this.setStatusMessage('Tutorial skipped', 2000);
    };

    this.interactiveTutorial = new InteractiveTutorial(tutorialConfig);
    this.interactiveTutorial.start();
  }

  /**
   * Shows the Quick Start Guide panel.
   */
  private showQuickStartGuide(): void {
    if (this.quickStartGuide) {
      this.quickStartGuide.show();
      return;
    }

    this.quickStartGuide = new QuickStartGuide({
      onAddObject: () => {
        // Hint: User can browse assets in the right panel
        this.setStatusMessage('Browse assets in the right panel to add objects', 3000);
      },
      onSaveProject: () => {
        this.projectManager?.saveProject();
      },
      onPlayMode: () => {
        this.modeManager?.enterPlayMode();
      },
      onOpenHelp: () => {
        // Open keyboard shortcuts modal
        const modal = new KeyboardShortcutsModal();
        modal.show();
      },
    });
    this.quickStartGuide.mount();
    this.disposables.add(() => this.quickStartGuide?.dispose());
  }

  /**
   * Toggle collaboration panel visibility.
   */
  private toggleCollaborationPanel(): void {
    if (!this.collaborationManager) {
      this.setStatusMessage('Collaboration not available. Please login first.', 3000);
      return;
    }

    const panel = this.collaborationManager.getPanel();
    if (!panel) {
      return;
    }

    this.collaborationPanelVisible = !this.collaborationPanelVisible;

    if (this.collaborationPanelVisible) {
      // Panel is already mounted (mounted in initializeManagers)
      // Just ensure it's visible
      const root = panel.getRoot();
      if (root) {
        root.style.display = 'block';
      }
    } else {
      // Hide panel
      const root = panel.getRoot();
      if (root) {
        root.style.display = 'none';
      }
    }
  }

  /**
   * Get collaboration manager (for external access).
   */
  public getCollaborationManager(): CollaborationManager | null {
    return this.collaborationManager;
  }

  /**
   * Handle Play Mode request from another user.
   */
  private handlePlayModeRequest(fromUser: PublicUser, requestId: string): void {
    if (!this.collaborationManager) {
      return;
    }

    // Hide any existing dialog
    if (this.playModeInviteDialog) {
      this.playModeInviteDialog.hide();
    }

    // Create and show new dialog
    this.playModeInviteDialog = new PlayModeInviteDialog({
      fromUser,
      onAccept: () => {
        this.collaborationManager?.respondToPlayModeRequest(requestId, true);
        this.playModeInviteDialog = null;
      },
      onReject: () => {
        this.collaborationManager?.respondToPlayModeRequest(requestId, false);
        this.playModeInviteDialog = null;
      },
      timeout: 30000, // 30 seconds
    });

    this.playModeInviteDialog.show();
  }

  /**
   * Handle Play Mode start notification.
   * Called when all users accepted the request and Play Mode should start.
   */
  private handlePlayModeStart(): void {
    // Hide dialog if shown
    if (this.playModeInviteDialog) {
      this.playModeInviteDialog.hide();
      this.playModeInviteDialog = null;
    }

    // Enter Play Mode
    if (this.modeManager) {
      this.modeManager.enterPlayModeSync();
    }
  }

  /**
   * Public: Cancels any active placement preview (ghost cube) immediately.
   */
  public cancelActivePlacement(): void {
    try {
      this.placementMode?.cancelPlacement(true);
    } catch {}
    try {
      if (this.state) {
        this.state.placementMode.value = false;
      }
    } catch {}
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
