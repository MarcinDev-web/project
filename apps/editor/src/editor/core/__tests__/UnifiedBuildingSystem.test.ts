/**
 * Test suite for Unified Building System
 * 
 * Tests workflow presets, UI preferences, adaptive UI,
 * and feature introduction systems.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../state';
import { Scene, Entity } from '@engine/world';
import { ScriptComponent } from '@engine/script';
import { AdaptiveUIManager } from '../../ui/AdaptiveUIManager';
import { FeatureIntroduction } from '../../ui/FeatureIntroduction';
import { persistUIPreferences, restoreUIPreferences } from '../EditorPersistence';

// WorkflowPresets feature was removed - tests removed

describe.skip('EditorState with UI Preferences', () => {
  let scene: Scene;
  let state: EditorState;

  beforeEach(() => {
    scene = new Scene('test');
    state = new EditorState(scene);
  });

  it('should initialize with default UI preferences', () => {
    expect(state.uiPreferences.value).toEqual({
      showHotbar: true,
      showInspector: true,
    });
  });

  it('should update UI preferences', () => {
    state.uiPreferences.value = {
      ...state.uiPreferences.value,
      showHotbar: false,
    };

    expect(state.uiPreferences.value.showHotbar).toBe(false);
    expect(state.uiPreferences.value.showInspector).toBe(true);
  });
});

describe.skip('AdaptiveUIManager', () => {
  let manager: AdaptiveUIManager;
  let scene: Scene;
  let state: EditorState;

  beforeEach(() => {
    manager = new AdaptiveUIManager();
    scene = new Scene('test');
    state = new EditorState(scene);
  });

  it('should track selection context', () => {
    const entity = new Entity('test');
    entity.addComponent(new ScriptComponent());

    const contextBefore = manager.getContext();
    manager.adaptToContext(entity, state);
    const contextAfter = manager.getContext();

    expect(contextAfter.selectionCount).toBeGreaterThan(contextBefore.selectionCount);
  });

  it('should increment selection count on each adapt', () => {
    const entity = new Entity('test');
    
    manager.adaptToContext(entity, state);
    const count1 = manager.getContext().selectionCount;
    
    manager.adaptToContext(entity, state);
    const count2 = manager.getContext().selectionCount;

    expect(count2).toBeGreaterThan(count1);
  });

  it('should track placement count', () => {
    expect(manager.isFirstTimePlacing()).toBe(true);

    manager.trackPlacement();
    manager.trackPlacement();
    manager.trackPlacement();

    expect(manager.isFirstTimePlacing()).toBe(false);
  });

  it('should reset suggestions', () => {
    const suggestions: unknown[] = [];
    manager.onSuggestion(s => suggestions.push(s));

    manager.suggestPanel('showHotbar', 'test', 'low');
    expect(suggestions.length).toBe(1);

    manager.reset();

    // After reset, can suggest again
    manager.suggestPanel('showHotbar', 'test', 'low');
    expect(suggestions.length).toBe(2);
  });

  it('should allow unsubscribing from suggestions', () => {
    const suggestions: unknown[] = [];
    const unsubscribe = manager.onSuggestion(s => suggestions.push(s));

    manager.suggestPanel('showHotbar', 'test', 'low');
    expect(suggestions.length).toBe(1);

    unsubscribe();

    manager.suggestPanel('showInspector', 'test', 'low');
    expect(suggestions.length).toBe(1); // Still 1, not 2
  });
});

describe.skip('FeatureIntroduction', () => {
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
    const hotbarTip = tips.find((t: unknown) => {
      const tip = t as { id?: string };
      return tip.id === 'hotbar';
    });
    expect(hotbarTip).toBeDefined();
  });

  it('should check common features with selection count', () => {
    const tips: unknown[] = [];
    intro.onTip(t => tips.push(t));

    intro.checkCommonFeatures({ selectionCount: 5 });

    // Should introduce focus camera tip
    const focusTip = tips.find((t: unknown) => {
      const tip = t as { id?: string };
      return tip.id === 'focus-camera';
    });
    expect(focusTip).toBeDefined();
  });

  it('should reset introduced features', () => {
    intro.markIntroduced('test-feature');
    expect(intro.isIntroduced('test-feature')).toBe(true);

    intro.reset();

    expect(intro.isIntroduced('test-feature')).toBe(false);
  });
});

describe.skip('UI Preferences Persistence', () => {
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
      showHotbar: false,
    };

    persistUIPreferences(state);

    const stored = localStorage.getItem('editor:uiPreferences');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.showHotbar).toBe(false);
    expect(parsed.showInspector).toBe(true);
  });

  it('should restore UI preferences', () => {
    const customPrefs = {
      showHotbar: false,
      showInspector: true,
    };

    localStorage.setItem('editor:uiPreferences', JSON.stringify(customPrefs));

    restoreUIPreferences(state);

    expect(state.uiPreferences.value.showHotbar).toBe(false);
    expect(state.uiPreferences.value.showInspector).toBe(true);
  });

  it('should handle missing preferences gracefully', () => {
    expect(() => restoreUIPreferences(state)).not.toThrow();
  });
});



