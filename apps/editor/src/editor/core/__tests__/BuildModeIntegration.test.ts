/**
 * Build Mode Integration Tests
 * Tests the complete unified build mode workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '@engine/world';
import { EditorState } from '../state';

describe('Build Mode Integration', () => {
  let scene: Scene;
  let state: EditorState;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    state = new EditorState(scene);
  });

  describe('UI Preferences', () => {
    it('should have default UI preferences', () => {
      const prefs = state.uiPreferences.value;
      expect(prefs).toBeDefined();
      expect(prefs.showHotbar).toBe(true);
      expect(prefs.showInspector).toBe(true);
    });

    it('should allow updating UI preferences', () => {
      state.uiPreferences.value = {
        showHotbar: false,
        showInspector: true,
      };

      expect(state.uiPreferences.value.showHotbar).toBe(false);
      expect(state.uiPreferences.value.showInspector).toBe(true);
    });
  });
});


