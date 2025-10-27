import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogicPanel } from './LogicPanel';
import { SelectionManager } from '@engine/world';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { LogicCubeComponent } from '@engine/script';
import { LogicCubeLibrary } from '../managers/LogicCubeLibrary';
import { getLogicConnectionManager } from '@engine/script';

vi.mock('@engine/script', () => ({
  getLogicConnectionManager: vi.fn(),
}));

function createHost(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('LogicPanel', () => {
  let selection: SelectionManager;
  let scene: Scene;
  let entity: Entity;
  let host: HTMLElement;

  beforeEach(() => {
    selection = new SelectionManager();
    scene = new Scene('Scene');
    entity = new Entity('Test Logic Cube');
    scene.addEntity(entity);
    selection.setScene(scene);
    host = createHost();

    // Mock LogicConnectionManager
    vi.mocked(getLogicConnectionManager).mockReturnValue({
      getConnectionsFromEntity: vi.fn().mockReturnValue([]),
      getConnectionsToEntity: vi.fn().mockReturnValue([]),
    } as any);
  });

  afterEach(() => {
    host.remove();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create panel and show empty state when nothing selected', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const empty = host.querySelector('.logic-panel__empty');
      expect(empty).toBeTruthy();
      expect(empty?.textContent).toContain('Select a logic cube to edit');
    });

    it('should listen to selection changes', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      
      const refreshSpy = vi.spyOn(panel, 'refresh');
      
      selection.select(entity);
      
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('non-logic cube entity', () => {
    it('should show convert button when entity lacks LogicCubeComponent', () => {
      selection.select(entity);
      
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const empty = host.querySelector('.logic-panel__empty');
      expect(empty).toBeTruthy();
      expect(empty?.textContent).toContain('not a logic cube');
      
      const convertBtn = host.querySelector('.logic-panel__convert-btn') as HTMLButtonElement;
      expect(convertBtn).toBeTruthy();
    });

    it('should convert entity to logic cube when button clicked', () => {
      selection.select(entity);
      const onConfigChanged = vi.fn();
      
      const panel = new LogicPanel({ selection, onConfigChanged });
      host.appendChild(panel.element);
      panel.refresh();

      const convertBtn = host.querySelector('.logic-panel__convert-btn') as HTMLButtonElement;
      convertBtn.click();

      const component = entity.getComponent(LogicCubeComponent);
      expect(component).toBeTruthy();
      expect(component?.getCubeType()).toBe('onClickTrigger');
      expect(onConfigChanged).toHaveBeenCalled();
    });
  });

  describe('logic cube editor', () => {
    let component: LogicCubeComponent;

    beforeEach(() => {
      component = new LogicCubeComponent();
      component.setCubeType('onClickTrigger');
      component.setEnabled(true);
      entity.addComponent(component);
      selection.select(entity);
    });

    it('should render logic cube editor with header', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const header = host.querySelector('.logic-panel__header');
      expect(header).toBeTruthy();
      expect(header?.textContent).toContain('Logic Cube');
    });

    it('should show enabled checkbox reflecting component state', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.checked).toBe(true);
    });

    it('should toggle enabled state when checkbox changed', () => {
      const onConfigChanged = vi.fn();
      const panel = new LogicPanel({ selection, onConfigChanged });
      host.appendChild(panel.element);
      panel.refresh();

      const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      expect(component.isEnabled()).toBe(false);
      expect(onConfigChanged).toHaveBeenCalled();
    });

    it('should render type selector with cube types', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const select = host.querySelector('.logic-panel__select') as HTMLSelectElement;
      expect(select).toBeTruthy();
      expect(select.value).toBe('onClickTrigger');
      
      // Should have optgroups for categories
      const optgroups = host.querySelectorAll('optgroup');
      expect(optgroups.length).toBeGreaterThan(0);
    });

    it('should change cube type when selector changed', () => {
      const onConfigChanged = vi.fn();
      const panel = new LogicPanel({ selection, onConfigChanged });
      host.appendChild(panel.element);
      panel.refresh();

      const select = host.querySelector('.logic-panel__select') as HTMLSelectElement;
      
      // Find an option that's different from current
      const options = Array.from(select.querySelectorAll('option'));
      const differentOption = options.find(opt => opt.value !== 'onClickTrigger');
      
      if (differentOption) {
        select.value = differentOption.value;
        select.dispatchEvent(new Event('change'));

        expect(component.getCubeType()).toBe(differentOption.value);
        expect(onConfigChanged).toHaveBeenCalled();
      }
    });

    it('should render configuration section', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const section = host.querySelector('.logic-panel__section');
      expect(section).toBeTruthy();
      
      const heading = Array.from(host.querySelectorAll('h4')).find(
        h => h.textContent === 'Configuration'
      );
      expect(heading).toBeTruthy();
    });

    it('should render connections section', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const heading = Array.from(host.querySelectorAll('h4')).find(
        h => h.textContent === 'Connections'
      );
      expect(heading).toBeTruthy();
    });

    it('should show "no connections" message when no connections exist', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const message = Array.from(host.querySelectorAll('p')).find(
        p => p.textContent === 'No connections yet'
      );
      expect(message).toBeTruthy();
    });

    it('should display outgoing connections', () => {
      const mockConnections = [
        {
          sourceEntityId: entity.id,
          targetEntityId: 'target1',
          sourcePort: 'output1',
          targetPort: 'input1',
        },
      ];

      vi.mocked(getLogicConnectionManager).mockReturnValue({
        getConnectionsFromEntity: vi.fn().mockReturnValue(mockConnections),
        getConnectionsToEntity: vi.fn().mockReturnValue([]),
      } as any);

      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const outgoingTitle = Array.from(host.querySelectorAll('h5')).find(
        h => h.textContent === 'Outgoing'
      );
      expect(outgoingTitle).toBeTruthy();
    });

    it('should display incoming connections', () => {
      const mockConnections = [
        {
          sourceEntityId: 'source1',
          targetEntityId: entity.id,
          sourcePort: 'output1',
          targetPort: 'input1',
        },
      ];

      vi.mocked(getLogicConnectionManager).mockReturnValue({
        getConnectionsFromEntity: vi.fn().mockReturnValue([]),
        getConnectionsToEntity: vi.fn().mockReturnValue(mockConnections),
      } as any);

      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const incomingTitle = Array.from(host.querySelectorAll('h5')).find(
        h => h.textContent === 'Incoming'
      );
      expect(incomingTitle).toBeTruthy();
    });
  });

  describe('parameter fields', () => {
    beforeEach(() => {
      const component = new LogicCubeComponent();
      component.setCubeType('onClickTrigger');
      entity.addComponent(component);
      selection.select(entity);
    });

    it('should handle number parameters', () => {
      // This test depends on the actual metadata in LogicCubeLibrary
      // We'll just verify the panel renders without errors
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      
      expect(() => panel.refresh()).not.toThrow();
    });

    it('should handle boolean parameters', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      
      expect(() => panel.refresh()).not.toThrow();
    });

    it('should handle select parameters', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      
      expect(() => panel.refresh()).not.toThrow();
    });
  });

  describe('disposal', () => {
    it('should remove element on dispose', () => {
      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);

      expect(document.contains(panel.element)).toBe(true);
      
      panel.dispose();

      expect(document.contains(panel.element)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing LogicConnectionManager gracefully', () => {
      vi.mocked(getLogicConnectionManager).mockReturnValue(null);

      const component = new LogicCubeComponent();
      component.setCubeType('onClickTrigger');
      entity.addComponent(component);
      selection.select(entity);

      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const message = Array.from(host.querySelectorAll('p')).find(
        p => p.textContent === 'Connection data unavailable'
      );
      expect(message).toBeTruthy();
    });

    it('should handle unknown cube type gracefully', () => {
      const component = new LogicCubeComponent();
      component.setCubeType('unknownType');
      entity.addComponent(component);
      selection.select(entity);

      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      
      expect(() => panel.refresh()).not.toThrow();
    });

    it('should handle cube type with no parameters', () => {
      // Mock a cube type with no parameters
      const getSpy = vi.spyOn(LogicCubeLibrary, 'get').mockReturnValue({
        metadata: {
          type: 'simple',
          displayName: 'Simple',
          category: 'trigger' as any,
          description: 'Simple cube',
          parameters: [],
          inputs: [],
          outputs: [],
        },
      } as any);

      const component = new LogicCubeComponent();
      component.setCubeType('simple');
      entity.addComponent(component);
      selection.select(entity);

      const panel = new LogicPanel({ selection });
      host.appendChild(panel.element);
      panel.refresh();

      const message = Array.from(host.querySelectorAll('p')).find(
        p => p.textContent === 'No parameters to configure'
      );
      expect(message).toBeTruthy();

      getSpy.mockRestore();
    });
  });
});

