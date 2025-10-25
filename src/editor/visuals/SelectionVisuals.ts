import type { Entity } from '../../engine/scene';
import type { Scene } from '../../scene/Scene';
import type { SelectionManager } from '../../scene/Selection';
import type { RgbaColor } from '../../utils/colors';
import { copyRgba, lightenColorInPlace } from '../../utils/colors';

export const HIGHLIGHT_COLOR_BOOST = 0.3;

export function initializeBaseColor(entity: Entity, baseColor: RgbaColor): void {
  // Store copies but reuse allocations when possible
  const stored = (entity.userData.baseColor as RgbaColor | undefined) ?? [1, 1, 1, 1];
  const colorBuf = entity.color ?? [1, 1, 1, 1];
  copyRgba(stored, baseColor);
  copyRgba(colorBuf, baseColor);
  entity.userData.baseColor = stored;
  entity.color = colorBuf;
}

export function applySelectionVisuals(
  scene: Scene,
  selection: SelectionManager,
  highlightBoost = HIGHLIGHT_COLOR_BOOST
): void {
  scene.traverse((entity) => {
    const hasStored = (entity.userData.baseColor as RgbaColor | undefined) !== undefined;
    const storedBase = (entity.userData.baseColor as RgbaColor | undefined) ?? [
      entity.color?.[0] ?? 1,
      entity.color?.[1] ?? 1,
      entity.color?.[2] ?? 1,
      entity.color?.[3] ?? 1,
    ];

    // Ensure we have buffers to write into without allocating each frame
    if (!hasStored) {
      entity.userData.baseColor = storedBase;
    }
    if (!entity.color) {
      entity.color = [storedBase[0], storedBase[1], storedBase[2], storedBase[3]];
    }

    // Update color in place, only when necessary
    const isSelected = selection.isSelected(entity);
    if (isSelected) {
      copyRgba(entity.color, storedBase);
      lightenColorInPlace(entity.color, highlightBoost);
    } else {
      // Only copy if current differs from base to avoid redundant writes
      const c = entity.color;
      if (
        c[0] !== storedBase[0] ||
        c[1] !== storedBase[1] ||
        c[2] !== storedBase[2] ||
        c[3] !== storedBase[3]
      ) {
        copyRgba(entity.color, storedBase);
      }
    }
  });
}
