import type { Vec3, Quat } from '@engine/core/math';
import type { RgbaColor } from '@engine/world';
import type { AvatarPartDefinition } from '../slots';

type MutableRgbaColor = [number, number, number, number];

export function cloneColor(color: RgbaColor): MutableRgbaColor {
  return [color[0], color[1], color[2], color[3]] as MutableRgbaColor;
}

export function cloneColorRecord(colors: Record<string, RgbaColor>): Record<string, RgbaColor>;
export function cloneColorRecord(colors: undefined): undefined;
export function cloneColorRecord(
  colors: Record<string, RgbaColor> | undefined,
): Record<string, RgbaColor> | undefined {
  if (!colors) return undefined;
  const out: Record<string, RgbaColor> = {};
  for (const [key, value] of Object.entries(colors)) {
    out[key] = cloneColor(value);
  }
  return out;
}

export function cloneVec3(vec: Vec3): Vec3 {
  return [vec[0], vec[1], vec[2]] as Vec3;
}

export function cloneQuat(quat: Quat): Quat {
  return [quat[0], quat[1], quat[2], quat[3]] as Quat;
}

export function clonePartDefinition(definition: AvatarPartDefinition): AvatarPartDefinition {
  return {
    ...definition,
    localPosition: cloneVec3(definition.localPosition),
    localRotation: cloneQuat(definition.localRotation),
    localScale: cloneVec3(definition.localScale),
    defaultColor: cloneColor(definition.defaultColor),
    ...(definition.colorSlots ? { colorSlots: [...definition.colorSlots] } : {}),
    ...(definition.defaultMaterial ? { defaultMaterial: definition.defaultMaterial } : {}),
    ...(definition.defaultColors
      ? { defaultColors: cloneColorRecord(definition.defaultColors) }
      : {}),
  };
}

