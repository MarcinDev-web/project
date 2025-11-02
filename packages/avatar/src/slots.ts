import type { Vec3, Quat } from '@engine/core/math';
import type { MeshKind, RgbaColor } from '@engine/world';
import type { AvatarJointName } from './skeleton';

export const AVATAR_SLOTS = [
  'HeadSlot',
  'NeckSlot',
  'TorsoSlot',
  'UpperArmSlotL',
  'UpperArmSlotR',
  'LowerArmSlotL',
  'LowerArmSlotR',
  'HandSlotL',
  'HandSlotR',
  'UpperLegSlotL',
  'UpperLegSlotR',
  'LowerLegSlotL',
  'LowerLegSlotR',
  'FootSlotL',
  'FootSlotR',
  'FaceOverlaySlot',
  'HairSlot',
  'BackSlot',
  'HeadFXSlot',
  'HandheldSlotL',
  'HandheldSlotR',
] as const;

export type AvatarSlot = (typeof AVATAR_SLOTS)[number];

export interface AvatarSlotBinding {
  readonly slot: AvatarSlot;
  readonly joint: AvatarJointName;
  readonly category: 'core' | 'cosmetic' | 'equipment';
  readonly side?: 'left' | 'right';
}

export const AVATAR_SLOT_BINDINGS: Record<AvatarSlot, AvatarSlotBinding> = {
  HeadSlot: { slot: 'HeadSlot', joint: 'Head', category: 'core' },
  NeckSlot: { slot: 'NeckSlot', joint: 'Neck', category: 'core' },
  TorsoSlot: { slot: 'TorsoSlot', joint: 'Chest', category: 'core' },
  UpperArmSlotL: { slot: 'UpperArmSlotL', joint: 'Arm.L.Upper', category: 'core', side: 'left' },
  UpperArmSlotR: { slot: 'UpperArmSlotR', joint: 'Arm.R.Upper', category: 'core', side: 'right' },
  LowerArmSlotL: { slot: 'LowerArmSlotL', joint: 'Arm.L.Lower', category: 'core', side: 'left' },
  LowerArmSlotR: { slot: 'LowerArmSlotR', joint: 'Arm.R.Lower', category: 'core', side: 'right' },
  HandSlotL: { slot: 'HandSlotL', joint: 'Hand.L', category: 'core', side: 'left' },
  HandSlotR: { slot: 'HandSlotR', joint: 'Hand.R', category: 'core', side: 'right' },
  UpperLegSlotL: { slot: 'UpperLegSlotL', joint: 'Leg.L.Upper', category: 'core', side: 'left' },
  UpperLegSlotR: { slot: 'UpperLegSlotR', joint: 'Leg.R.Upper', category: 'core', side: 'right' },
  LowerLegSlotL: { slot: 'LowerLegSlotL', joint: 'Leg.L.Lower', category: 'core', side: 'left' },
  LowerLegSlotR: { slot: 'LowerLegSlotR', joint: 'Leg.R.Lower', category: 'core', side: 'right' },
  FootSlotL: { slot: 'FootSlotL', joint: 'Foot.L', category: 'core', side: 'left' },
  FootSlotR: { slot: 'FootSlotR', joint: 'Foot.R', category: 'core', side: 'right' },
  FaceOverlaySlot: { slot: 'FaceOverlaySlot', joint: 'Head', category: 'cosmetic' },
  HairSlot: { slot: 'HairSlot', joint: 'Head', category: 'cosmetic' },
  BackSlot: { slot: 'BackSlot', joint: 'Chest', category: 'cosmetic' },
  HeadFXSlot: { slot: 'HeadFXSlot', joint: 'Head', category: 'cosmetic' },
  HandheldSlotL: { slot: 'HandheldSlotL', joint: 'Hand.L', category: 'equipment', side: 'left' },
  HandheldSlotR: { slot: 'HandheldSlotR', joint: 'Hand.R', category: 'equipment', side: 'right' },
};

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
