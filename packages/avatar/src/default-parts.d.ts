import type { Vec3, Quat } from '@engine/core/math';
import type { RgbaColor } from '@engine/world';
import type { AvatarPartDefinition, AvatarSlot } from './slots';
import type { AvatarJointName } from './skeleton';
export declare const COLOR_SKIN: RgbaColor;
export declare const COLOR_HAIR: RgbaColor;
export declare const COLOR_SHIRT: RgbaColor;
export declare const COLOR_PANTS: RgbaColor;
export declare const COLOR_SHOE: RgbaColor;
export declare const COLOR_ACCENT: RgbaColor;
export interface MirroredPartInput {
    baseId: string;
    displayName: string;
    slotLeft: AvatarSlot;
    slotRight: AvatarSlot;
    jointLeft: AvatarJointName;
    jointRight: AvatarJointName;
    localPosition: Vec3;
    localScale: Vec3;
    defaultColor: RgbaColor;
    mesh?: AvatarPartDefinition['mesh'];
    colorSlots?: readonly string[];
    defaultMaterial?: string;
    localRotation?: Quat;
}
export declare function createMirroredParts(input: MirroredPartInput): AvatarPartDefinition[];
export declare const DEFAULT_AVATAR_PART_DEFINITIONS: readonly AvatarPartDefinition[];
//# sourceMappingURL=default-parts.d.ts.map