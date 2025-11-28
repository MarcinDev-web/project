/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LayersPanel } from './LayersPanel';
import { Scene } from '@engine/world';
import * as storage from '../../../utils/storage';

vi.mock('../../../utils/storage', () => ({
  storageSave: vi.fn(),
  storageLoad: vi.fn(),
}));

function createHost(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('LayersPanel', () => {
  let scene: Scene;
  let host: HTMLElement;

  beforeEach(() => {
    scene = new Scene('Scene');
    host = createHost();

    // Reset storage mock
    vi.mocked(storage.storageLoad).mockReturnValue(null);
    vi.mocked(storage.storageSave).mockClear();

    // Mock prompt and confirm
    vi.spyOn(window, 'prompt').mockImplementation(() => null);
    vi.spyOn(window, 'confirm').mockImplementation(() => false);
  });

  afterEach(() => {
    host.remove();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create panel and mount to host', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      expect(host.querySelector('.layers-panel')).toBeTruthy();
    });

    it('should create default layer when no layers exist', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const layers = panel.getLayers();
      expect(layers.length).toBe(1);
      expect(layers[0]?.name).toBe('Default');
    });

    it('should load layers from storage on initialization', () => {
      const mockData = {
        layers: [
          {
            id: 'layer_1',
            name: 'Background',
            visible: true,
            locked: false,
            color: '#3b82f6',
            entityIds: ['entity1', 'entity2'],
          },
        ],
        activeLayerId: 'layer_1',
      };

      vi.mocked(storage.storageLoad).mockReturnValue(mockData);

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      expect(storage.storageLoad).toHaveBeenCalledWith('layers');
      
      const layers = panel.getLayers();
      expect(layers.length).toBe(1);
      expect(layers[0]?.name).toBe('Background');
    });

    it('should display panel title', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const title = host.querySelector('.panel-title');
      expect(title?.textContent).toBe('Layers');
    });

    it('should have add layer button', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button');
      expect(addBtn).toBeTruthy();
      expect(addBtn?.getAttribute('title')).toBe('Add layer');
    });
  });

  describe('adding layers', () => {
    it('should add new layer with default name', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      // Clear the default layer first
      const initialLayers = panel.getLayers().length;

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const layers = panel.getLayers();
      expect(layers.length).toBe(initialLayers + 1);
    });

    it('should increment layer names automatically', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const layers = panel.getLayers();
      const newLayer = layers[layers.length - 1];
      expect(newLayer?.name).toContain('Layer');
    });

    it('should assign random color to new layer', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const layers = panel.getLayers();
      const newLayer = layers[layers.length - 1];
      expect(newLayer?.color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should set new layer as visible and unlocked by default', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const layers = panel.getLayers();
      const newLayer = layers[layers.length - 1];
      expect(newLayer?.visible).toBe(true);
      expect(newLayer?.locked).toBe(false);
    });

    it('should call onLayerChanged callback when layer added', () => {
      const onLayerChanged = vi.fn();
      const panel = new LayersPanel({ scene, onLayerChanged });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      expect(onLayerChanged).toHaveBeenCalled();
    });

    it('should save layers to storage when added', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      vi.mocked(storage.storageSave).mockClear();

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      expect(storage.storageSave).toHaveBeenCalledWith(
        'layers',
        expect.objectContaining({
          layers: expect.any(Array),
          activeLayerId: expect.any(String),
        })
      );
    });
  });

  describe('displaying layers', () => {
    it('should display layer items', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const layerItems = host.querySelectorAll('.layer-item');
      expect(layerItems.length).toBeGreaterThan(0);
    });

    it('should show layer name', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const name = host.querySelector('.layer-name');
      expect(name).toBeTruthy();
      expect(name?.textContent).toBeTruthy();
    });

    it('should show color indicator', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const colorIndicator = host.querySelector('.layer-color');
      expect(colorIndicator).toBeTruthy();
      expect((colorIndicator as HTMLElement).style.backgroundColor).toBeTruthy();
    });

    it('should show entity count badge', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const badge = host.querySelector('.layer-badge');
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toBe('0');
    });

    it('should highlight active layer', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const activeLayer = panel.getActiveLayer();
      expect(activeLayer).toBeTruthy();

      const activeItem = host.querySelector('.layer-item.active');
      expect(activeItem).toBeTruthy();
    });

    it('should show visibility button with correct icon', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const visBtn = host.querySelector('.layer-controls button');
      expect(visBtn).toBeTruthy();
      expect(visBtn?.getAttribute('title')).toContain('Hide');
    });

    it('should show lock button', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const controls = host.querySelector('.layer-controls');
      const buttons = controls?.querySelectorAll('button');
      
      // Should have visibility, lock, and delete buttons
      expect(buttons && buttons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('selecting layers', () => {
    it('should set active layer when clicked', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const layers = panel.getLayers();
      const layerItems = host.querySelectorAll('.layer-name');
      
      if (layerItems.length > 1) {
        (layerItems[1] as HTMLButtonElement).click();

        const activeLayer = panel.getActiveLayer();
        expect(activeLayer?.id).toBe(layers[1]?.id);
      }
    });

    it('should update UI when active layer changes', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const layerItems = host.querySelectorAll('.layer-name');
      if (layerItems.length > 1) {
        (layerItems[1] as HTMLButtonElement).click();

        const activeItems = host.querySelectorAll('.layer-item.active');
        expect(activeItems.length).toBe(1);
      }
    });
  });

  describe('renaming layers', () => {
    it('should rename layer on double click with prompt', () => {
      vi.mocked(window.prompt).mockReturnValue('New Name');

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const nameBtn = host.querySelector('.layer-name') as HTMLButtonElement;
      nameBtn.dispatchEvent(new MouseEvent('dblclick'));

      const layers = panel.getLayers();
      expect(layers[0]?.name).toBe('New Name');
    });

    it('should not rename if prompt cancelled', () => {
      vi.mocked(window.prompt).mockReturnValue(null);

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const originalName = panel.getLayers()[0]?.name;

      const nameBtn = host.querySelector('.layer-name') as HTMLButtonElement;
      nameBtn.dispatchEvent(new MouseEvent('dblclick'));

      const layers = panel.getLayers();
      expect(layers[0]?.name).toBe(originalName);
    });

    it('should not rename if empty name provided', () => {
      vi.mocked(window.prompt).mockReturnValue('   ');

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const originalName = panel.getLayers()[0]?.name;

      const nameBtn = host.querySelector('.layer-name') as HTMLButtonElement;
      nameBtn.dispatchEvent(new MouseEvent('dblclick'));

      const layers = panel.getLayers();
      expect(layers[0]?.name).toBe(originalName);
    });

    it('should trim whitespace from new name', () => {
      vi.mocked(window.prompt).mockReturnValue('  Trimmed Name  ');

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const nameBtn = host.querySelector('.layer-name') as HTMLButtonElement;
      nameBtn.dispatchEvent(new MouseEvent('dblclick'));

      const layers = panel.getLayers();
      expect(layers[0]?.name).toBe('Trimmed Name');
    });
  });

  describe('visibility toggle', () => {
    it('should toggle layer visibility', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const layer = panel.getLayers()[0];
      const initialVisibility = layer?.visible;

      const visBtn = host.querySelector('.layer-controls button') as HTMLButtonElement;
      visBtn.click();

      const updatedLayer = panel.getLayers()[0];
      expect(updatedLayer?.visible).toBe(!initialVisibility);
    });

    it('should update icon when visibility toggled', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const initialVisBtn = host.querySelector('.layer-controls button') as HTMLButtonElement;
      const initialTitle = initialVisBtn.getAttribute('title');
      
      initialVisBtn.click();

      // Query for the button again after render
      const updatedVisBtn = host.querySelector('.layer-controls button') as HTMLButtonElement;
      const updatedTitle = updatedVisBtn.getAttribute('title');
      expect(updatedTitle).not.toBe(initialTitle);
    });

    it('should call onLayerChanged when visibility toggled', () => {
      const onLayerChanged = vi.fn();
      const panel = new LayersPanel({ scene, onLayerChanged });
      panel.mount(host);

      const visBtn = host.querySelector('.layer-controls button') as HTMLButtonElement;
      visBtn.click();

      expect(onLayerChanged).toHaveBeenCalled();
    });

    it('should not propagate click event', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const layerItem = host.querySelector('.layer-item');
      const clickSpy = vi.fn();
      layerItem?.addEventListener('click', clickSpy);

      const visBtn = host.querySelector('.layer-controls button') as HTMLButtonElement;
      visBtn.click();

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('lock toggle', () => {
    it('should toggle layer lock', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const layer = panel.getLayers()[0];
      const initialLock = layer?.locked;

      const controls = host.querySelector('.layer-controls');
      const lockBtn = controls?.querySelectorAll('button')[1] as HTMLButtonElement;
      lockBtn.click();

      const updatedLayer = panel.getLayers()[0];
      expect(updatedLayer?.locked).toBe(!initialLock);
    });

    it('should update icon when lock toggled', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const initialControls = host.querySelector('.layer-controls');
      const initialLockBtn = initialControls?.querySelectorAll('button')[1] as HTMLButtonElement;
      const initialTitle = initialLockBtn.getAttribute('title');
      
      initialLockBtn.click();

      // Query for the button again after render
      const updatedControls = host.querySelector('.layer-controls');
      const updatedLockBtn = updatedControls?.querySelectorAll('button')[1] as HTMLButtonElement;
      const updatedTitle = updatedLockBtn.getAttribute('title');
      expect(updatedTitle).not.toBe(initialTitle);
    });

    it('should call onLayerChanged when lock toggled', () => {
      const onLayerChanged = vi.fn();
      const panel = new LayersPanel({ scene, onLayerChanged });
      panel.mount(host);

      const controls = host.querySelector('.layer-controls');
      const lockBtn = controls?.querySelectorAll('button')[1] as HTMLButtonElement;
      lockBtn.click();

      expect(onLayerChanged).toHaveBeenCalled();
    });
  });

  describe('deleting layers', () => {
    it('should show delete button when multiple layers exist', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const controls = host.querySelectorAll('.layer-controls');
      const deleteBtn = controls[0]?.querySelector('button:last-child');
      expect(deleteBtn).toBeTruthy();
      expect(deleteBtn?.getAttribute('title')).toBe('Delete layer');
    });

    it('should not show delete button when only one layer exists', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const controls = host.querySelector('.layer-controls');
      const buttons = controls?.querySelectorAll('button');
      
      // Should only have visibility and lock buttons, not delete
      expect(buttons?.length).toBe(2);
    });

    it('should delete layer when confirmed', () => {
      vi.mocked(window.confirm).mockReturnValue(true);

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const initialCount = panel.getLayers().length;

      const controls = host.querySelectorAll('.layer-controls');
      const deleteBtn = controls[0]?.querySelector('button:last-child') as HTMLButtonElement;
      deleteBtn.click();

      expect(panel.getLayers().length).toBe(initialCount - 1);
    });

    it('should not delete layer when not confirmed', () => {
      vi.mocked(window.confirm).mockReturnValue(false);

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const initialCount = panel.getLayers().length;

      const controls = host.querySelectorAll('.layer-controls');
      const deleteBtn = controls[0]?.querySelector('button:last-child') as HTMLButtonElement;
      deleteBtn.click();

      expect(panel.getLayers().length).toBe(initialCount);
    });

    it('should call onLayerChanged when layer deleted', () => {
      vi.mocked(window.confirm).mockReturnValue(true);

      const onLayerChanged = vi.fn();
      const panel = new LayersPanel({ scene, onLayerChanged });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      vi.mocked(onLayerChanged).mockClear();

      const controls = host.querySelectorAll('.layer-controls');
      const deleteBtn = controls[0]?.querySelector('button:last-child') as HTMLButtonElement;
      deleteBtn.click();

      expect(onLayerChanged).toHaveBeenCalled();
    });

    it('should update active layer if deleted layer was active', () => {
      vi.mocked(window.confirm).mockReturnValue(true);

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const activeLayerId = panel.getActiveLayer()?.id;

      const controls = host.querySelectorAll('.layer-controls');
      const deleteBtn = controls[0]?.querySelector('button:last-child') as HTMLButtonElement;
      deleteBtn.click();

      const newActiveLayerId = panel.getActiveLayer()?.id;
      expect(newActiveLayerId).not.toBe(activeLayerId);
    });

    it('should not allow deleting the last layer', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      // Should have exactly one layer (default)
      expect(panel.getLayers().length).toBe(1);

      const controls = host.querySelector('.layer-controls');
      const buttons = controls?.querySelectorAll('button');
      
      // Should not have delete button for last layer
      expect(buttons?.length).toBe(2); // Only visibility and lock
    });
  });

  describe('storage persistence', () => {
    it('should save when layer added', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      vi.mocked(storage.storageSave).mockClear();

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      expect(storage.storageSave).toHaveBeenCalledWith('layers', expect.any(Object));
    });

    it('should save when visibility changed', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      vi.mocked(storage.storageSave).mockClear();

      const visBtn = host.querySelector('.layer-controls button') as HTMLButtonElement;
      visBtn.click();

      expect(storage.storageSave).toHaveBeenCalled();
    });

    it('should save when lock changed', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      vi.mocked(storage.storageSave).mockClear();

      const controls = host.querySelector('.layer-controls');
      const lockBtn = controls?.querySelectorAll('button')[1] as HTMLButtonElement;
      lockBtn.click();

      expect(storage.storageSave).toHaveBeenCalled();
    });

    it('should serialize entityIds as array', () => {
      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const addBtn = host.querySelector('.layers-panel-header button') as HTMLButtonElement;
      addBtn.click();

      const saveCall = vi.mocked(storage.storageSave).mock.calls[vi.mocked(storage.storageSave).mock.calls.length - 1];
      const savedData = saveCall?.[1] as any;
      
      expect(savedData.layers[0]?.entityIds).toBeInstanceOf(Array);
    });
  });

  describe('edge cases', () => {
    it('should handle null storage data', () => {
      vi.mocked(storage.storageLoad).mockReturnValue(null);

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      // Should create default layer
      expect(panel.getLayers().length).toBe(1);
    });

    it('should handle empty layers array in storage', () => {
      vi.mocked(storage.storageLoad).mockReturnValue({ layers: [], activeLayerId: null });

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      // Should create default layer
      expect(panel.getLayers().length).toBe(1);
    });

    it('should handle invalid activeLayerId in storage', () => {
      const mockData = {
        layers: [
          {
            id: 'layer_1',
            name: 'Layer 1',
            visible: true,
            locked: false,
            color: '#3b82f6',
            entityIds: [],
          },
        ],
        activeLayerId: 'nonexistent',
      };

      vi.mocked(storage.storageLoad).mockReturnValue(mockData);

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      // Should still work
      expect(panel.getLayers().length).toBe(1);
    });

    it('should handle corrupted entityIds in storage', () => {
      const mockData = {
        layers: [
          {
            id: 'layer_1',
            name: 'Layer 1',
            visible: true,
            locked: false,
            color: '#3b82f6',
            entityIds: null as any,
          },
        ],
        activeLayerId: 'layer_1',
      };

      vi.mocked(storage.storageLoad).mockReturnValue(mockData);

      const panel = new LayersPanel({ scene });
      panel.mount(host);

      const layers = panel.getLayers();
      expect(layers[0]?.entityIds).toBeInstanceOf(Set);
    });
  });
});

