/**
 * Movement Profile Selector Component
 * 
 * Reusable component for selecting and displaying movement profiles
 */

import type { MovementProfile } from '@engine/stdlib/MovementProfiles';
import { MovementProfileRegistry, PRESET_PROFILES } from '@engine/stdlib/MovementProfiles';

export interface MovementProfileSelectorOptions {
  selectedProfileId?: string | null;
  onProfileSelected?: (profile: MovementProfile) => void;
  includeCustom?: boolean;
}

/**
 * Create a movement profile selector dropdown
 */
export function createMovementProfileSelector(options: MovementProfileSelectorOptions = {}): {
  element: HTMLElement;
  select: HTMLSelectElement;
  getSelectedProfile: () => MovementProfile | null;
  setSelectedProfile: (profileId: string) => void;
} {
  const container = document.createElement('div');
  container.className = 'movement-profile-selector';

  const select = document.createElement('select');
  select.className = 'property-select';

  const registry = MovementProfileRegistry.getInstance();

  // Add preset profiles
  const presetOptions = [
    { value: 'human', label: 'Human (Default)', profile: PRESET_PROFILES.HUMAN },
    { value: 'fast-human', label: 'Fast Human', profile: PRESET_PROFILES.FAST_HUMAN },
    { value: 'slow-human', label: 'Slow Human', profile: PRESET_PROFILES.SLOW_HUMAN },
    { value: 'heavy-human', label: 'Heavy Human', profile: PRESET_PROFILES.HEAVY_HUMAN },
    { value: 'agile-human', label: 'Agile Human', profile: PRESET_PROFILES.AGILE_HUMAN },
    { value: 'flying-human', label: 'Flying Human', profile: PRESET_PROFILES.FLYING_HUMAN },
    { value: 'speed-boost-human', label: 'Speed Boost Human', profile: PRESET_PROFILES.SPEED_BOOST_HUMAN },
    { value: 'vehicle-mode', label: 'Vehicle Mode', profile: PRESET_PROFILES.VEHICLE_MODE },
  ];

  presetOptions.forEach(({ value, label, profile }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (options.selectedProfileId === profile.id) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  // Add custom profiles if requested
  if (options.includeCustom !== false) {
    const allProfiles = registry.getAll();
    const customProfiles = allProfiles.filter(p => 
      !presetOptions.some(po => po.profile.id === p.id)
    );

    if (customProfiles.length > 0) {
      const separator = document.createElement('option');
      separator.disabled = true;
      separator.textContent = '── Custom Profiles ──';
      select.appendChild(separator);

      customProfiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name;
        if (options.selectedProfileId === profile.id) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }
  }

  select.addEventListener('change', () => {
    const selectedId = select.value;
    const profile = registry.get(selectedId) || presetOptions.find(po => po.value === selectedId)?.profile;
    if (profile && options.onProfileSelected) {
      options.onProfileSelected(profile);
    }
  });

  container.appendChild(select);

  return {
    element: container,
    select,
    getSelectedProfile: (): MovementProfile | null => {
      const selectedId = select.value;
      return registry.get(selectedId) || presetOptions.find(po => po.value === selectedId)?.profile || null;
    },
    setSelectedProfile: (profileId: string): void => {
      select.value = profileId;
    },
  };
}

