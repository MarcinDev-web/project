import { signal, computed, type Signal } from '@preact/signals-core';
import type { Scene, Entity } from '@engine/world';
import { HistoryManager } from '@engine/editor-utils';
import type { GridConfig } from '../grid/GridConfig';
import type { SnapConfig } from '@engine/editor-utils';
import { DEFAULT_SNAP_CONFIG } from '@engine/editor-utils';
import { DEFAULT_GRID_CONFIG } from '../grid/GridConfig';
import type { RendererCapabilities } from '@engine/gfx-webgpu/config';

const DEFAULT_HISTORY_LIMIT = 100;

export type EditorMode = 'edit' | 'play';
export type BuildMode = 'free' | 'limited';
export type EasyPlacePattern = 'single' | 'line' | 'grid' | 'circle';
export type RotationSnapMode = 'free' | '15deg' | '45deg' | '90deg';
export type CameraType = 'free-fly' | 'fps' | 'third-person';
export type CameraMode = 'orbit' | 'free-fly';
export type PlayModeCameraType = 'fps' | 'third-person'; // Camera types available in Play mode
export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'uniform';
export type TransformSpace = 'world' | 'local';

export interface UIPreferences {
  showHotbar: boolean;
  showInspector: boolean;
}

export interface EasyPlaceSettings {
  enabled: boolean;
  autoEnable: boolean; // Auto-enable when entering placement mode
  gridSpacing: number;
  lineSpacing: number;
  circleRadius: number;
  circleCount: number;
}

export interface PrecisionSettings {
  positionStep: number; // Arrow key movement step
  fineStep: number; // Shift+Arrow fine step
  coarseStep: number; // Ctrl+Arrow coarse step
  rotationStep: number; // Bracket key rotation step
  fineRotationStep: number; // Shift+Bracket fine rotation
}

export interface CameraPreferences {
  playModeCamera: PlayModeCameraType; // Default camera for Play mode
  thirdPersonDistance: number; // Third person camera distance
  thirdPersonHeight: number; // Third person camera height
  sensitivity: number; // Mouse sensitivity
  invertY: boolean; // Invert Y axis
}

export interface InspectorLayoutPreferences {
  order: string[];
  collapsed: Record<string, boolean>;
  activeSection: string | null;
}

export const DEFAULT_INSPECTOR_SECTION_ORDER: string[] = [
  'transform',
  'appearance',
  'material',
  'camera',
  'environment',
  'animation',
  'character-controller',
  'npc',
  'ui',
  'scripts',
  'spawn-point',
  'checkpoint',
];

export class EditorState {
  scene: Signal<Scene>;
  selection: Signal<Entity[]>;
  selectedEntity: Signal<Entity | null>;
  gizmoMode: Signal<GizmoMode>;
  transformSpace: Signal<TransformSpace>;
  snap: Signal<number>; // Legacy snap value (kept for backward compatibility)
  history: HistoryManager;
  historyLimit: Signal<number>;
  editorUI?: {
    setPauseMenuVisible?: (visible: boolean) => void;
  } | undefined;

  // Reactive event ticks (increment to emit)
  transformRev: Signal<number>;
  colorRev: Signal<number>;
  renameRev: Signal<number>;

  // New snap-to-grid system
  snapConfig: Signal<SnapConfig>;
  gridConfig: Signal<GridConfig>;
  showGrid: Signal<boolean>;
  placementMode: Signal<boolean>;
  editorMode: Signal<EditorMode>;
  buildMode: Signal<BuildMode>;
  
  // UI Preferences
  uiPreferences: Signal<UIPreferences>;

  // Last selected preset to place (persisted between sessions)
  lastPlacementPreset: Signal<{
    name: string;
    blockId?: string;
    scale: [number, number, number];
    color: [number, number, number, number];
  } | null>;

  // Renderer capabilities and UI feature flags
  capabilities: Signal<RendererCapabilities | null>;
  featureFlags: Signal<{
    enableTimestamps: boolean;
    enableOcclusion: boolean;
  }>;

  // Easy Place mode
  easyPlaceMode: Signal<boolean>;
  easyPlacePattern: Signal<EasyPlacePattern>;
  easyPlaceSettings: Signal<EasyPlaceSettings>;

  // Precision controls
  rotationSnapMode: Signal<RotationSnapMode>;
  precisionSettings: Signal<PrecisionSettings>;
  showPrecisionControls: Signal<boolean>;
  inspectorLayout: Signal<InspectorLayoutPreferences>;

