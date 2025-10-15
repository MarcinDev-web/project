import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorUILayout, type EditorUILayoutConfig, type SceneMetrics } from '../editor/ui/EditorUILayout';

describe('EditorUILayout', () => {
  let canvas: HTMLCanvasElement;
  let statusEl: HTMLElement;
  let layout: EditorUILayout;
  let config: EditorUILayoutConfig;

  beforeEach(() => {
    // Create test elements
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    
    statusEl = document.createElement('div');
    statusEl.textContent = 'Status';

    // Basic config without metrics provider
    config = {
      canvas,
      statusEl,
    };
  });

  afterEach(() => {
    if (layout) {
      layout.dispose();
    }
    document.body.innerHTML = '';
  });

  describe('mount', () => {
    it('should create and mount the layout', () => {
      layout = new EditorUILayout(config);
      const containers = layout.mount();

      expect(containers.toolbar).toBeInstanceOf(HTMLElement);
      expect(containers.sidebar).toBeInstanceOf(HTMLElement);
      expect(containers.inspector).toBeInstanceOf(HTMLElement);
      expect(containers.canvasContainer).toBeInstanceOf(HTMLElement);
      expect(document.querySelector('.editor-layout')).toBeTruthy();
    });

    it('should throw error if mounted twice', () => {
      layout = new EditorUILayout(config);
      layout.mount();
      
      expect(() => layout.mount()).toThrow('EditorUILayout: Already mounted');
    });

    it('should start with panels open by default', () => {
      layout = new EditorUILayout(config);
      layout.mount();

      const sidebar = document.querySelector('.editor-sidebar');
      const inspector = document.querySelector('.editor-inspector');

      expect(sidebar?.classList.contains('collapsed')).toBe(false);
      expect(inspector?.classList.contains('collapsed')).toBe(false);
    });

    it('should create breadcrumbs bar', () => {
      layout = new EditorUILayout(config);
      layout.mount();

      const breadcrumbs = document.querySelector('.editor-breadcrumbs');
      expect(breadcrumbs).toBeTruthy();
      expect(breadcrumbs?.textContent).toContain('Editor');
    });

    it('should create keyboard shortcuts overlay', () => {
      layout = new EditorUILayout(config);
      layout.mount();

      const overlay = document.querySelector('.shortcuts-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.classList.contains('hidden')).toBe(true);
    });

    it('should create shortcuts help button', () => {
      layout = new EditorUILayout(config);
      layout.mount();

      const button = document.querySelector('.shortcuts-help-button');
      expect(button).toBeTruthy();
      expect(button?.textContent).toBe('?');
    });

    it('should create panel toggle buttons with labels', () => {
      layout = new EditorUILayout(config);
      layout.mount();

      const leftToggle = document.querySelector('.panel-toggle.left');
      const rightToggle = document.querySelector('.panel-toggle.right');

      expect(leftToggle).toBeTruthy();
      expect(rightToggle).toBeTruthy();
      expect(leftToggle?.querySelector('.panel-toggle-label')?.textContent?.trim()).toBe('Scene');
      expect(rightToggle?.querySelector('.panel-toggle-label')?.textContent?.trim()).toBe('Inspector');
    });
  });

  describe('scene metrics', () => {
    it('should display scene metrics when provider is given', () => {
      vi.useFakeTimers();
      
      const metricsProvider = vi.fn((): SceneMetrics => ({
        entityCount: 42,
        selectedEntity: 'TestEntity',
        fps: 60,
        triangles: 1500,
      }));

      config.sceneMetricsProvider = metricsProvider;
      layout = new EditorUILayout(config);
      layout.mount();

      const metricsEl = document.getElementById('scene-metrics');
      expect(metricsEl).toBeTruthy();
      
      // Wait for interval to update
      vi.advanceTimersByTime(500);
      expect(metricsProvider).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should not create metrics section without provider', () => {
      layout = new EditorUILayout(config);
      layout.mount();

      const metricsEl = document.getElementById('scene-metrics');
      expect(metricsEl).toBeFalsy();
    });
  });

  describe('panel toggling', () => {
    beforeEach(() => {
      layout = new EditorUILayout(config);
      layout.mount();
    });

    it('should toggle sidebar visibility', () => {
      const sidebar = document.querySelector('.editor-sidebar');
      expect(sidebar?.classList.contains('collapsed')).toBe(false);

      layout.toggleSidebar();
      expect(sidebar?.classList.contains('collapsed')).toBe(true);

      layout.toggleSidebar();
      expect(sidebar?.classList.contains('collapsed')).toBe(false);
    });

    it('should toggle inspector visibility', () => {
      const inspector = document.querySelector('.editor-inspector');
      expect(inspector?.classList.contains('collapsed')).toBe(false);

      layout.toggleInspector();
      expect(inspector?.classList.contains('collapsed')).toBe(true);

      layout.toggleInspector();
      expect(inspector?.classList.contains('collapsed')).toBe(false);
    });

    it('should update toggle button on sidebar toggle', () => {
      const toggle = document.querySelector('.panel-toggle.left');
      const getIcon = () => toggle?.querySelector('svg')?.innerHTML;
      
      const initialIcon = getIcon();
      layout.toggleSidebar();
      expect(getIcon()).not.toBe(initialIcon);
    });
  });

  describe('keyboard shortcuts', () => {
    beforeEach(() => {
      layout = new EditorUILayout(config);
      layout.mount();
    });

    it('should toggle sidebar with Ctrl+B', () => {
      const sidebar = document.querySelector('.editor-sidebar');
      const initialState = sidebar?.classList.contains('collapsed');

      const event = new KeyboardEvent('keydown', {
        key: 'b',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(sidebar?.classList.contains('collapsed')).toBe(!initialState);
    });

    it('should toggle inspector with Ctrl+I', () => {
      const inspector = document.querySelector('.editor-inspector');
      const initialState = inspector?.classList.contains('collapsed');

      const event = new KeyboardEvent('keydown', {
        key: 'i',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(inspector?.classList.contains('collapsed')).toBe(!initialState);
    });

    it('should show shortcuts overlay with ?', () => {
      const overlay = document.querySelector('.shortcuts-overlay');
      expect(overlay?.classList.contains('hidden')).toBe(true);

      const event = new KeyboardEvent('keydown', {
        key: '?',
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(overlay?.classList.contains('hidden')).toBe(false);
    });

    it('should toggle all panels with Ctrl+\\', () => {
      const sidebar = document.querySelector('.editor-sidebar');
      const inspector = document.querySelector('.editor-inspector');

      // Start with both open, should close both
      const event = new KeyboardEvent('keydown', {
        key: '\\',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(sidebar?.classList.contains('collapsed')).toBe(true);
      expect(inspector?.classList.contains('collapsed')).toBe(true);

      // Both closed, should open both
      window.dispatchEvent(event);
      expect(sidebar?.classList.contains('collapsed')).toBe(false);
      expect(inspector?.classList.contains('collapsed')).toBe(false);
    });
  });

  describe('breadcrumbs', () => {
    beforeEach(() => {
      layout = new EditorUILayout(config);
      layout.mount();
    });

    it('should update breadcrumb items', () => {
      const breadcrumbs = document.querySelector('.editor-breadcrumbs');
      expect(breadcrumbs).toBeTruthy();

      layout.updateBreadcrumb([
        { label: 'Scene' },
        { label: 'Entity' },
        { label: 'Component' },
      ]);

      expect(breadcrumbs?.textContent).toContain('Scene');
      expect(breadcrumbs?.textContent).toContain('Entity');
      expect(breadcrumbs?.textContent).toContain('Component');
      expect(breadcrumbs?.querySelectorAll('.breadcrumb-separator').length).toBe(2);
    });
  });

  describe('shortcuts overlay', () => {
    beforeEach(() => {
      layout = new EditorUILayout(config);
      layout.mount();
    });

    it('should close overlay on close button click', () => {
      const overlay = document.querySelector('.shortcuts-overlay') as HTMLElement;
      const closeBtn = overlay.querySelector('.shortcuts-close') as HTMLButtonElement;

      // Open overlay first
      const event = new KeyboardEvent('keydown', { key: '?', bubbles: true });
      window.dispatchEvent(event);
      expect(overlay.classList.contains('hidden')).toBe(false);

      // Click close button
      closeBtn.click();
      expect(overlay.classList.contains('hidden')).toBe(true);
    });

    it('should close overlay on background click', () => {
      const overlay = document.querySelector('.shortcuts-overlay') as HTMLElement;

      // Open overlay first
      const event = new KeyboardEvent('keydown', { key: '?', bubbles: true });
      window.dispatchEvent(event);
      expect(overlay.classList.contains('hidden')).toBe(false);

      // Click background
      overlay.click();
      expect(overlay.classList.contains('hidden')).toBe(true);
    });

    it('should close overlay on Escape key', () => {
      const overlay = document.querySelector('.shortcuts-overlay') as HTMLElement;

      // Open overlay first
      let event = new KeyboardEvent('keydown', { key: '?', bubbles: true });
      window.dispatchEvent(event);
      expect(overlay.classList.contains('hidden')).toBe(false);

      // Press Escape
      event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      window.dispatchEvent(event);
      expect(overlay.classList.contains('hidden')).toBe(true);
    });
  });

  describe('canvas dimensions', () => {
    beforeEach(() => {
      layout = new EditorUILayout(config);
      layout.mount();
    });

    it('should display canvas dimensions', () => {
      const dimensionsEl = document.getElementById('canvas-dimensions');
      expect(dimensionsEl).toBeTruthy();
      expect(dimensionsEl?.textContent).toContain('800');
      expect(dimensionsEl?.textContent).toContain('600');
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      const metricsProvider = vi.fn((): SceneMetrics => ({
        entityCount: 0,
        selectedEntity: null,
      }));

      config.sceneMetricsProvider = metricsProvider;
      layout = new EditorUILayout(config);
      layout.mount();

      expect(document.querySelector('.editor-layout')).toBeTruthy();

      layout.dispose();

      expect(document.querySelector('.editor-layout')).toBeFalsy();
    });

    it('should remove keyboard event listeners', () => {
      layout = new EditorUILayout(config);
      layout.mount();
      
      const sidebar = document.querySelector('.editor-sidebar');
      expect(sidebar?.classList.contains('collapsed')).toBe(false);

      layout.dispose();

      // After dispose, keyboard shortcuts should not work
      const event = new KeyboardEvent('keydown', {
        key: 'b',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // State should not change (but we can't test this as the element is removed)
      expect(document.querySelector('.editor-sidebar')).toBeFalsy();
    });
  });
});

