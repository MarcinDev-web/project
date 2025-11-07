import type { Vec3, Quat } from '@engine/core/math';
import type { RgbaColor } from '@engine/world';
import type { AvatarPartDefinition, AvatarSlot } from './slots';
import type { AvatarJointName } from './skeleton';
import { clonePartDefinition, cloneVec3, cloneQuat } from './utils/clone';

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export const COLOR_SKIN: RgbaColor = [0.95, 0.82, 0.74, 1];
export const COLOR_HAIR: RgbaColor = [0.2, 0.12, 0.06, 1];
export const COLOR_SHIRT: RgbaColor = [0.22, 0.36, 0.76, 1];
export const COLOR_PANTS: RgbaColor = [0.2, 0.22, 0.28, 1];
export const COLOR_SHOE: RgbaColor = [0.1, 0.1, 0.1, 1];
export const COLOR_ACCENT: RgbaColor = [0.84, 0.18, 0.28, 1];

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

function mirrorX(vec: Vec3): Vec3 {
  return [-vec[0], vec[1], vec[2]] as Vec3;
}

export function createMirroredParts(input: MirroredPartInput): AvatarPartDefinition[] {
  const mesh = input.mesh ?? 'cube';
  const rotation = input.localRotation ?? IDENTITY_QUAT;
  const colorSlots = input.colorSlots ?? ['primary'];
  const left: AvatarPartDefinition = {
    id: `${input.baseId}_L`,
    displayName: `${input.displayName} (L)`,
    slot: input.slotLeft,
    joint: input.jointLeft,
    mesh,
    localPosition: cloneVec3(input.localPosition),
    localRotation: cloneQuat(rotation),
    localScale: cloneVec3(input.localScale),
    defaultColor: input.defaultColor,
    colorSlots,
    ...(input.defaultMaterial ? { defaultMaterial: input.defaultMaterial } : {}),
  };

  const right: AvatarPartDefinition = {
    id: `${input.baseId}_R`,
    displayName: `${input.displayName} (R)`,
    slot: input.slotRight,
    joint: input.jointRight,
    mesh,
    localPosition: mirrorX(input.localPosition),
    localRotation: cloneQuat(rotation),
    localScale: cloneVec3(input.localScale),
    defaultColor: input.defaultColor,
    colorSlots,
    ...(input.defaultMaterial ? { defaultMaterial: input.defaultMaterial } : {}),
  };

  return [left, right];
}

