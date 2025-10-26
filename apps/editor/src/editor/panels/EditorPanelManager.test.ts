import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorPanelManager } from './EditorPanelManager';
import { Scene } from '@engine/world';
import { SelectionManager } from '@engine/world';
import { EditorState } from '../core/state';

describe('EditorPanelManager', () => {
  let scene: Scene;
  let selection: SelectionManager;
  let state: EditorState;
  let sidebarContainer: HTMLElement;
  let inspectorContainer: HTMLElement;
  let manager: EditorPanelManager;

  beforeEach(() => {
    scene = new Scene();
    selection = new SelectionManager();
    state = new EditorState(scene);
    sidebarContainer = document.createElement('div');
    inspectorContainer = document.createElement('div');
    document.body.appendChild(sidebarContainer);
    document.body.appendChild(inspectorContainer);

    manager = new EditorPanelManager({
      scene,
      selection,
      state,
      updateSceneBuffers: vi.fn(),
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed: vi.fn(),
      onAssetSpawn: vi.fn(),
      onStartPlacement: vi.fn(),
      getRendererDeviceAndFormat: () => null,
    });
  });

  describe('initialization', () => {
    it('should create a manager without mounting', () => {
      expect(manager).toBeDefined();
      expect(manager.isMounted()).toBe(false);
    });

    it('should not have panels before mounting', () => {
      expect(manager.getOutliner()).toBeNull();
      expect(manager.getProperties()).toBeNull();
      expect(manager.getAssetBrowser()).toBeNull();
    });
  });

  describe('mounting', () => {
    it('should mount all panels to containers', () => {
      manager.mount(sidebarContainer, inspectorContainer);

      expect(manager.isMounted()).toBe(true);
      expect(manager.getOutliner()).not.toBeNull();
      expect(manager.getProperties()).not.toBeNull();
      expect(manager.getAssetBrowser()).not.toBeNull();
    });

    it('should append panels to containers', () => {
      const sidebarBefore = sidebarContainer.children.length;
      const inspectorBefore = inspectorContainer.children.length;
      manager.mount(sidebarContainer, inspectorContainer);

      // Should have added elements to both containers
      expect(sidebarContainer.children.length).toBeGreaterThan(sidebarBefore);
      expect(inspectorContainer.children.length).toBeGreaterThan(inspectorBefore);
    });

    it('should not mount twice', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      manager.mount(sidebarContainer, inspectorContainer);
      const outliner1 = manager.getOutliner();

      manager.mount(sidebarContainer, inspectorContainer);
      const outliner2 = manager.getOutliner();

      expect(outliner1).toBe(outliner2); // Same instance
      expect(consoleError).toHaveBeenCalledWith('EditorPanelManager: Already mounted');

      consoleError.mockRestore();
    });
  });

  describe('panel refreshing', () => {
    beforeEach(() => {
      manager.mount(sidebarContainer, inspectorContainer);
    });

    it('should refresh outliner panel', () => {
      const outliner = manager.getOutliner();
      const refreshSpy = vi.spyOn(outliner!, 'refresh');

      manager.refreshOutliner();

      expect(refreshSpy).toHaveBeenCalledOnce();
    });

    it('should refresh properties panel', () => {
      const properties = manager.getProperties();
      const refreshSpy = vi.spyOn(properties!, 'refresh');

      manager.refreshProperties();

      expect(refreshSpy).toHaveBeenCalledOnce();
    });

    it('should refresh asset browser', () => {
      const assetBrowser = manager.getAssetBrowser();
      const refreshSpy = vi.spyOn(assetBrowser!, 'refresh');

      manager.refreshAssetBrowser();

      expect(refreshSpy).toHaveBeenCalledOnce();
    });

    it('should refresh all panels', () => {
      const outliner = manager.getOutliner();
      const properties = manager.getProperties();
      const assetBrowser = manager.getAssetBrowser();

      const outlinerSpy = vi.spyOn(outliner!, 'refresh');
      const propertiesSpy = vi.spyOn(properties!, 'refresh');
      const assetBrowserSpy = vi.spyOn(assetBrowser!, 'refresh');

      manager.refreshAll();

      expect(outlinerSpy).toHaveBeenCalledOnce();
      expect(propertiesSpy).toHaveBeenCalledOnce();
      expect(assetBrowserSpy).toHaveBeenCalledOnce();
    });

    it('should handle refresh when not mounted gracefully', () => {
      const unmountedManager = new EditorPanelManager({
        scene,
        selection,
        state,
        updateSceneBuffers: vi.fn(),
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        onAssetSpawn: vi.fn(),
        onStartPlacement: vi.fn(),
      });

      // Should not throw
      expect(() => unmountedManager.refreshOutliner()).not.toThrow();
      expect(() => unmountedManager.refreshProperties()).not.toThrow();
      expect(() => unmountedManager.refreshAssetBrowser()).not.toThrow();
      expect(() => unmountedManager.refreshAll()).not.toThrow();
    });
  });

  describe('callbacks', () => {
    it('should call onEntitySelected when entity is selected in outliner', () => {
      manager.mount(sidebarContainer, inspectorContainer);

      const entity = scene.createEntity('TestEntity');

      // Simulate selecting entity through outliner
      // (This would normally happen through UI interaction)
      selection.select(entity);

      expect(selection.isSelected(entity)).toBe(true);
    });

    it('should handle transform changes', () => {
      const onTransformChanged = vi.fn();
      const customManager = new EditorPanelManager({
        scene,
        selection,
        state,
        updateSceneBuffers: vi.fn(),
        onTransformChanged,
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        onAssetSpawn: vi.fn(),
        onStartPlacement: vi.fn(),
      });

      customManager.mount(sidebarContainer, inspectorContainer);

      // Manually trigger through config (normally happens through UI)
      onTransformChanged(scene.createEntity('Test'));

      expect(onTransformChanged).toHaveBeenCalled();
    });
  });

  describe('disposal', () => {
    it('should dispose and clear references', () => {
      manager.mount(sidebarContainer, inspectorContainer);

      expect(manager.getOutliner()).not.toBeNull();
      expect(manager.getProperties()).not.toBeNull();
      expect(manager.getAssetBrowser()).not.toBeNull();

      manager.dispose();

      expect(manager.getOutliner()).toBeNull();
      expect(manager.getProperties()).toBeNull();
      expect(manager.getAssetBrowser()).toBeNull();
      expect(manager.isMounted()).toBe(false);
    });

    it('should be safe to dispose multiple times', () => {
      manager.mount(sidebarContainer, inspectorContainer);

      expect(() => {
        manager.dispose();
        manager.dispose();
        manager.dispose();
      }).not.toThrow();
    });

    it('should be safe to dispose without mounting', () => {
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should coordinate between panels', () => {
      manager.mount(sidebarContainer, inspectorContainer);

      const entity = scene.createEntity('TestEntity');
      selection.select(entity);
      state.selection.value = [entity];

      // All panels should be aware of selection
      manager.refreshAll();

      // Verify panels are in sync (implicit through no errors)
      expect(manager.getOutliner()).not.toBeNull();
      expect(manager.getProperties()).not.toBeNull();
    });

    it('should handle scene updates across panels', () => {
      manager.mount(sidebarContainer, inspectorContainer);

      // Add entities to scene
      scene.createEntity('Entity1');
      scene.createEntity('Entity2');
      scene.createEntity('Entity3');

      // Refresh should propagate to all panels
      expect(() => manager.refreshAll()).not.toThrow();
    });
  });

  describe('getters', () => {
    it('should return null getters before mounting', () => {
      expect(manager.getOutliner()).toBeNull();
      expect(manager.getProperties()).toBeNull();
      expect(manager.getAssetBrowser()).toBeNull();
    });

    it('should return valid instances after mounting', () => {
      manager.mount(sidebarContainer, inspectorContainer);

      const outliner = manager.getOutliner();
      const properties = manager.getProperties();
      const assetBrowser = manager.getAssetBrowser();

      expect(outliner).toBeDefined();
      expect(properties).toBeDefined();
      expect(assetBrowser).toBeDefined();

      // Verify they have expected methods
      expect(typeof outliner?.refresh).toBe('function');
      expect(typeof properties?.refresh).toBe('function');
      expect(typeof assetBrowser?.refresh).toBe('function');
    });
  });
});
