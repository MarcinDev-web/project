import type { CharacterControllerConfig } from '@engine/world';

/**
 * Serialized data for MovementProfile
 */
export interface MovementProfileData {
  id: string;
  name: string;
  description?: string;
  config: CharacterControllerConfig;
  extensions?: string[]; // IDs of extensions
}

/**
 * Movement Profile
 * 
 * Defines a set of movement parameters and optional extensions
 * that can be applied to a CharacterController.
 */
export class MovementProfile {
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly config: CharacterControllerConfig;
  public readonly extensions?: MovementProfileExtension[];

  constructor(data: Omit<MovementProfileData, 'extensions'> & { extensions?: MovementProfileExtension[] }) {
    this.id = data.id;
    this.name = data.name;
    this.config = { ...data.config };
    if (data.description !== undefined) {
      this.description = data.description;
    }
    if (data.extensions !== undefined) {
      this.extensions = data.extensions;
    }
  }

  /**
   * Create a new MovementProfile with optional partial data
   */
  static create(
    custom: Partial<Omit<MovementProfileData, 'extensions'>> & { id: string; name: string; config: CharacterControllerConfig } & { extensions?: MovementProfileExtension[] }
  ): MovementProfile {
    const baseData: Omit<MovementProfileData, 'extensions'> = {
      id: custom.id,
      name: custom.name,
      config: custom.config,
    };
    if (custom.description !== undefined) {
      baseData.description = custom.description;
    }
    const data: Omit<MovementProfileData, 'extensions'> & { extensions?: MovementProfileExtension[] } = {
      ...baseData,
    };
    if (custom.extensions !== undefined) {
      data.extensions = custom.extensions;
    }
    return new MovementProfile(data);
  }

  /**
   * Serialize profile to JSON-compatible data
   */
  serialize(): MovementProfileData {
    const data: MovementProfileData = {
      id: this.id,
      name: this.name,
      config: { ...this.config },
    };
    if (this.description !== undefined) {
      data.description = this.description;
    }
    if (this.extensions !== undefined && this.extensions.length > 0) {
      data.extensions = this.extensions.map(ext => ext.id);
    }
    return data;
  }

  /**
   * Deserialize profile from JSON-compatible data
   * 
   * Note: Extensions must be resolved separately using their IDs
   */
  static deserialize(data: MovementProfileData, extensionResolver?: (id: string) => MovementProfileExtension | null): MovementProfile {
    const { extensions: extensionIds, ...restData } = data;
    const profileData: Omit<MovementProfileData, 'extensions'> & { extensions?: MovementProfileExtension[] } = {
      ...restData,
    };
    
    if (extensionIds !== undefined && extensionResolver !== undefined) {
      const extensions = extensionIds
        .map(id => extensionResolver(id))
        .filter((ext): ext is MovementProfileExtension => ext !== null && ext !== undefined);
      // Always set extensions array, even if empty (when resolver returns null for all)
      profileData.extensions = extensions;
    }
    
    return new MovementProfile(profileData);
  }

  /**
   * Clone this profile
   */
  clone(): MovementProfile {
    const baseData: Omit<MovementProfileData, 'extensions'> = {
      id: this.id,
      name: this.name,
      config: { ...this.config },
    };
    if (this.description !== undefined) {
      baseData.description = this.description;
    }
    const data: Omit<MovementProfileData, 'extensions'> & { extensions?: MovementProfileExtension[] } = {
      ...baseData,
    };
    if (this.extensions !== undefined) {
      data.extensions = [...this.extensions];
    }
    return new MovementProfile(data);
  }
}

/**
 * Extension interface for adding custom mechanics to movement profiles
 */
export interface MovementProfileExtension {
  readonly id: string;
  readonly name: string;

  /**
   * Modify config before applying to controller
   */
  modifyConfig?(config: CharacterControllerConfig): CharacterControllerConfig;

  /**
   * Custom update logic (called each frame)
   */
  update?(controller: import('@engine/world').CharacterController, deltaTime: number): void;

  /**
   * Called when profile is applied to controller
   */
  onApply?(controller: import('@engine/world').CharacterController): void;

  /**
   * Called when profile is removed from controller
   */
  onRemove?(controller: import('@engine/world').CharacterController): void;
}

