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
 *
 * IMPLEMENTACJA:
 * =============
 * Ten plik zawiera HARDCODED snapshot wartości z momentu publikacji v0.
 * Wartości są niezależne od skeleton.ts i slots.ts - to zapewnia że v0
 * pozostaje prawdziwie zamrożone nawet jeśli źródło się zmieni.
 *
 * Test weryfikuje że snapshot pasuje do aktualnych wartości w skeleton.ts/slots.ts.
 * Jeśli źródło się zmieni, test się wywali - wtedy MUSISZ świadomie zdecydować:
 * - Czy to jest breaking change? → Utwórz v1 spec
 * - Czy to jest bug fix? → Zaktualizuj v0 (tylko jeśli nie łamie kompatybilności)
 *
 * Duplikacja danych jest zamierzona - snapshot MUSI być niezależny.
 */

import type { AvatarJointDefinition } from './skeleton';

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
 * Snapshot kości, 1:1 z DEFAULT_AVATAR_JOINTS W MOMENCIE PUBLIKACJI v0.
 * 
 * ⚠️ UWAGA: Te wartości są HARDCODED i NIE ZMIENIAJĄ SIĘ nawet jeśli
 * DEFAULT_AVATAR_JOINTS w skeleton.ts się zmieni. To jest zamierzone -
 * v0 jest prawdziwie zamrożonym snapshotem dla kompatybilności wstecznej.
 * 
 * Jeśli chcesz zmienić te wartości, MUSISZ utworzyć nową wersję spec (v1).
 * 
 * Test weryfikuje że snapshot pasuje do aktualnych wartości w skeleton.ts.
 */
export const SPEC_DEFAULT_AVATAR_JOINTS: readonly AvatarJointDefinition[] = [
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
 * Snapshot slotów, 1:1 z AVATAR_SLOTS w momencie publikacji v0.
 * To jest oficjalna lista slotów, po których UGC może targetować części, kosmetyki i bronie.
 * 
 * ⚠️ UWAGA: Te wartości są HARDCODED i NIE ZMIENIAJĄ SIĘ nawet jeśli
 * AVATAR_SLOTS w slots.ts się zmieni. To jest zamierzone -
 * v0 jest prawdziwie zamrożonym snapshotem dla kompatybilności wstecznej.
 * 
 * Jeśli chcesz zmienić te wartości, MUSISZ utworzyć nową wersję spec (v1).
 * 
 * Test weryfikuje że snapshot pasuje do aktualnych wartości w slots.ts.
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
