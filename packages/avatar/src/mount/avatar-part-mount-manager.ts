import type { Vec3, Quat } from '@engine/core/math';
import { Entity, MeshComponent } from '@engine/world';
import type { AvatarSlot } from '../slots';
import type { AvatarJointName } from '../skeleton';
import { AvatarMeshGenerator } from '../mesh/avatar-mesh-generator';
import { AvatarMaterialManager } from '../material/avatar-material-manager';
import { AvatarColorManager } from '../color/avatar-color-manager';
import type { AvatarPartDefinition } from '../slots';
import type { RgbaColor } from '@engine/world';

interface AvatarPartSelectionState {
  id: string;
  definition: AvatarPartDefinition;
  colors?: Record<string, RgbaColor>;
  materialId?: string;
  appliedColors?: Record<string, RgbaColor>;
}

/**
 * Manages mounting and unmounting of avatar parts to joints.
 */
export class AvatarPartMountManager {
  private readonly jointEntities: Map<AvatarJointName, Entity>;
  private readonly slotEntities: Map<AvatarSlot, Entity>;
  private readonly meshGenerator: AvatarMeshGenerator;
  private readonly materialManager: AvatarMaterialManager;
  private readonly colorManager: AvatarColorManager;

  constructor(
    jointEntities: Map<AvatarJointName, Entity>,
    slotEntities: Map<AvatarSlot, Entity>,
    meshGenerator: AvatarMeshGenerator,
    materialManager: AvatarMaterialManager,
    colorManager: AvatarColorManager,
  ) {
    this.jointEntities = jointEntities;
    this.slotEntities = slotEntities;
    this.meshGenerator = meshGenerator;
    this.materialManager = materialManager;
    this.colorManager = colorManager;
  }

  /**
   * Mount a part to its joint based on selection state.
   */
  mountPart(selection: AvatarPartSelectionState): void {
    const joint = this.jointEntities.get(selection.definition.joint);
    if (!joint) {
      console.warn(
        `[AvatarPartMountManager] Joint entity for ${selection.definition.joint} missing when mounting ${selection.id}`,
      );
      return;
    }

    const entity = new Entity(`AvatarPart:${selection.definition.id}`);
    entity.meshType = selection.definition.mesh;

    // Handle procedural mesh generation
    const meshComponent = entity.getComponent(MeshComponent);
    if (meshComponent) {
      const proceduralMesh = this.meshGenerator.generateMesh(
        selection.definition.mesh,
        selection.id,
      );
      if (proceduralMesh) {
        meshComponent.meshData = proceduralMesh;
      } else if (
        selection.definition.mesh === 'avatar_torso' ||
        selection.definition.mesh === 'sphere'
      ) {
        // Procedural mesh generation failed
        console.error(
          `[AvatarPartMountManager] Failed to generate procedural mesh "${selection.definition.mesh}" for part "${selection.id}"`,
        );
        entity.active = false;
      }
    }

    // Set transform
    entity.transform.position = [...selection.definition.localPosition] as Vec3;
    entity.transform.rotation = [...selection.definition.localRotation] as Quat;
    entity.transform.scale = [...selection.definition.localScale] as Vec3;

    // Set user data
    entity.userData.avatarSlot = selection.definition.slot;
    entity.userData.avatarPartId = selection.definition.id;

    // Set default material if not provided
    if (!selection.materialId && selection.definition.defaultMaterial) {
      selection.materialId = selection.definition.defaultMaterial;
    }

    // Apply colors
    const appliedColors = this.colorManager.applyColorSlots(entity, selection);
    selection.appliedColors = appliedColors;

    // Apply material
    this.materialManager.applyMaterial(entity, selection, appliedColors);

    // Attach to joint
    joint.addChild(entity);
    this.slotEntities.set(selection.definition.slot, entity);
  }

  /**
   * Unmount a part from a slot.
   */
  unmountSlot(slot: AvatarSlot): void {
    const existing = this.slotEntities.get(slot);
    if (existing) {
      const parent = existing.parent;
      if (parent) {
        parent.removeChild(existing);
      }
    }
    this.slotEntities.delete(slot);
  }
}

