/**
 * Test suite for Unified Building System
 * 
 * Tests workflow presets, UI preferences, adaptive UI,
 * and feature introduction systems.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from '../src/editor/core/state';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { ScriptComponent } from '@engine/world';
import { WORKFLOW_PRESETS, applyWorkflowPreset, detectWorkflowPreset, getAllWorkflowPresets } from '../src/editor/workflows/WorkflowPresets';
import { AdaptiveUIManager } from '../src/editor/ui/AdaptiveUIManager';
import { FeatureIntroduction } from '../src/editor/ui/FeatureIntroduction';
import { persistUIPreferences, restoreUIPreferences, persistWorkflowPreset, restoreWorkflowPreset } from '../src/editor/core/EditorPersistence';

describe('WorkflowPresets', () => {
  it('should have all required presets', () => {
    expect(WORKFLOW_PRESETS.creative).toBeDefined();
    expect(WORKFLOW_PRESETS.build).toBeDefined();
    expect(WORKFLOW_PRESETS.logic).toBeDefined();
    expect(WORKFLOW_PRESETS.developer).toBeDefined();
  });

  it('should have proper structure for each preset', () => {
    Object.values(WORKFLOW_PRESETS).forEach(preset => {
      expect(preset).toHaveProperty('name');
      expect(preset).toHaveProperty('description');
      expect(preset).toHaveProperty('icon');
      expect(preset).toHaveProperty('uiPreferences');
      expect(typeof preset.name).toBe('string');
      expect(typeof preset.description).toBe('string');
      expect(typeof preset.icon).toBe('string');
      expect(typeof preset.uiPreferences).toBe('object');
    });
  });

  it('should apply workflow preset to UI preferences', () => {
    const scene = new Scene('test');
    const state = new EditorState(scene);
    const currentPrefs = state.uiPreferences.value;

    const newPrefs = applyWorkflowPreset(currentPrefs, 'creative');

    expect(newPrefs.showHotbar).toBe(true);
    expect(newPrefs.showAssetCatalog).toBe(false);
  });

  it('should apply build preset correctly', () => {
    const scene = new Scene('test');
    const state = new EditorState(scene);
    const currentPrefs = state.uiPreferences.value;

    const newPrefs = applyWorkflowPreset(currentPrefs, 'build');

    expect(newPrefs.showHotbar).toBe(true);
    expect(newPrefs.showAssetCatalog).toBe(true);
    expect(newPrefs.catalogStyle).toBe('detailed');
    expect(newPrefs.catalogPosition).toBe('left');
  });

  it('should apply logic preset with logic panel visible', () => {
    const scene = new Scene('test');
    const state = new EditorState(scene);
    const currentPrefs = state.uiPreferences.value;

    const newPrefs = applyWorkflowPreset(currentPrefs, 'logic');

    expect(newPrefs.showLogicPanel).toBe(true);
    expect(newPrefs.showInspector).toBe(true);
  });

  it('should apply developer preset with all panels visible', () => {
    const scene = new Scene('test');
    const state = new EditorState(scene);
    const currentPrefs = state.uiPreferences.value;

    const newPrefs = applyWorkflowPreset(currentPrefs, 'developer');

    expect(newPrefs.showCodeEditor).toBe(true);
    expect(newPrefs.showLogicPanel).toBe(true);
    expect(newPrefs.showInspector).toBe(true);
  });

  it('should detect workflow preset from preferences', () => {
    const scene = new Scene('test');
    const state = new EditorState(scene);

    // Apply creative preset
    const creativePrefs = applyWorkflowPreset(state.uiPreferences.value, 'creative');
    expect(detectWorkflowPreset(creativePrefs)).toBe('creative');

    // Apply build preset
    const buildPrefs = applyWorkflowPreset(state.uiPreferences.value, 'build');
    expect(detectWorkflowPreset(buildPrefs)).toBe('build');
  });

  it('should detect custom preset for modified preferences', () => {
    const scene = new Scene('test');
    const state = new EditorState(scene);

    const modifiedPrefs = {
      ...state.uiPreferences.value,
      showHotbar: true,
      showAssetCatalog: true,
      showLogicPanel: true,
      showCodeEditor: true,
    };

    // This doesn't match any preset exactly
    expect(detectWorkflowPreset(modifiedPrefs)).toBe('custom');
  });

  it('should get all workflow presets', () => {
    const presets = getAllWorkflowPresets();

    expect(presets).toHaveLength(4);
    expect(presets.map(p => p.id)).toContain('creative');
    expect(presets.map(p => p.id)).toContain('build');
    expect(presets.map(p => p.id)).toContain('logic');
    expect(presets.map(p => p.id)).toContain('developer');
  });
});

describe('EditorState with UI Preferences', () => {
  let scene: Scene;
  let state: EditorState;

  beforeEach(() => {
    scene = new Scene('test');
    state = new EditorState(scene);
  });

  it('should initialize with default UI preferences', () => {
    expect(state.uiPreferences.value).toEqual({
      showHotbar: true,
      showAssetCatalog: true,
      showLogicPanel: false,
      showInspector: true,
      showCodeEditor: false,
      hotbarPosition: 'bottom',
      catalogStyle: 'compact',
    });
  });

  it('should initialize with custom workflow preset', () => {
    expect(state.workflowPreset.value).toBe('custom');
  });

  it('should update UI preferences', () => {
    state.uiPreferences.value = {
      ...state.uiPreferences.value,
      showLogicPanel: true,
    };

    expect(state.uiPreferences.value.showLogicPanel).toBe(true);
  });

  it('should update workflow preset', () => {
    state.workflowPreset.value = 'creative';

    expect(state.workflowPreset.value).toBe('creative');
  });
});

describe('AdaptiveUIManager', () => {
  let manager: AdaptiveUIManager;
  let scene: Scene;
  let state: EditorState;

  beforeEach(() => {
    manager = new AdaptiveUIManager();
    scene = new Scene('test');
    state = new EditorState(scene);
  });

  it('should suggest code editor for entity with scripts', () => {
    const entity = new Entity('test');
    entity.addComponent(new ScriptComponent());

    const suggestions: unknown[] = [];
    manager.onSuggestion(s => suggestions.push(s));

    manager.adaptToContext(entity, state);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toHaveProperty('panel', 'showCodeEditor');
  });

  it('should not suggest same panel twice', () => {
    const entity = new Entity('test');
    entity.addComponent(new ScriptComponent());

    const suggestions: unknown[] = [];
    manager.onSuggestion(s => suggestions.push(s));

    manager.adaptToContext(entity, state);
    manager.adaptToContext(entity, state);

    // Should only suggest once
    expect(suggestions.length).toBe(1);
  });

  it('should track placement count', () => {
    expect(manager.isFirstTimePlacing()).toBe(true);

    manager.trackPlacement();
    manager.trackPlacement();
    manager.trackPlacement();

    expect(manager.isFirstTimePlacing()).toBe(false);
  });

  it('should reset suggestions', () => {
    const entity = new Entity('test');
    entity.addComponent(new ScriptComponent());

    const suggestions: unknown[] = [];
    manager.onSuggestion(s => suggestions.push(s));

    manager.adaptToContext(entity, state);
    expect(suggestions.length).toBe(1);

    manager.reset();

    // After reset, should suggest again
    manager.adaptToContext(entity, state);
    expect(suggestions.length).toBe(2);
  });

  it('should allow unsubscribing from suggestions', () => {
    const entity = new Entity('test');
    entity.addComponent(new ScriptComponent());

    const suggestions: unknown[] = [];
    const unsubscribe = manager.onSuggestion(s => suggestions.push(s));

    manager.adaptToContext(entity, state);
    expect(suggestions.length).toBe(1);

    unsubscribe();

    // After unsubscribe, should not receive suggestions
    manager.reset();
    manager.adaptToContext(entity, state);
    expect(suggestions.length).toBe(1); // Still 1, not 2
  });
});

describe('FeatureIntroduction', () => {
  let intro: FeatureIntroduction;

  beforeEach(() => {
    intro = new FeatureIntroduction();
    intro.reset(); // Clear any persisted state
  });

  it('should introduce feature when condition is met', () => {
    const tips: unknown[] = [];
    intro.onTip(t => tips.push(t));

    intro.introduceWhenRelevant(
      'test-feature',
      () => true,
      { message: 'Test tip', dismissable: true }
    );

    expect(tips.length).toBe(1);
    expect(tips[0]).toHaveProperty('message', 'Test tip');
  });

  it('should not introduce feature when condition is not met', () => {
    const tips: unknown[] = [];
    intro.onTip(t => tips.push(t));

    intro.introduceWhenRelevant(
      'test-feature',
      () => false,
      { message: 'Test tip', dismissable: true }
    );

    expect(tips.length).toBe(0);
  });

  it('should not introduce same feature twice', () => {
    const tips: unknown[] = [];
    intro.onTip(t => tips.push(t));

    intro.introduceWhenRelevant(
      'test-feature',
      () => true,
      { message: 'Test tip', dismissable: true }
    );

    intro.introduceWhenRelevant(
      'test-feature',
      () => true,
      { message: 'Test tip', dismissable: true }
    );

    expect(tips.length).toBe(1);
  });

  it('should check if feature is introduced', () => {
    expect(intro.isIntroduced('test-feature')).toBe(false);

    intro.markIntroduced('test-feature');

    expect(intro.isIntroduced('test-feature')).toBe(true);
  });

  it('should check common features with placement count', () => {
    const tips: unknown[] = [];
    intro.onTip(t => tips.push(t));

    intro.checkCommonFeatures({ placementCount: 10 });

    // Should introduce hotbar tip
    expect(tips.length).toBeGreaterThan(0);
    const hotbarTip = tips.find((t: any) => t.id === 'hotbar');
    expect(hotbarTip).toBeDefined();
  });

  it('should check common features with selection count', () => {
    const tips: unknown[] = [];
    intro.onTip(t => tips.push(t));

    intro.checkCommonFeatures({ selectionCount: 5 });

    // Should introduce focus camera tip
    const focusTip = tips.find((t: any) => t.id === 'focus-camera');
    expect(focusTip).toBeDefined();
  });

  it('should reset introduced features', () => {
    intro.markIntroduced('test-feature');
    expect(intro.isIntroduced('test-feature')).toBe(true);

    intro.reset();

    expect(intro.isIntroduced('test-feature')).toBe(false);
  });
});

describe('UI Preferences Persistence', () => {
  let scene: Scene;
  let state: EditorState;

  beforeEach(() => {
    scene = new Scene('test');
    state = new EditorState(scene);
    localStorage.clear();
  });

  it('should persist UI preferences', () => {
    state.uiPreferences.value = {
      ...state.uiPreferences.value,
      showLogicPanel: true,
      showCodeEditor: true,
    };

    persistUIPreferences(state);

    const stored = localStorage.getItem('editor:uiPreferences');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.showLogicPanel).toBe(true);
    expect(parsed.showCodeEditor).toBe(true);
  });

  it('should restore UI preferences', () => {
    const customPrefs = {
      showHotbar: false,
      showAssetCatalog: false,
      showLogicPanel: true,
      showInspector: true,
      showCodeEditor: true,
      hotbarPosition: 'side' as const,
      catalogStyle: 'detailed' as const,
    };

    localStorage.setItem('editor:uiPreferences', JSON.stringify(customPrefs));

    restoreUIPreferences(state);

    expect(state.uiPreferences.value.showLogicPanel).toBe(true);
    expect(state.uiPreferences.value.showCodeEditor).toBe(true);
    expect(state.uiPreferences.value.hotbarPosition).toBe('side');
  });

  it('should persist workflow preset', () => {
    state.workflowPreset.value = 'developer';

    persistWorkflowPreset(state);

    const stored = localStorage.getItem('editor:workflowPreset');
    expect(stored).toBe('"developer"');
  });

  it('should restore workflow preset', () => {
    localStorage.setItem('editor:workflowPreset', JSON.stringify('creative'));

    restoreWorkflowPreset(state);

    expect(state.workflowPreset.value).toBe('creative');
  });

  it('should handle missing preferences gracefully', () => {
    expect(() => restoreUIPreferences(state)).not.toThrow();
    expect(() => restoreWorkflowPreset(state)).not.toThrow();
  });
});

