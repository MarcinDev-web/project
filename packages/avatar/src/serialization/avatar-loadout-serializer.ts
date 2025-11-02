import type { AvatarSlot, AvatarPartLibrary } from '../slots';
import type { AvatarLoadout, AvatarLoadoutPart } from '../avatar-instance';
import { cloneColorRecord } from '../utils/clone';
import type { RgbaColor } from '@engine/world';

interface AvatarPartSelectionState {
  id: string;
  definition: any;
  colors?: Record<string, RgbaColor>;
  materialId?: string;
  appliedColors?: Record<string, RgbaColor>;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Manages serialization and validation of avatar loadouts.
 */
export class AvatarLoadoutSerializer {
  /**
   * Serialize selections map to AvatarLoadout.
   */
  serialize(selections: Map<AvatarSlot, AvatarPartSelectionState>): AvatarLoadout {
    const parts: Partial<Record<AvatarSlot, AvatarLoadoutPart>> = {};
    for (const [slot, selection] of selections.entries()) {
      const entry: AvatarLoadoutPart = { mesh: selection.id };
      if (selection.materialId) {
        entry.material = selection.materialId;
        entry.mat = selection.materialId;
      }
      if (selection.colors) {
        entry.colors = cloneColorRecord(selection.colors);
      }
      parts[slot] = entry;
    }
    return {
      version: 1,
      parts,
    };
  }

  /**
   * Validate a loadout against a part library.
   */
  validate(loadout: AvatarLoadout, partLibrary: AvatarPartLibrary): ValidationResult {
    const errors: string[] = [];

    if (!loadout.parts) {
      errors.push('Loadout has no parts');
      return { valid: false, errors };
    }

    for (const [slot, part] of Object.entries(loadout.parts) as [AvatarSlot, AvatarLoadoutPart][]) {
      if (!part) {
        errors.push(`Slot ${slot} has null/undefined part`);
        continue;
      }

      if (!part.mesh) {
        errors.push(`Slot ${slot} has no mesh specified`);
        continue;
      }

      const definition = partLibrary[part.mesh];
      if (!definition) {
        errors.push(`Slot ${slot} references unknown mesh "${part.mesh}"`);
        continue;
      }

      if (definition.slot !== slot) {
        errors.push(
          `Slot ${slot} references mesh "${part.mesh}" which is registered for ${definition.slot}`,
        );
        continue;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