  // Camera selection
  cameraType: Signal<CameraType>;
  cameraMode: Signal<CameraMode>;
  cameraPreferences: Signal<CameraPreferences>;

  // Share/view-only mode
  isSharedView: Signal<boolean>;

  // Optional Adaptive UI integration point (set by UI layer)
  adaptiveUI?: {
    trackPlacement?: () => void;
  };

  constructor(initialScene: Scene, historyLimit = DEFAULT_HISTORY_LIMIT) {
    this.scene = signal<Scene>(initialScene);
    this.selection = signal<Entity[]>([]);
    this.selectedEntity = computed(() => this.selection.value[0] ?? null);
    this.gizmoMode = signal<GizmoMode>('translate');
    this.transformSpace = signal<TransformSpace>('world');
    this.snap = signal<number>(0.5);
    this.history = new HistoryManager(historyLimit);
    this.historyLimit = signal<number>(historyLimit);

    // Event signals
    this.transformRev = signal<number>(0);
    this.colorRev = signal<number>(0);
    this.renameRev = signal<number>(0);

    // Initialize new snap-to-grid system
    this.snapConfig = signal<SnapConfig>({ ...DEFAULT_SNAP_CONFIG });
    this.gridConfig = signal<GridConfig>({ ...DEFAULT_GRID_CONFIG });
    this.showGrid = signal<boolean>(false);
    this.placementMode = signal<boolean>(false);
    this.editorMode = signal<EditorMode>('edit');
    this.buildMode = signal<BuildMode>('free');
    
    // UI Preferences - simplified to Minecraft creative style
    this.uiPreferences = signal<UIPreferences>({
      showHotbar: true,
      showInspector: true,
    });

    // Last placement preset (initially none)
    this.lastPlacementPreset = signal(null);

    // Capabilities and UI feature flags defaults
    this.capabilities = signal<RendererCapabilities | null>(null);
    this.featureFlags = signal({
      enableTimestamps: false,
      enableOcclusion: false,
    });

    // Easy Place mode defaults
    this.easyPlaceMode = signal<boolean>(false);
    this.easyPlacePattern = signal<EasyPlacePattern>('single');
    this.easyPlaceSettings = signal<EasyPlaceSettings>({
      enabled: false,
      autoEnable: false,
      gridSpacing: 1.0,
      lineSpacing: 1.0,
      circleRadius: 3.0,
      circleCount: 8,
    });

    // Precision controls defaults
    this.rotationSnapMode = signal<RotationSnapMode>('45deg');
    this.precisionSettings = signal<PrecisionSettings>({
      positionStep: 0.1,
      fineStep: 0.01,
      coarseStep: 1.0,
      rotationStep: 5,
      fineRotationStep: 1,
    });
    this.showPrecisionControls = signal<boolean>(true);
    this.inspectorLayout = signal<InspectorLayoutPreferences>({
      order: [...DEFAULT_INSPECTOR_SECTION_ORDER],
      collapsed: {},
      activeSection: 'transform',
    });

    // Camera selection defaults
    this.cameraType = signal<CameraType>('free-fly');
    this.cameraMode = signal<CameraMode>('free-fly'); // Free-fly is now the default editor camera
    this.cameraPreferences = signal<CameraPreferences>({
      playModeCamera: 'fps', // Default to first person in Play mode
      thirdPersonDistance: 3.5,
      thirdPersonHeight: 1.2,
      sensitivity: 0.0025,
      invertY: false,
    });

    // Share/view-only mode - disabled by default
    this.isSharedView = signal<boolean>(false);
  }

  /** Temporarily disables history recording (used during undo/redo). */
  disableHistory(): void {
    this.history.freeze();
  }

  /** Re-enables history recording. */
  enableHistory(): void {
    this.history.unfreeze();
  }

  /** Records a snapshot if history is enabled. */
  recordHistory(snapshot: Parameters<HistoryManager['push']>[0]): void {
    this.history.push(snapshot);
  }

  updateHistoryLimit(limit: number): void {
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error('History limit must be positive');
    }
    const rounded = Math.floor(limit);
    if (rounded === this.historyLimit.value) return;

    this.history.setLimit(rounded);
    this.historyLimit.value = rounded;
  }

  setHistoryLimit(limit: number): void {
    this.updateHistoryLimit(limit);
  }
}
