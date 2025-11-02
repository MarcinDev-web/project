import type { MovementProfile } from './MovementProfile';

/**
 * Profile Switcher - Manages switching between movement profiles
 * 
 * Provides convenient methods to cycle through profiles or switch to specific ones.
 * Useful for gameplay mechanics that allow players to change movement modes.
 */
export class ProfileSwitcher {
  private profiles: readonly MovementProfile[];
  private currentProfileIndex: number = 0;

  /**
   * Create a ProfileSwitcher with a list of profiles
   * 
   * @param profiles - Array of profiles to switch between
   * @param initialIndex - Initial profile index (default: 0)
   */
  constructor(
    profiles: readonly MovementProfile[],
    initialIndex: number = 0
  ) {
    if (profiles.length === 0) {
      throw new Error('ProfileSwitcher requires at least one profile');
    }

    this.profiles = profiles;
    this.currentProfileIndex = Math.max(0, Math.min(initialIndex, profiles.length - 1));
  }

  /**
   * Switch to the next profile in the list (cycles back to first)
   */
  switchToNext(): MovementProfile {
    this.currentProfileIndex = (this.currentProfileIndex + 1) % this.profiles.length;
    const profile = this.profiles[this.currentProfileIndex];
    if (!profile) {
      throw new Error('Profile not found at index');
    }
    return profile;
  }

  /**
   * Switch to the previous profile in the list (cycles back to last)
   */
  switchToPrevious(): MovementProfile {
    this.currentProfileIndex = (this.currentProfileIndex - 1 + this.profiles.length) % this.profiles.length;
    const profile = this.profiles[this.currentProfileIndex];
    if (!profile) {
      throw new Error('Profile not found at index');
    }
    return profile;
  }

  /**
   * Switch to a specific profile by ID
   * 
   * @param profileId - ID of the profile to switch to
   * @returns The switched profile, or null if not found
   */
  switchTo(profileId: string): MovementProfile | null {
    const index = this.profiles.findIndex(p => p.id === profileId);
    if (index === -1) {
      return null;
    }

    this.currentProfileIndex = index;
    const profile = this.profiles[index];
    return profile ?? null;
  }

  /**
   * Get the current active profile
   */
  getCurrentProfile(): MovementProfile {
    const profile = this.profiles[this.currentProfileIndex];
    if (!profile) {
      throw new Error('Profile not found at current index');
    }
    return profile;
  }

  /**
   * Get the current profile index
   */
  getCurrentIndex(): number {
    return this.currentProfileIndex;
  }

  /**
   * Get all available profiles
   */
  getAllProfiles(): readonly MovementProfile[] {
    return this.profiles;
  }

  /**
   * Get the number of profiles
   */
  getProfileCount(): number {
    return this.profiles.length;
  }

  /**
   * Check if a profile with the given ID exists
   */
  hasProfile(profileId: string): boolean {
    return this.profiles.some(p => p.id === profileId);
  }
}