const DEFAULT_PART_DEFINITIONS: AvatarPartDefinition[] = [
  {
    id: 'head_default',
    displayName: 'Classic Head',
    slot: 'HeadSlot',
    joint: 'Head',
    mesh: 'sphere',
    localPosition: [0, 0.12, 0],
    localRotation: IDENTITY_QUAT,
    localScale: [0.28, 0.28, 0.28],
    defaultColor: COLOR_SKIN,
    colorSlots: ['primary'],
  },
  {
    id: 'face_overlay_default',
    displayName: 'Face Overlay',
    slot: 'FaceOverlaySlot',
    joint: 'Head',
    mesh: 'cube',
    localPosition: [0, 0.02, 0.18],
    localRotation: IDENTITY_QUAT,
    localScale: [0.22, 0.16, 0.01],
    defaultColor: COLOR_ACCENT,
    colorSlots: ['primary'],
  },
  {
    id: 'neck_default',
    displayName: 'Neck',
    slot: 'NeckSlot',
    joint: 'Neck',
    mesh: 'cube',
    localPosition: [0, 0.1, 0],
    localRotation: IDENTITY_QUAT,
    localScale: [0.15, 0.2, 0.15],
    defaultColor: COLOR_SKIN,
    colorSlots: ['primary'],
  },
  {
    id: 'hair_default',
    displayName: 'Short Hair',
    slot: 'HairSlot',
    joint: 'Head',
    mesh: 'cube',
    localPosition: [0, 0.24, -0.02],
    localRotation: IDENTITY_QUAT,
    localScale: [0.38, 0.26, 0.36],
    defaultColor: COLOR_HAIR,
    colorSlots: ['primary'],
  },
  {
    id: 'torso_default',
    displayName: 'Heroic Torso',
    slot: 'TorsoSlot',
    joint: 'Chest',
    mesh: 'avatar_torso',
    localPosition: [0, -0.05, 0],
    localRotation: IDENTITY_QUAT,
    localScale: [0.4, 0.55, 0.24],
    defaultColor: COLOR_SHIRT,
    colorSlots: ['primary'],
    // Style ABI: shoulderShelfWidthX ≈ 1.35 * torsoCoreWidthX
    // Shoulder shelf provides 5-10% visual overlap with UpperArm joints
    // Creates heroic action-figure silhouette with clean arm attachment points
  },
  ...createMirroredParts({
    baseId: 'upper_arm_default',
    displayName: 'Upper Arm',
    slotLeft: 'UpperArmSlotL',
    slotRight: 'UpperArmSlotR',
    jointLeft: 'Arm.L.Upper',
    jointRight: 'Arm.R.Upper',
    localPosition: [0, -0.23, 0],
    localScale: [0.16, 0.45, 0.18],
    defaultColor: COLOR_SHIRT,
  }),
  ...createMirroredParts({
    baseId: 'lower_arm_default',
    displayName: 'Lower Arm',
    slotLeft: 'LowerArmSlotL',
    slotRight: 'LowerArmSlotR',
    jointLeft: 'Arm.L.Lower',
    jointRight: 'Arm.R.Lower',
    localPosition: [0, -0.22, 0],
    localScale: [0.15, 0.4, 0.17],
    defaultColor: COLOR_SKIN,
  }),
  ...createMirroredParts({
    baseId: 'hand_default',
    displayName: 'Hand',
    slotLeft: 'HandSlotL',
    slotRight: 'HandSlotR',
    jointLeft: 'Hand.L',
    jointRight: 'Hand.R',
    localPosition: [0, -0.1, 0],
    localScale: [0.18, 0.18, 0.2],
    defaultColor: COLOR_SKIN,
  }),
  ...createMirroredParts({
    baseId: 'upper_leg_default',
    displayName: 'Upper Leg',
    slotLeft: 'UpperLegSlotL',
    slotRight: 'UpperLegSlotR',
    jointLeft: 'Leg.L.Upper',
    jointRight: 'Leg.R.Upper',
    localPosition: [0, -0.25, 0],
    localScale: [0.22, 0.42, 0.22],
    defaultColor: COLOR_PANTS,
  }),
  ...createMirroredParts({
    baseId: 'lower_leg_default',
    displayName: 'Lower Leg',
    slotLeft: 'LowerLegSlotL',
    slotRight: 'LowerLegSlotR',
    jointLeft: 'Leg.L.Lower',
    jointRight: 'Leg.R.Lower',
    localPosition: [0, -0.24, 0],
    localScale: [0.2, 0.4, 0.2],
    defaultColor: COLOR_PANTS,
  }),
  ...createMirroredParts({
    baseId: 'foot_default',
    displayName: 'Foot',
    slotLeft: 'FootSlotL',
    slotRight: 'FootSlotR',
    jointLeft: 'Foot.L',
    jointRight: 'Foot.R',
    localPosition: [0, -0.05, 0.12],
    localScale: [0.24, 0.12, 0.3],
    defaultColor: COLOR_SHOE,
  }),
  {
    id: 'backpack_default',
    displayName: 'Backpack',
    slot: 'BackSlot',
    joint: 'Chest',
    mesh: 'cube',
    localPosition: [0, -0.1, -0.18],
    localRotation: IDENTITY_QUAT,
    localScale: [0.32, 0.45, 0.18],
    defaultColor: COLOR_SHIRT,
    colorSlots: ['primary'],
  },
  {
    id: 'head_fx_default',
    displayName: 'Halo',
    slot: 'HeadFXSlot',
    joint: 'Head',
    mesh: 'sphere',
    localPosition: [0, 0.36, 0],
    localRotation: IDENTITY_QUAT,
    localScale: [0.45, 0.06, 0.45],
    defaultColor: COLOR_ACCENT,
    colorSlots: ['primary'],
  },
  ...createMirroredParts({
    baseId: 'handheld_default',
    displayName: 'Handheld',
    slotLeft: 'HandheldSlotL',
    slotRight: 'HandheldSlotR',
    jointLeft: 'Hand.L',
    jointRight: 'Hand.R',
    localPosition: [0, -0.05, 0.2],
    localScale: [0.1, 0.3, 0.1],
    defaultColor: COLOR_ACCENT,
  }),
];

export const DEFAULT_AVATAR_PART_DEFINITIONS: readonly AvatarPartDefinition[] =
  DEFAULT_PART_DEFINITIONS.map(clonePartDefinition);

