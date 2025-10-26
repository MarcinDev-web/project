/**
 * WorkflowPresets - UI preference templates for different building workflows
 * 
 * These are NOT feature gates - all features remain available.
 * Presets just configure UI layout/visibility for common workflows.
 * Users can freely customize and mix-and-match features.
 */

import type { UIPreferences, WorkflowPreset as WorkflowPresetType } from '../core/state';

export interface WorkflowPresetDefinition {
  name: string;
  description: string;
  icon: string;
  uiPreferences: Partial<UIPreferences>;
}

/**
 * Workflow presets - UI templates for different creation styles
 */
export const WORKFLOW_PRESETS: Record<Exclude<WorkflowPresetType, 'custom'>, WorkflowPresetDefinition> = {
  creative: {
    name: 'Quick Build',
    description: 'Minecraft-style: fast block placement with hotbar',
    icon: 'blocks',
    uiPreferences: {
      showHotbar: true,
      showAssetCatalog: false,  // Hide catalog for speed
      catalogStyle: 'compact',
      hotbarPosition: 'bottom',
      showInspector: true,
      showLogicPanel: false,
      showCodeEditor: false,
    },
  },
  
  build: {
    name: 'Build Mode',
    description: 'Hybrid building: Hotbar + full asset catalog',
    icon: 'hammer',
    uiPreferences: {
      showHotbar: true,  // Both hotbar and catalog visible
      showAssetCatalog: true,
      catalogStyle: 'detailed',  // Show prices/details
      catalogPosition: 'left',  // Catalog on left side
      showInspector: true,
      hotbarPosition: 'bottom',
      showLogicPanel: false,
      showCodeEditor: false,
    },
  },
  
  logic: {
    name: 'Game Logic',
    description: 'KoGaMa-style: add interactivity and behaviors',
    icon: 'zap',
    uiPreferences: {
      showHotbar: true,
      showAssetCatalog: true,
      showLogicPanel: true,  // Show logic panel
      showInspector: true,
      catalogStyle: 'compact',
      hotbarPosition: 'bottom',
      showCodeEditor: false,
    },
  },
  
  developer: {
    name: 'Pro Mode',
    description: 'Roblox-style: full control with code and advanced tools',
    icon: 'code',
    uiPreferences: {
      showHotbar: true,
      showAssetCatalog: true,
      showLogicPanel: true,
      showInspector: true,
      showCodeEditor: true,  // Show code editor
      catalogStyle: 'detailed',
      hotbarPosition: 'bottom',
    },
  },
};

/**
 * Gets preset definition by ID
 */
export function getWorkflowPreset(preset: Exclude<WorkflowPresetType, 'custom'>): WorkflowPresetDefinition {
  return WORKFLOW_PRESETS[preset];
}

/**
 * Gets all available presets
 */
export function getAllWorkflowPresets(): Array<{ id: Exclude<WorkflowPresetType, 'custom'>; preset: WorkflowPresetDefinition }> {
  return Object.entries(WORKFLOW_PRESETS).map(([id, preset]) => ({
    id: id as Exclude<WorkflowPresetType, 'custom'>,
    preset,
  }));
}

/**
 * Applies a workflow preset to UI preferences (non-destructive merge)
 */
export function applyWorkflowPreset(
  currentPreferences: UIPreferences,
  preset: Exclude<WorkflowPresetType, 'custom'>
): UIPreferences {
  const presetDef = WORKFLOW_PRESETS[preset];
  return {
    ...currentPreferences,
    ...presetDef.uiPreferences,
  };
}

/**
 * Detects if current preferences match a preset
 */
export function detectWorkflowPreset(preferences: UIPreferences): WorkflowPresetType {
  for (const [id, preset] of Object.entries(WORKFLOW_PRESETS)) {
    const presetPrefs = preset.uiPreferences;
    let matches = true;
    
    for (const key in presetPrefs) {
      if (presetPrefs[key as keyof UIPreferences] !== preferences[key as keyof UIPreferences]) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      return id as Exclude<WorkflowPresetType, 'custom'>;
    }
  }
  
  return 'custom';
}

