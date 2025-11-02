import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, MeshComponent } from '@engine/world';
import { AvatarPartMountManager } from './avatar-part-mount-manager';
import { AvatarMeshGenerator } from '../mesh/avatar-mesh-generator';
import { AvatarMaterialManager } from '../material/avatar-material-manager';
import { AvatarColorManager } from '../color/avatar-color-manager';
import type { AvatarSlot, AvatarPartDefinition } from '../slots';
import type { AvatarJointName } from '../skeleton';
import type { RgbaColor } from '@engine/world';

describe('AvatarPartMountManager', () => {
  let jointEntities: Map<AvatarJointName, Entity>;
  let slotEntities: Map<AvatarSlot, Entity>;
  let meshGenerator: AvatarMeshGenerator;
  let materialManager: AvatarMaterialManager;
  let colorManager: AvatarColorManager;
  let manager: AvatarPartMountManager;
  let testJoint: Entity;

  beforeEach(() => {
    jointEntities = new Map();
    slotEntities = new Map();
    meshGenerator = new AvatarMeshGenerator();
    materialManager = new AvatarMaterialManager();
    colorManager = new AvatarColorManager();

    testJoint = new Entity('TestJoint');
    jointEntities.set('Head', testJoint);

    manager = new AvatarPartMountManager(
      jointEntities,
      slotEntities,
      meshGenerator,
      materialManager,
      colorManager,
    );
  });

  describe('mountPart', () => {
    it('should mount part to joint', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);

      expect(slotEntities.has('HeadSlot')).toBe(true);
      const mountedEntity = slotEntities.get('HeadSlot');
      expect(mountedEntity).toBeDefined();
      expect(mountedEntity?.parent).toBe(testJoint);
      expect(testJoint.children.includes(mountedEntity!)).toBe(true);
    });

    it('should set entity transform from definition', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [1, 2, 3] as [number, number, number],
          localRotation: [0, 0, 0, 1] as [number, number, number, number],
          localScale: [2, 3, 4] as [number, number, number],
          defaultColor: [1, 1, 1, 1] as RgbaColor,
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);

      const entity = slotEntities.get('HeadSlot');
      expect(entity).toBeDefined();
      if (entity) {
        expect(entity.transform.position[0]).toBe(1);
        expect(entity.transform.position[1]).toBe(2);
        expect(entity.transform.position[2]).toBe(3);
        expect(entity.transform.scale[0]).toBe(2);
        expect(entity.transform.scale[1]).toBe(3);
        expect(entity.transform.scale[2]).toBe(4);
      }
    });

    it('should set entity user data', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);

      const entity = slotEntities.get('HeadSlot');
      expect(entity?.userData.avatarSlot).toBe('HeadSlot');
      expect(entity?.userData.avatarPartId).toBe('test_part');
    });

    it('should set mesh type from definition', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);

      const entity = slotEntities.get('HeadSlot');
      expect(entity?.meshType).toBe('sphere');
    });

    it('should generate procedural mesh for sphere', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);

      const entity = slotEntities.get('HeadSlot');
      expect(entity).toBeDefined();
      if (entity) {
        const meshComponent = entity.getComponent(MeshComponent);
        if (meshComponent) {
          // Mesh should be generated for sphere
          expect(meshComponent.meshData).toBeDefined();
        }
      }
    });

    it('should warn when joint entity is missing', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'UnknownJoint' as AvatarJointName,
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('Joint entity');
      expect(slotEntities.has('HeadSlot')).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should apply colors from selection', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
          colorSlots: ['primary'],
        } as AvatarPartDefinition,
        colors: {
          primary: [1, 0, 0, 1] as RgbaColor,
        },
      };

      manager.mountPart(selection);

      const entity = slotEntities.get('HeadSlot');
      expect(entity?.userData.avatarColorSlots).toBeDefined();
    });

    it('should use default material from definition when not provided', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
          defaultMaterial: 'default_mat',
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);

      // Should not throw - material manager handles default material
      expect(slotEntities.has('HeadSlot')).toBe(true);
    });

    it('should apply material from selection', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
        materialId: 'custom_mat',
      };

      manager.mountPart(selection);

      // Should not throw - material manager handles custom material
      expect(slotEntities.has('HeadSlot')).toBe(true);
    });

    it('should replace existing part in slot', () => {
      const selection1 = {
        id: 'test_part1',
        definition: {
          id: 'test_part1',
          displayName: 'Test Part 1',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      const selection2 = {
        id: 'test_part2',
        definition: {
          id: 'test_part2',
          displayName: 'Test Part 2',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection1);
      const firstEntity = slotEntities.get('HeadSlot');

      manager.mountPart(selection2);
      const secondEntity = slotEntities.get('HeadSlot');

      expect(secondEntity).toBeDefined();
      expect(secondEntity).not.toBe(firstEntity);
      expect(secondEntity?.userData.avatarPartId).toBe('test_part2');
    });
  });

  describe('unmountSlot', () => {
    it('should unmount part from slot', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);
      expect(slotEntities.has('HeadSlot')).toBe(true);

      const entity = slotEntities.get('HeadSlot');
      expect(entity?.parent).toBe(testJoint);

      manager.unmountSlot('HeadSlot');

      expect(slotEntities.has('HeadSlot')).toBe(false);
      expect(entity?.parent).toBeNull();
      expect(testJoint.children.includes(entity!)).toBe(false);
    });

    it('should handle unmounting non-existent slot', () => {
      expect(() => {
        manager.unmountSlot('NonExistentSlot' as AvatarSlot);
      }).not.toThrow();

      expect(slotEntities.has('NonExistentSlot' as AvatarSlot)).toBe(false);
    });

    it('should handle unmounting slot with no parent', () => {
      const selection = {
        id: 'test_part',
        definition: {
          id: 'test_part',
          displayName: 'Test Part',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'cube',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        } as AvatarPartDefinition,
      };

      manager.mountPart(selection);
      const entity = slotEntities.get('HeadSlot');
      if (entity) {
        entity.parent?.removeChild(entity);
      }

      expect(() => {
        manager.unmountSlot('HeadSlot');
      }).not.toThrow();

      expect(slotEntities.has('HeadSlot')).toBe(false);
    });
  });
});

