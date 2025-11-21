/**
 * QuickMenu tests - Camera selection functionality
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuickMenu } from '../features/QuickMenu';
import { EditorState } from '../../core/state';
import { Scene } from '@engine/world';
import { initBrowserPolyfills } from '../../../test/setup';

describe('QuickMenu', () => {
  let state: EditorState;
  let mockProjectManager: any;
  let mockCallbacks: any;
  let quickMenu: QuickMenu;

  beforeEach(() => {
    initBrowserPolyfills(); // Ensure DOM polyfills are initialized
    // Create test scene and state
    const scene = new Scene('Test Scene');
    state = new EditorState(scene);

    mockProjectManager = {
      newProject: vi.fn(),
      showLoadDialog: vi.fn(),
      saveProject: vi.fn(),
      saveProjectAs: vi.fn(),
    };

    mockCallbacks = {
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      canUndo: vi.fn(() => false),
      canRedo: vi.fn(() => false),
      toggleSnap: vi.fn(),
      toggleGrid: vi.fn(),
      onGizmoModeChange: vi.fn(),
      onRotationSnapChange: vi.fn(),
      onCameraChange: vi.fn(),
    };

    quickMenu = new QuickMenu({
      state,
      projectManager: mockProjectManager,
      ...mockCallbacks,
    });
  });

  afterEach(() => {
    quickMenu.dispose();
  });

  describe('Camera Menu', () => {
    it('should mount successfully with Camera menu', () => {
      quickMenu.mount();
      
      const cameraMenuButton = document.querySelector('.top-bar-menu-button') as HTMLElement;
      expect(cameraMenuButton).toBeTruthy();
      
      // Find Camera menu specifically
      const menuButtons = Array.from(document.querySelectorAll('.top-bar-menu-button'));
      const cameraButton = menuButtons.find(btn => btn.textContent === 'Camera') as HTMLElement;
      expect(cameraButton).toBeTruthy();
    });

    it('should show Camera dropdown on click', () => {
      quickMenu.mount();
      
      // Find Camera menu button
      const menuButtons = Array.from(document.querySelectorAll('.top-bar-menu-button'));
      const cameraButton = menuButtons.find(btn => btn.textContent === 'Camera') as HTMLElement;
      
      // Click to open dropdown
      cameraButton.click();
      
      // Check if dropdown is visible
      const activeMenu = document.querySelector('.top-bar-menu-item.active');
      expect(activeMenu).toBeTruthy();
    });

    it('should have only Free-Fly Camera option (FPS and Third Person are for play mode)', () => {
      quickMenu.mount();
      
      // Open Camera menu
      const menuButtons = Array.from(document.querySelectorAll('.top-bar-menu-button'));
      const cameraButton = menuButtons.find(btn => btn.textContent === 'Camera') as HTMLElement;
      cameraButton.click();
      
      // Find Free-Fly option
      const dropdownItems = Array.from(document.querySelectorAll('.top-bar-dropdown-item'));
      const freeFlyItem = dropdownItems.find(item => item.textContent?.includes('Free-Fly'));
      expect(freeFlyItem).toBeTruthy();
      
      // First Person and Third Person should NOT be present in editor menu
      const fpsItem = dropdownItems.find(item => item.textContent?.includes('First Person'));
      const thirdPersonItem = dropdownItems.find(item => item.textContent?.includes('Third Person'));
      expect(fpsItem).toBeFalsy();
      expect(thirdPersonItem).toBeFalsy();
    });

    it('should call onCameraChange with "free-fly" when Free-Fly is clicked', () => {
      quickMenu.mount();
      
      // Open Camera menu
      const menuButtons = Array.from(document.querySelectorAll('.top-bar-menu-button'));
      const cameraButton = menuButtons.find(btn => btn.textContent === 'Camera') as HTMLElement;
      cameraButton.click();
      
      // Click Free-Fly
      const dropdownItems = Array.from(document.querySelectorAll('.top-bar-dropdown-item'));
      const freeFlyItem = dropdownItems.find(item => item.textContent?.includes('Free-Fly')) as HTMLElement;
      freeFlyItem.click();
      
      expect(mockCallbacks.onCameraChange).toHaveBeenCalledWith('free-fly');
    });

    it('should close menu after selecting camera option', () => {
      quickMenu.mount();
      
      // Open Camera menu
      const menuButtons = Array.from(document.querySelectorAll('.top-bar-menu-button'));
      const cameraButton = menuButtons.find(btn => btn.textContent === 'Camera') as HTMLElement;
      cameraButton.click();
      
      // Verify menu is open
      let activeMenu = document.querySelector('.top-bar-menu-item.active');
      expect(activeMenu).toBeTruthy();
      
      // Click Free-Fly
      const dropdownItems = Array.from(document.querySelectorAll('.top-bar-dropdown-item'));
      const freeFlyItem = dropdownItems.find(item => item.textContent?.includes('Free-Fly')) as HTMLElement;
      freeFlyItem.click();
      
      // Verify menu is closed
      activeMenu = document.querySelector('.top-bar-menu-item.active');
      expect(activeMenu).toBeFalsy();
    });

    it('should work without onCameraChange callback', () => {
      const menuWithoutCallback = new QuickMenu({
        state,
        projectManager: mockProjectManager,
        onUndo: mockCallbacks.onUndo,
        onRedo: mockCallbacks.onRedo,
        canUndo: mockCallbacks.canUndo,
        canRedo: mockCallbacks.canRedo,
        toggleSnap: mockCallbacks.toggleSnap,
        toggleGrid: mockCallbacks.toggleGrid,
        onGizmoModeChange: mockCallbacks.onGizmoModeChange,
        onRotationSnapChange: mockCallbacks.onRotationSnapChange,
        // No onCameraChange
      });

      menuWithoutCallback.mount();
      
      // Open Camera menu
      const menuButtons = Array.from(document.querySelectorAll('.top-bar-menu-button'));
      const cameraButton = menuButtons.find(btn => btn.textContent === 'Camera') as HTMLElement;
      cameraButton.click();
      
      // Click Free-Fly - should not throw
      const dropdownItems = Array.from(document.querySelectorAll('.top-bar-dropdown-item'));
      const freeFlyItem = dropdownItems.find(item => item.textContent?.includes('Free-Fly')) as HTMLElement;
      
      expect(() => freeFlyItem.click()).not.toThrow();
      
      menuWithoutCallback.dispose();
    });
  });

  describe('Camera menu position', () => {
    it('should have Camera menu between View and Help', () => {
      quickMenu.mount();
      
      const menuButtons = Array.from(document.querySelectorAll('.top-bar-menu-button'));
      const menuTexts = menuButtons.map(btn => btn.textContent);
      
      const viewIndex = menuTexts.indexOf('View');
      const cameraIndex = menuTexts.indexOf('Camera');
      const helpIndex = menuTexts.indexOf('Help');
      
      expect(cameraIndex).toBeGreaterThan(viewIndex);
      expect(cameraIndex).toBeLessThan(helpIndex);
    });
  });
});

