import { Entity, MaterialComponent } from '@engine/world';
import type { RgbaColor } from '@engine/world';
import type { AvatarMaterialBinding, AvatarMaterialResolver } from '../avatar-instance';
import type { AvatarPartDefinition } from '../slots';
import { cloneColor } from '../utils/clone';

interface AvatarPartSelectionState {
  id: string;
  definition: AvatarPartDefinition;
  colors?: Record<string, RgbaColor>;
  materialId?: string;
  appliedColors?: Record<string, RgbaColor>;
}

/**
 * Manages material resolution and application for avatar parts.
 */
export class AvatarMaterialManager {
  private readonly materialResolver: AvatarMaterialResolver | undefined;

  constructor(materialResolver?: AvatarMaterialResolver) {
    this.materialResolver = materialResolver;
  }

  /**
   * Apply material to an entity based on selection state.
   */
  applyMaterial(
    entity: Entity,
    selection: AvatarPartSelectionState,
    appliedColors: Record<string, RgbaColor>,
  ): void {
    const materialComponent = this.ensureMaterialComponent(entity);

    const materialKey = selection.materialId ?? null;
    const binding = materialKey ? this.resolveBinding(materialKey) : null;

    if (binding?.materialId !== undefined) {
      materialComponent.materialId = binding.materialId;
    } else if (materialKey) {
      const numericId = Number(materialKey);
      if (Number.isFinite(numericId)) {
        materialComponent.materialId = Math.floor(numericId);
      }
    } else if (selection.definition.defaultMaterial) {
      const fallbackBinding = this.resolveBinding(selection.definition.defaultMaterial);
      if (fallbackBinding?.materialId !== undefined) {
        materialComponent.materialId = fallbackBinding.materialId;
      }
    }

    const defaults = selection.definition.defaultColors ?? {};
    const primaryBase =
      binding?.color ??
      appliedColors.primary ??
      defaults.primary ??
      selection.definition.defaultColor ??
      ([1, 1, 1, 1] as RgbaColor);
    materialComponent.primaryColor = cloneColor(primaryBase);

    const secondaryColor =
      appliedColors.secondary ??
      defaults.secondary ??
      ([primaryBase[0], primaryBase[1], primaryBase[2], primaryBase[3]] as RgbaColor);
    materialComponent.secondaryColor = cloneColor(secondaryColor);

    const accentColor =
      appliedColors.accent ??
      defaults.accent ??
      ([primaryBase[0], primaryBase[1], primaryBase[2], primaryBase[3]] as RgbaColor);
    materialComponent.accentColor = cloneColor(accentColor);

    const emissiveColor =
      appliedColors.emissive ??
      defaults.emissive ??
      ([0, 0, 0, 0] as RgbaColor);
    materialComponent.emissiveColor = cloneColor(emissiveColor);
    materialComponent.emissiveIntensity = emissiveColor[3] ?? 0;

    if (binding?.metallic !== undefined) {
      materialComponent.metallic = binding.metallic;
    }
    if (binding?.roughness !== undefined) {
      materialComponent.roughness = binding.roughness;
    }

    if (binding?.color && !appliedColors.primary) {
      // binding defined primary color but we already set from primaryBase, ensure opacity matches binding
      materialComponent.primaryColor = cloneColor(binding.color);
    }

    if (materialKey) {
      entity.userData.avatarMaterial = materialKey;
    } else if (selection.definition.defaultMaterial) {
      entity.userData.avatarMaterial = selection.definition.defaultMaterial;
    } else {
      delete entity.userData.avatarMaterial;
    }

    materialComponent.updateFlags();
  }

  /**
   * Resolve material binding from material ID.
   */
  resolveBinding(materialId: string): AvatarMaterialBinding | null {
    if (!materialId) {
      return null;
    }
    try {
      const binding = this.materialResolver?.(materialId);
      if (binding) {
        return binding;
      }
    } catch (error) {
      console.warn(`[AvatarMaterialManager] Material resolver threw for "${materialId}":`, error);
    }
    const numeric = Number(materialId);
    if (Number.isFinite(numeric)) {
      return { materialId: Math.floor(numeric) };
    }
    return null;
  }

  private ensureMaterialComponent(entity: Entity): MaterialComponent {
    let material = entity.getComponent(MaterialComponent);
    if (!material) {
      material = new MaterialComponent();
      entity.addComponent(material);
    }
    return material;
  }
}

