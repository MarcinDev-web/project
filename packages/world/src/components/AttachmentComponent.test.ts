import { describe, it, expect, beforeEach } from 'vitest';
import { AttachmentComponent } from './AttachmentComponent';
import { getAttachment } from '../data/attachments';

describe('AttachmentComponent', () => {
  let attachment: AttachmentComponent;

  beforeEach(() => {
    attachment = new AttachmentComponent();
  });

  it('should create empty attachment component', () => {
    expect(attachment.getAllAttachments()).toHaveLength(0);
  });

  it('should add attachment', () => {
    const redDot = getAttachment('red_dot');
    expect(redDot).toBeDefined();
    if (redDot) {
      const added = attachment.addAttachment(redDot);
      expect(added).toBe(true);
      expect(attachment.hasAttachment('scope')).toBe(true);
      expect(attachment.getAttachment('scope')).toBe(redDot);
    }
  });

  it('should not add duplicate attachment type', () => {
    const redDot = getAttachment('red_dot');
    const acog = getAttachment('acog');
    if (redDot && acog) {
      attachment.addAttachment(redDot);
      const added = attachment.addAttachment(acog); // Should replace or fail
      // Current implementation: returns false if slot occupied
      expect(added).toBe(false);
    }
  });

  it('should remove attachment', () => {
    const redDot = getAttachment('red_dot');
    if (redDot) {
      attachment.addAttachment(redDot);
      const removed = attachment.removeAttachment('scope');
      expect(removed).toBe(redDot);
      expect(attachment.hasAttachment('scope')).toBe(false);
    }
  });

  it('should calculate effective stats from attachments', () => {
    const redDot = getAttachment('red_dot');
    if (redDot) {
      attachment.addAttachment(redDot);
      const stats = attachment.getEffectiveStats();
      expect(stats.spreadMultiplier).toBeLessThan(1.0); // Should reduce spread
      expect(stats.damageMultiplier).toBe(1.0); // No damage change for red dot
    }
  });

  it('should combine multiple attachment modifiers', () => {
    const verticalGrip = getAttachment('vertical_grip');
    const extendedMag = getAttachment('extended_mag');
    if (verticalGrip && extendedMag) {
      attachment.addAttachment(verticalGrip);
      attachment.addAttachment(extendedMag);
      const stats = attachment.getEffectiveStats();
      expect(stats.maxAmmoMultiplier).toBeGreaterThan(1.0);
      expect(stats.spreadMultiplier).toBeLessThan(1.0);
    }
  });
});
