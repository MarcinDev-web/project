import type { Vec3, Quat } from '@engine/core/math';
import { Entity } from '@engine/world';
import { AvatarAnimationPlayer, type AvatarAnimation } from './animation';
import {
  AVATAR_SLOTS,
  type AvatarPartDefinition,
  type AvatarPartLibrary,
  type AvatarSlot,
} from './slots';
import { AvatarSkeleton, DEFAULT_AVATAR_JOINTS, type AvatarJointName } from './skeleton';
import type { RgbaColor } from '@engine/world';
import {
  cloneColorRecord,
  cloneVec3,
  cloneQuat,
  clonePartDefinition,
} from './utils/clone';
import { AvatarMeshGenerator } from './mesh/avatar-mesh-generator';
import { AvatarMaterialManager } from './material/avatar-material-manager';
import { AvatarColorManager } from './color/avatar-color-manager';
import { AvatarPartMountManager } from './mount/avatar-part-mount-manager';
import { AvatarLoadoutSerializer } from './serialization/avatar-loadout-serializer';

interface AvatarPartSelectionState {
  id: string;
  definition: AvatarPartDefinition;
  colors?: Record<string, RgbaColor>;
  materialId?: string;
  appliedColors?: Record<string, RgbaColor>;
}

export interface AvatarMaterialBinding {
  readonly materialId?: number;
  readonly color?: RgbaColor;
  readonly metallic?: number;
  readonly roughness?: number;
}

export interface AvatarLoadoutPart {
  mesh: string;
  mat?: string;
  material?: string;
  colors?: Record<string, RgbaColor>;
}

export interface AvatarLoadout {
  readonly version: number;
  readonly parts: Partial<Record<AvatarSlot, AvatarLoadoutPart>>;
}

export type AvatarMaterialResolver = (id: string) => AvatarMaterialBinding | null | undefined;

export interface AvatarInstanceOptions {
  readonly name?: string;
  readonly partLibrary?: AvatarPartLibrary;
  readonly loadout?: AvatarLoadout;
  readonly materialResolver?: AvatarMaterialResolver;
}

export class AvatarInstance {
  private readonly root: Entity;
  private readonly skeleton: AvatarSkeleton;
  private readonly animator: AvatarAnimationPlayer;
  private readonly partLibrary: AvatarPartLibrary;
  private readonly jointEntities = new Map<AvatarJointName, Entity>();
  private readonly slotEntities = new Map<AvatarSlot, Entity>();
  private readonly selections = new Map<AvatarSlot, AvatarPartSelectionState>();
  private readonly meshGenerator: AvatarMeshGenerator;
  private readonly materialManager: AvatarMaterialManager;
  private readonly colorManager: AvatarColorManager;
  private readonly mountManager: AvatarPartMountManager;
  private readonly serializer: AvatarLoadoutSerializer;

  constructor(parent: Entity, options: AvatarInstanceOptions = {}) {
    this.root = new Entity(options.name ?? 'AvatarInstanceRoot');
    this.root.userData.isAvatarInstanceRoot = true;
    parent.addChild(this.root);

    this.partLibrary = options.partLibrary ?? DEFAULT_AVATAR_PART_LIBRARY;
    this.skeleton = new AvatarSkeleton(DEFAULT_AVATAR_JOINTS);
    this.animator = new AvatarAnimationPlayer(this.skeleton);

    // Initialize managers
    this.meshGenerator = new AvatarMeshGenerator();
    this.materialManager = new AvatarMaterialManager(options.materialResolver);
    this.colorManager = new AvatarColorManager();
    this.mountManager = new AvatarPartMountManager(
      this.jointEntities,
      this.slotEntities,
      this.meshGenerator,
      this.materialManager,
      this.colorManager,
    );
    this.serializer = new AvatarLoadoutSerializer();

    this.buildSkeletonEntities();
    this.applyLoadout(options.loadout ?? DEFAULT_AVATAR_LOADOUT);
  }

  getRootEntity(): Entity {
    return this.root;
  }

  getSkeleton(): AvatarSkeleton {
    return this.skeleton;
  }

  getAnimator(): AvatarAnimationPlayer {
    return this.animator;
  }

  update(deltaTime: number): void {
    this.animator.update(deltaTime);
    this.syncJointEntities();
  }

  playAnimation(animation: AvatarAnimation, startTime = 0): void {
    this.animator.play(animation, startTime);
    this.syncJointEntities();
  }

  stopAnimation(): void {
    this.animator.stop();
  }

  dispose(): void {
    for (const slot of this.slotEntities.keys()) {
      this.mountManager.unmountSlot(slot);
    }
    this.slotEntities.clear();
    const parent = this.root.parent;
    if (parent) {
      parent.removeChild(this.root);
    }
  }

