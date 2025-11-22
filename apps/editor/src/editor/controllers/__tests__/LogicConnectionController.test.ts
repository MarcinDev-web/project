import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Mock modules BEFORE importing the unit under test
vi.mock('@engine/world', () => {
  return {
    Entity: class {
      id = 'mock-id';
      name = 'MockEntity';
      getComponent = vi.fn();
    },
    Scene: class {},
  };
});

vi.mock('@engine/script', () => {
  return {
    LogicCubeComponent: class {
      getCubeType = vi.fn();
    },
  };
});

vi.mock('@engine/editor-utils', () => ({
  LogicCubeLibrary: {
    get: vi.fn(),
  },
}));

vi.mock('../../ui/modals/PortSelectionModal', () => ({
  showPortSelectionModal: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Now import the controller which will use the mocked modules
import { LogicConnectionController } from '../LogicConnectionController';
import { Entity } from '@engine/world';
import { LogicCubeComponent } from '@engine/script';
import { LogicCubeLibrary } from '@engine/editor-utils';
import { showPortSelectionModal } from '../../ui/modals/PortSelectionModal';

describe('LogicConnectionController', () => {
  let controller: LogicConnectionController;
  let mockScene: any;
  let mockConnectionManager: any;
  let sourceEntity: Entity;
  let targetEntity: Entity;
  let sourceComponent: LogicCubeComponent;
  let targetComponent: LogicCubeComponent;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mocks
    mockScene = {
      createEntity: vi.fn(),
    };

    mockConnectionManager = {
      validateConnection: vi.fn().mockReturnValue({ valid: true }),
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
      getConnectionsFromEntity: vi.fn().mockReturnValue([]),
    };

    controller = new LogicConnectionController(mockScene, mockConnectionManager);

    // Setup entities
    sourceEntity = new Entity();
    Object.defineProperty(sourceEntity, 'id', { value: 'source-1' });
    sourceEntity.name = 'Source Cube';

    targetEntity = new Entity();
    Object.defineProperty(targetEntity, 'id', { value: 'target-1' });
    targetEntity.name = 'Target Cube';

    // Setup components
    sourceComponent = {
      getCubeType: vi.fn().mockReturnValue('test-source'),
    } as any;

    targetComponent = {
      getCubeType: vi.fn().mockReturnValue('test-target'),
    } as any;

    // Mock entity.getComponent
    sourceEntity.getComponent = vi.fn().mockReturnValue(sourceComponent);
    targetEntity.getComponent = vi.fn().mockReturnValue(targetComponent);
  });

  describe('Connection Flow', () => {
    it('should start in idle mode', () => {
      expect(controller.getMode()).toBe('idle');
    });

    it('should transition to selecting-source when started', () => {
      controller.startConnectionMode();
      expect(controller.getMode()).toBe('selecting-source');
    });

    it('should select source entity with single output', async () => {
      // Mock Library
      (LogicCubeLibrary.get as any).mockReturnValue({
        metadata: {
          outputs: [{ id: 'out-1', type: 'signal', direction: 'output' }],
          inputs: [],
        },
      });

      controller.startConnectionMode();
      
      const handled = await controller.handleEntityClick(sourceEntity);
      
      expect(handled).toBe(true);
      expect(controller.getMode()).toBe('selecting-target');
      expect(controller.getSourceEntity()).toBe(sourceEntity);
    });

    it('should handle target selection with multiple compatible ports', async () => {
      // Mock Library
      (LogicCubeLibrary.get as any).mockImplementation((type: string) => {
        if (type === 'test-source') {
          return {
            metadata: {
              outputs: [{ id: 'out-1', type: 'signal', direction: 'output' }],
              inputs: [],
            },
          };
        }
        if (type === 'test-target') {
          return {
            metadata: {
              outputs: [],
              inputs: [
                { id: 'in-1', type: 'signal', direction: 'input' },
                { id: 'in-2', type: 'signal', direction: 'input' },
              ],
            },
          };
        }
        return null;
      });

      // Setup source
      controller.startConnectionMode();
      await controller.handleEntityClick(sourceEntity); // Selects 'out-1' (signal)

      // Setup target interaction
      // Target has 2 inputs: in-1 (signal), in-2 (signal) - both compatible with out-1
      
      // Mock modal selection
      const selectedPort = { id: 'in-2', type: 'signal', direction: 'input' };
      (showPortSelectionModal as any).mockResolvedValue(selectedPort);

      const handled = await controller.handleEntityClick(targetEntity);

      expect(showPortSelectionModal).toHaveBeenCalled();
      expect(mockConnectionManager.validateConnection).toHaveBeenCalledWith(
        'source-1',
        'out-1',
        'target-1',
        'in-2'
      );
      expect(mockConnectionManager.addConnection).toHaveBeenCalled();
      expect(handled).toBe(true);
      expect(controller.getMode()).toBe('idle'); // Reset after connection
    });

    it('should auto-select target port if only one compatible', async () => {
      (LogicCubeLibrary.get as any).mockImplementation((type: string) => {
          if (type === 'test-source') return { metadata: { outputs: [{id: 'out', type: 'signal', direction: 'output'}] } };
          if (type === 'test-target') return { metadata: { inputs: [{id: 'in', type: 'signal', direction: 'input'}, {id: 'in-bool', type: 'boolean', direction: 'input'}] } };
          return null;
      });

      controller.startConnectionMode();
      await controller.handleEntityClick(sourceEntity);
      
      const handled = await controller.handleEntityClick(targetEntity);

      expect(showPortSelectionModal).not.toHaveBeenCalled();
      expect(mockConnectionManager.addConnection).toHaveBeenCalledWith(
        'source-1', 'out', 'target-1', 'in'
      );
      expect(handled).toBe(true);
    });

    it('should cancel if modal is cancelled', async () => {
      // Mock Library
      (LogicCubeLibrary.get as any).mockImplementation((type: string) => {
        if (type === 'test-source') {
          return {
            metadata: {
              outputs: [{ id: 'out-1', type: 'signal', direction: 'output' }],
              inputs: [],
            },
          };
        }
        if (type === 'test-target') {
          return {
            metadata: {
              outputs: [],
              inputs: [
                { id: 'in-1', type: 'signal', direction: 'input' },
                { id: 'in-2', type: 'signal', direction: 'input' },
              ],
            },
          };
        }
        return null;
      });

      controller.startConnectionMode();
      await controller.handleEntityClick(sourceEntity);

      // Return null from modal
      (showPortSelectionModal as any).mockResolvedValue(null);

      const handled = await controller.handleEntityClick(targetEntity);

      expect(handled).toBe(false);
      expect(mockConnectionManager.addConnection).not.toHaveBeenCalled();
      // Should stay in selecting-target mode so user can try again or select another target
      expect(controller.getMode()).toBe('selecting-target');
    });
  });
});

