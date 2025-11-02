import { MovementProfile, type MovementProfileExtension } from './MovementProfile';
import { PRESET_PROFILES } from './presets';

/**
 * Registry for movement profiles
 * 
 * Singleton that manages all registered movement profiles,
 * including pre-defined presets and custom profiles.
 */
export class MovementProfileRegistry {
  private static instance: MovementProfileRegistry | null = null;
  private profiles = new Map<string, MovementProfile>();
  private extensionRegistry = new Map<string, MovementProfileExtension>();

  private constructor() {
    // Register default preset profiles
    this.registerDefaults();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MovementProfileRegistry {
    if (!MovementProfileRegistry.instance) {
      MovementProfileRegistry.instance = new MovementProfileRegistry();
    }
    return MovementProfileRegistry.instance;
  }

  /**
   * Register a movement profile
   */
  register(profile: MovementProfile): void {
    if (this.profiles.has(profile.id)) {
      console.warn(`MovementProfile with id "${profile.id}" already exists. Overwriting.`);
    }
    this.profiles.set(profile.id, profile);
  }

  /**
   * Get a movement profile by ID
   */
  get(id: string): MovementProfile | null {
    return this.profiles.get(id) ?? null;
  }

  /**
   * Get all registered profiles
   */
  getAll(): MovementProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Check if a profile exists
   */
  has(id: string): boolean {
    return this.profiles.has(id);
  }

  /**
   * Unregister a profile
   */
  unregister(id: string): boolean {
    return this.profiles.delete(id);
  }

  /**
   * Register a movement extension
   */
  registerExtension(extension: MovementProfileExtension): void {
    if (this.extensionRegistry.has(extension.id)) {
      console.warn(`MovementProfileExtension with id "${extension.id}" already exists. Overwriting.`);
    }
    this.extensionRegistry.set(extension.id, extension);
  }

  /**
   * Get a movement extension by ID
   */
  getExtension(id: string): MovementProfileExtension | null {
    return this.extensionRegistry.get(id) ?? null;
  }

  /**
   * Register all default preset profiles
   */
  private registerDefaults(): void {
    const defaultProfiles = MovementProfileRegistry.getDefaultProfiles();
    for (const profile of defaultProfiles) {
      this.register(profile);
    }
  }

  /**
   * Get default preset profiles
   */
  static getDefaultProfiles(): MovementProfile[] {
    return Object.values(PRESET_PROFILES);
  }

  /**
   * Clear all registered profiles (useful for tests)
   */
  clear(): void {
    this.profiles.clear();
    this.extensionRegistry.clear();
    this.registerDefaults();
  }
}

