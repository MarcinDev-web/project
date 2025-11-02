import { Entity } from '@engine/world';
import type { RgbaColor } from '@engine/world';
import type { AvatarPartDefinition } from '../slots';
import { cloneColor, cloneColorRecord } from '../utils/clone';

interface AvatarPartSelectionState {
  id: string;
  definition: AvatarPartDefinition;
  colors?: Record<string, RgbaColor>;
  materialId?: string;
  appliedColors?: Record<string, RgbaColor>;
}

/**
 * Manages color application for avatar parts.
 * Handles color hierarchy: overrides > defaults > fallbacks.
 */
export class AvatarColorManager {
  /**
   * Apply color slots to an entity based on selection state.
   * Returns the applied colors for use by material manager.
   */
  applyColorSlots(
    entity: Entity,
    selection: AvatarPartSelectionState,
  ): Record<string, RgbaColor> {
    const colors: Record<string, RgbaColor> = {};
    const overrideMap = selection.colors ?? {};
    const defaults = selection.definition.defaultColors ?? {};
    const explicitSlots =
      selection.definition.colorSlots && selection.definition.colorSlots.length > 0
        ? selection.definition.colorSlots
        : [];

    const slotSet = new Set<string>([
      ...explicitSlots,
      ...Object.keys(defaults),
      ...Object.keys(overrideMap),
    ]);

    if (slotSet.size === 0 && selection.definition.defaultColor) {
      slotSet.add('primary');
    }

    for (const slotName of slotSet) {
      const override = overrideMap[slotName];
      if (override) {
        colors[slotName] = cloneColor(override);
        continue;
      }
      const defaultSlotColor = defaults[slotName];
      if (defaultSlotColor) {
        colors[slotName] = cloneColor(defaultSlotColor);
        continue;
      }
      if (slotName === 'primary' && selection.definition.defaultColor) {
        colors.primary = cloneColor(selection.definition.defaultColor);
      }
    }

    for (const [slotName, override] of Object.entries(overrideMap)) {
      if (!colors[slotName]) {
        colors[slotName] = cloneColor(override);
      }
    }

    if (Object.keys(colors).length > 0) {
      entity.userData.avatarColorSlots = cloneColorRecord(colors);
    } else {
      delete entity.userData.avatarColorSlots;
    }

    return colors;
  }
}

