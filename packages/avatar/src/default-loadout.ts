import type { AvatarLoadout } from './avatar-instance';

export const DEFAULT_AVATAR_LOADOUT: AvatarLoadout = {
  version: 2, // Current version
  parts: {
    HeadSlot: { mesh: 'head_default' },
    FaceOverlaySlot: { mesh: 'face_overlay_default', colors: { primary: [0, 0, 0, 0.85] } },
    NeckSlot: { mesh: 'neck_default' },
    HairSlot: { mesh: 'hair_default' },
    TorsoSlot: { mesh: 'torso_default' },
    UpperArmSlotL: { mesh: 'upper_arm_default_L' },
    UpperArmSlotR: { mesh: 'upper_arm_default_R' },
    LowerArmSlotL: { mesh: 'lower_arm_default_L' },
    LowerArmSlotR: { mesh: 'lower_arm_default_R' },
    HandSlotL: { mesh: 'hand_default_L' },
    HandSlotR: { mesh: 'hand_default_R' },
    UpperLegSlotL: { mesh: 'upper_leg_default_L' },
    UpperLegSlotR: { mesh: 'upper_leg_default_R' },
    LowerLegSlotL: { mesh: 'lower_leg_default_L' },
    LowerLegSlotR: { mesh: 'lower_leg_default_R' },
    FootSlotL: { mesh: 'foot_default_L' },
    FootSlotR: { mesh: 'foot_default_R' },
    BackSlot: { mesh: 'backpack_default' },
  },
};

