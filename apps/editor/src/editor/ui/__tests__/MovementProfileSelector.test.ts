/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMovementProfileSelector } from '../MovementProfileSelector';
import { PRESET_PROFILES, MovementProfileRegistry } from '@engine/stdlib/MovementProfiles';

describe('MovementProfileSelector', () => {
  beforeEach(() => {
    // Reset registry
    (MovementProfileRegistry as any).instance = null;
  });

  it('creates selector with preset profiles', () => {
    const selector = createMovementProfileSelector();

    expect(selector.element).toBeTruthy();
    expect(selector.select).toBeTruthy();
    expect(selector.select.options.length).toBeGreaterThan(0);
  });

  it('sets selected profile correctly', () => {
    const selector = createMovementProfileSelector({
      selectedProfileId: 'fast-human',
    });

    expect(selector.select.value).toBe('fast-human');
    expect(selector.getSelectedProfile()?.id).toBe('fast-human');
  });

  it('calls onProfileSelected when profile changes', () => {
    const onProfileSelected = vi.fn();
    const selector = createMovementProfileSelector({
      onProfileSelected,
    });

    selector.select.value = 'flying-human';
    selector.select.dispatchEvent(new Event('change'));

    expect(onProfileSelected).toHaveBeenCalled();
    expect(onProfileSelected.mock.calls[0]![0].id).toBe('flying-human');
  });

  it('includes custom profiles when includeCustom is true', () => {
    const registry = MovementProfileRegistry.getInstance();
    const customProfile = PRESET_PROFILES.HUMAN.clone();
    customProfile.id = 'custom-test';
    customProfile.name = 'Custom Test';
    registry.register(customProfile);

    const selector = createMovementProfileSelector({
      includeCustom: true,
    });

    const options = Array.from(selector.select.options).map(opt => opt.value);
    expect(options).toContain('custom-test');
  });

  it('excludes custom profiles when includeCustom is false', () => {
    const registry = MovementProfileRegistry.getInstance();
    const customProfile = PRESET_PROFILES.HUMAN.clone();
    customProfile.id = 'custom-test';
    customProfile.name = 'Custom Test';
    registry.register(customProfile);

    const selector = createMovementProfileSelector({
      includeCustom: false,
    });

    const options = Array.from(selector.select.options).map(opt => opt.value);
    expect(options).not.toContain('custom-test');
  });

  it('setSelectedProfile updates select value', () => {
    const selector = createMovementProfileSelector();

    selector.setSelectedProfile('slow-human');
    expect(selector.select.value).toBe('slow-human');
    expect(selector.getSelectedProfile()?.id).toBe('slow-human');
  });
});

