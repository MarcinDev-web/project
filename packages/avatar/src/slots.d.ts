import type { Vec3, Quat } from '@engine/core/math';
import type { MeshKind, RgbaColor } from '@engine/world';
import type { AvatarJointName } from './skeleton';
export declare const AVATAR_SLOTS: readonly ["HeadSlot", "NeckSlot", "TorsoSlot", "UpperArmSlotL", "UpperArmSlotR", "LowerArmSlotL", "LowerArmSlotR", "HandSlotL", "HandSlotR", "UpperLegSlotL", "UpperLegSlotR", "LowerLegSlotL", "LowerLegSlotR", "FootSlotL", "FootSlotR", "FaceOverlaySlot", "HairSlot", "BackSlot", "HeadFXSlot", "HandheldSlotL", "HandheldSlotR"];
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];
export interface AvatarSlotBinding {
    readonly slot: AvatarSlot;
    readonly joint: AvatarJointName;
    readonly category: 'core' | 'cosmetic' | 'equipment';
    readonly side?: 'left' | 'right';
}
export declare const AVATAR_SLOT_BINDINGS: Record<AvatarSlot, AvatarSlotBinding>;
export interface AvatarPartDefinition {
    readonly id: string;
    readonly displayName: string;
    readonly slot: AvatarSlot;
    readonly joint: AvatarJointName;
    readonly mesh: MeshKind;
    readonly localPosition: Vec3;
    readonly localRotation: Quat;
    readonly localScale: Vec3;
    readonly defaultColor: RgbaColor;
    readonly defaultColors?: Record<string, RgbaColor>;
    readonly defaultMaterial?: string;
    readonly colorSlots?: readonly string[];
}
export type AvatarPartLibrary = Record<string, AvatarPartDefinition>;
//# sourceMappingURL=slots.d.ts.map