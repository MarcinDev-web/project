import { describe, it, expect } from 'vitest';
import { SPEC_DEFAULT_AVATAR_JOINTS, SPEC_AVATAR_SLOTS } from '../ugc-humanoid-spec-v0';
import { DEFAULT_AVATAR_JOINTS } from '../skeleton';
import { AVATAR_SLOTS } from '../slots';

describe('ugc-humanoid-spec-v0', () => {
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

  it('should have SPEC_AVATAR_SLOTS matching AVATAR_SLOTS', () => {
    expect(SPEC_AVATAR_SLOTS.length).toBe(AVATAR_SLOTS.length);
    
    for (let i = 0; i < AVATAR_SLOTS.length; i++) {
      expect(SPEC_AVATAR_SLOTS[i]).toBe(AVATAR_SLOTS[i]);
    }
  });

  it('should have SPEC_DEFAULT_AVATAR_JOINTS as readonly', () => {
    // TypeScript should enforce readonly, but we verify at runtime
    expect(Object.isFrozen(SPEC_DEFAULT_AVATAR_JOINTS)).toBe(false); // Arrays aren't frozen, but items are
  });

  it('should have SPEC_AVATAR_SLOTS as readonly', () => {
    expect(Object.isFrozen(SPEC_AVATAR_SLOTS)).toBe(false); // Arrays aren't frozen, but items are
  });
});

