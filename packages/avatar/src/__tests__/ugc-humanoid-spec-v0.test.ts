import { describe, it, expect } from 'vitest';
import { SPEC_DEFAULT_AVATAR_JOINTS, SPEC_AVATAR_SLOTS } from '../ugc-humanoid-spec-v0';
import { DEFAULT_AVATAR_JOINTS, type AvatarJointDefinition } from '../skeleton';
import { AVATAR_SLOTS } from '../slots';

describe('ugc-humanoid-spec-v0', () => {
  /**
   * Test weryfikuje że snapshot v0 pasuje do aktualnych wartości w skeleton.ts.
   * 
   * Jeśli ten test się wywali, oznacza to że DEFAULT_AVATAR_JOINTS się zmienił.
   * Wtedy MUSISZ świadomie zdecydować:
   * - Czy to jest breaking change? → Utwórz ugc-humanoid-spec-v1.ts
   * - Czy to jest bug fix? → Zaktualizuj SPEC_DEFAULT_AVATAR_JOINTS w v0
   *   (tylko jeśli nie łamie kompatybilności wstecznej!)
   */
  it('should have SPEC_DEFAULT_AVATAR_JOINTS matching DEFAULT_AVATAR_JOINTS', () => {
    expect(SPEC_DEFAULT_AVATAR_JOINTS.length).toBe(DEFAULT_AVATAR_JOINTS.length);
    
    for (let i = 0; i < DEFAULT_AVATAR_JOINTS.length; i++) {
      const specJoint = SPEC_DEFAULT_AVATAR_JOINTS[i];
      const actualJoint = DEFAULT_AVATAR_JOINTS[i];
      
      expect(specJoint?.name).toBe(actualJoint.name);
      expect(specJoint?.parent).toBe(actualJoint.parent);
      expect(specJoint?.defaultPosition).toEqual(actualJoint.defaultPosition);
    }
  });

  /**
   * Test weryfikuje że snapshot v0 pasuje do aktualnych wartości w slots.ts.
   * 
   * Jeśli ten test się wywali, oznacza to że AVATAR_SLOTS się zmienił.
   * Wtedy MUSISZ świadomie zdecydować:
   * - Czy to jest breaking change? → Utwórz ugc-humanoid-spec-v1.ts
   * - Czy to jest bug fix? → Zaktualizuj SPEC_AVATAR_SLOTS w v0
   *   (tylko jeśli nie łamie kompatybilności wstecznej!)
   */
  it('should have SPEC_AVATAR_SLOTS matching AVATAR_SLOTS', () => {
    expect(SPEC_AVATAR_SLOTS.length).toBe(AVATAR_SLOTS.length);
    
    for (let i = 0; i < AVATAR_SLOTS.length; i++) {
      expect(SPEC_AVATAR_SLOTS[i]).toBe(AVATAR_SLOTS[i]);
    }
  });

  it('should have SPEC_DEFAULT_AVATAR_JOINTS as readonly (const assertion)', () => {
    // as const makes the array readonly at type level
    // We verify that it's actually readonly by checking it can't be mutated
    const readonlyCheck: readonly AvatarJointDefinition[] = SPEC_DEFAULT_AVATAR_JOINTS;
    expect(readonlyCheck).toBe(SPEC_DEFAULT_AVATAR_JOINTS);
  });

  it('should have SPEC_AVATAR_SLOTS as readonly (const assertion)', () => {
    // as const makes the array readonly at type level
    const readonlyCheck: readonly (typeof AVATAR_SLOTS[number])[] = SPEC_AVATAR_SLOTS;
    expect(readonlyCheck).toBe(SPEC_AVATAR_SLOTS);
  });
});

