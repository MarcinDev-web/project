/**
 * ugc-humanoid-spec-v0.ts
 *
 * To jest zamrożona publiczna specyfikacja humanoida.
 * To jest ABI (Application Binary Interface) Twojego awatara.
 *
 * Cokolwiek tu jest:
 * - nazwy kości i hierarchia,
 * - nazwy slotów i ich przypięcie do kości,
 * - proporcje sylwetki,
 *
 * jest OBIECANE twórcom UGC. Nie zmieniasz tego wstecznie,
 * bo to by złamało kompatybilność modeli, animacji i itemów graczy.
 *
 * Jeśli będziesz potrzebować zmian typu "dodajemy ShoulderPadSlotL",
 * tworzysz ugc-humanoid-spec-v1.ts z nowymi rzeczami,
 * ale v0 zostaje nienaruszone.
 */

export const UGC_HUMANOID_SPEC_VERSION = 'v0';

/**
 * Wysokość referencyjna awatara (w jednostkach świata).
 * Używana do projektowania map, drzwi, schodków, hitboxów itd.
 */
export const AVATAR_REFERENCE_HEIGHT = 1.8;

/**
 * Styl sylwetki:
 * Barki są ~1.35 szerokości torsu bazowego, z lekkim zachodzeniem (ok. 5-10%)
 * żeby silhouette była czytelna z daleka i wyglądała bardziej heroicznie niż realistycznie.
 *
 * To też jest część tożsamości wizualnej platformy (rozpoznawalny styl).
 */
export const HEROIC_SHOULDER_TO_TORSO_RATIO = 1.35;
export const HEROIC_SHOULDER_OVERLAP = 0.08; // ~8%

/**
 * Snapshot kości, 1:1 z DEFAULT_AVATAR_JOINTS W MOMENCIE PUBLIKACJI.
 * Wklej tutaj literalnie tablicę AvatarJointDef[] z skeleton.ts
 * tak jak wygląda TERAZ (v0) i potem nie dotykaj.
 */
export const SPEC_DEFAULT_AVATAR_JOINTS = [
  { name: 'Root', parent: null, defaultPosition: [0, 0, 0] },
  { name: 'Hips', parent: 'Root', defaultPosition: [0, 0.9, 0] },
  { name: 'Spine', parent: 'Hips', defaultPosition: [0, 0.2, 0] },
  { name: 'Chest', parent: 'Spine', defaultPosition: [0, 0.25, 0] },
  { name: 'Neck', parent: 'Chest', defaultPosition: [0, 0.2, 0] },
  { name: 'Head', parent: 'Neck', defaultPosition: [0, 0.25, 0] },
  { name: 'Arm.L.Upper', parent: 'Chest', defaultPosition: [0.35, 0.1, 0] },
  { name: 'Arm.L.Lower', parent: 'Arm.L.Upper', defaultPosition: [0, -0.45, 0] },
  { name: 'Hand.L', parent: 'Arm.L.Lower', defaultPosition: [0, -0.35, 0] },
  { name: 'Arm.R.Upper', parent: 'Chest', defaultPosition: [-0.35, 0.1, 0] },
  { name: 'Arm.R.Lower', parent: 'Arm.R.Upper', defaultPosition: [0, -0.45, 0] },
  { name: 'Hand.R', parent: 'Arm.R.Lower', defaultPosition: [0, -0.35, 0] },
  { name: 'Leg.L.Upper', parent: 'Hips', defaultPosition: [0.18, -0.45, 0] },
  { name: 'Leg.L.Lower', parent: 'Leg.L.Upper', defaultPosition: [0, -0.45, 0] },
  { name: 'Foot.L', parent: 'Leg.L.Lower', defaultPosition: [0, -0.05, 0.1] },
  { name: 'Leg.R.Upper', parent: 'Hips', defaultPosition: [-0.18, -0.45, 0] },
  { name: 'Leg.R.Lower', parent: 'Leg.R.Upper', defaultPosition: [0, -0.45, 0] },
  { name: 'Foot.R', parent: 'Leg.R.Lower', defaultPosition: [0, -0.05, 0.1] },
] as const;

/**
 * Snapshot slotów, 1:1 z AVATAR_SLOTS w momencie publikacji.
 * To jest oficjalna lista slotów, po których UGC może targetować części, kosmetyki i bronie.
 */
export const SPEC_AVATAR_SLOTS = [
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