  applyLoadout(loadout: AvatarLoadout): void {
    for (const slot of AVATAR_SLOTS) {
      const part = loadout.parts?.[slot] ?? null;
      this.setSlot(slot, part);
    }
    this.syncJointEntities();
  }

  setSlot(slot: AvatarSlot, part: AvatarLoadoutPart | null): void {
    this.mountManager.unmountSlot(slot);
    if (!part) {
      this.selections.delete(slot);
      return;
    }

    const definition = this.resolveDefinition(slot, part.mesh);
    if (!definition) {
      console.warn(`[AvatarInstance] Missing definition for slot ${slot} part "${part.mesh}"`);
      this.selections.delete(slot);
      return;
    }

    const colors = part.colors ? cloneColorRecord(part.colors) : undefined;
    const materialId = part.material ?? part.mat ?? definition.defaultMaterial;
    const selection: AvatarPartSelectionState = {
      id: part.mesh,
      definition,
      ...(colors ? { colors } : {}),
      ...(materialId ? { materialId } : {}),
    };
    this.selections.set(slot, selection);
    this.mountManager.mountPart(selection);
  }

  serializeLoadout(): AvatarLoadout {
    return this.serializer.serialize(this.selections);
  }

  ownsEntity(entity: Entity | null | undefined): boolean {
    if (!entity) return false;
    if (entity === this.root) return true;
    let current: Entity | null = entity;
    while (current) {
      if (current === this.root) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Set slot visibility (for hiding head in FPS mode, etc.)
   */
  setSlotVisible(slot: AvatarSlot, visible: boolean): void {
    const slotEntity = this.slotEntities.get(slot);
    if (slotEntity) {
      slotEntity.active = visible;
    }
  }

  /**
   * Get slot entity (for external manipulation)
   */
  getSlotEntity(slot: AvatarSlot): Entity | undefined {
    return this.slotEntities.get(slot);
  }

  syncJointEntities(): void {
    this.skeleton.forEachJoint((name) => {
      const jointEntity = this.jointEntities.get(name);
      if (!jointEntity) {
        return;
      }
      const local = this.skeleton.getLocalTransform(name);
      jointEntity.transform.position = local.position;
      jointEntity.transform.rotation = local.rotation;
    });
  }

  private buildSkeletonEntities(): void {
    this.skeleton.forEachJoint((name, parentName) => {
      const entity = new Entity(`AvatarJoint:${name}`);
      entity.userData.avatarJoint = name;
      const local = this.skeleton.getLocalTransform(name);
      entity.transform.position = local.position;
      entity.transform.rotation = local.rotation;
      entity.transform.scale = [1, 1, 1];

      if (parentName) {
        const parentEntity = this.jointEntities.get(parentName);
        if (!parentEntity) {
          throw new Error(`Parent joint entity "${parentName}" missing for "${name}"`);
        }
        parentEntity.addChild(entity);
      } else {
        this.root.addChild(entity);
      }
      this.jointEntities.set(name, entity);
    });
  }


  private resolveDefinition(slot: AvatarSlot, id: string): AvatarPartDefinition | null {
    const definition = this.partLibrary[id];
    if (!definition) {
      return null;
    }
    if (definition.slot !== slot) {
      console.warn(
        `[AvatarInstance] Part "${id}" is registered for ${definition.slot}, cannot mount to ${slot}`,
      );
      return null;
    }
    return definition;
  }
}

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

const COLOR_SKIN: RgbaColor = [0.95, 0.82, 0.74, 1];
const COLOR_HAIR: RgbaColor = [0.2, 0.12, 0.06, 1];
const COLOR_SHIRT: RgbaColor = [0.22, 0.36, 0.76, 1];
const COLOR_PANTS: RgbaColor = [0.2, 0.22, 0.28, 1];
const COLOR_SHOE: RgbaColor = [0.1, 0.1, 0.1, 1];
const COLOR_ACCENT: RgbaColor = [0.84, 0.18, 0.28, 1];

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

export function createAvatarPartLibrary(
  definitions: Iterable<AvatarPartDefinition>,
): AvatarPartLibrary {
  const library: AvatarPartLibrary = {};
  for (const definition of definitions) {
    const normalized = clonePartDefinition(definition);
    if (library[normalized.id]) {
      throw new Error(`Duplicate avatar part definition "${normalized.id}" detected.`);
    }
    library[normalized.id] = normalized;
  }
  return library;
}

export const DEFAULT_AVATAR_PART_LIBRARY: AvatarPartLibrary = createAvatarPartLibrary(
  DEFAULT_AVATAR_PART_DEFINITIONS,
);

export const DEFAULT_AVATAR_LOADOUT: AvatarLoadout = {
  version: 1,
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

interface MirroredPartInput {
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

function createMirroredParts(input: MirroredPartInput): AvatarPartDefinition[] {
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

function mirrorX(vec: Vec3): Vec3 {
  return [-vec[0], vec[1], vec[2]] as Vec3;
}

