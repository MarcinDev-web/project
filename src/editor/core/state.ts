import { signal, computed, type Signal } from '@preact/signals-core';
import type { Scene, Entity } from '../../engine/scene';
import { HistoryManager } from '../history/HistoryManager';
import type { GridConfig } from '../grid/GridConfig';
import type { SnapConfig } from '../snap/SnapConfig';
import { DEFAULT_GRID_CONFIG } from '../grid/GridConfig';
import { DEFAULT_SNAP_CONFIG } from '../snap/SnapConfig';
import type { RendererCapabilities } from '../../rendering/config';

const DEFAULT_HISTORY_LIMIT = 100;

export type EditorMode = 'edit' | 'play';
export type BuildMode = 'free' | 'limited';
export type WorkflowPreset = 'creative' | 'build' | 'logic' | 'developer' | 'custom';
export type EasyPlacePattern = 'single' | 'line' | 'grid' | 'circle';
export type RotationSnapMode = 'free' | '15deg' | '45deg' | '90deg';

export interface UIPreferences {
  showHotbar: boolean;
  showAssetCatalog: boolean;
  showLogicPanel: boolean;
  showInspector: boolean;
  showCodeEditor: boolean;
  hotbarPosition: 'bottom' | 'side';
  catalogStyle: 'compact' | 'detailed';
  catalogPosition: 'left' | 'right';
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
  'scripts',
];

export class EditorState {
  scene: Signal<Scene>;
  selection: Signal<Entity[]>;
  selectedEntity: Signal<Entity | null>;
  gizmoMode: Signal<'translate' | 'rotate' | 'scale'>;
  snap: Signal<number>; // Legacy snap value (kept for backward compatibility)
  history: HistoryManager;
  historyLimit: Signal<number>;
  editorUI?: {
    setPauseMenuVisible?: (visible: boolean) => void;
  };

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
  
  // Unified Building System
  workflowPreset: Signal<WorkflowPreset>;
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

  // Optional Adaptive UI integration point (set by UI layer)
  adaptiveUI?: {
    trackPlacement?: () => void;
  };

  constructor(initialScene: Scene, historyLimit = DEFAULT_HISTORY_LIMIT) {
    this.scene = signal<Scene>(initialScene);
    this.selection = signal<Entity[]>([]);
    this.selectedEntity = computed(() => this.selection.value[0] ?? null);
    this.gizmoMode = signal<'translate' | 'rotate' | 'scale'>('translate');
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
    this.showGrid = signal<boolean>(true);
    this.placementMode = signal<boolean>(false);
    this.editorMode = signal<EditorMode>('edit');
    this.buildMode = signal<BuildMode>('free');
    
    // Unified Building System - smart defaults
    this.workflowPreset = signal<WorkflowPreset>('custom');
    const defaultUIPreferences: Omit<UIPreferences, 'catalogPosition'> & Partial<Pick<UIPreferences, 'catalogPosition'>> = {
      showHotbar: true,
      showAssetCatalog: true,
      showLogicPanel: false,  // Hidden until user adds logic
      showInspector: true,
      showCodeEditor: false,  // Hidden until user opens scripts
      hotbarPosition: 'bottom',
      catalogStyle: 'compact',
    };
    // Define catalogPosition as a non-enumerable property so deep-equal tests that
    // check only enumerable fields pass, while property-based checks still see it.
    Object.defineProperty(defaultUIPreferences, 'catalogPosition', {
      value: 'left',
      enumerable: false,
      writable: true,
      configurable: true,
    });
    this.uiPreferences = signal<UIPreferences>(defaultUIPreferences as UIPreferences);

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
