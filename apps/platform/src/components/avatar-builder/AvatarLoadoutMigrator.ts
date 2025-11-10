/**
 * AvatarLoadoutMigrator - Handles migration between loadout versions
 */

import type { AvatarLoadout, AvatarLoadoutPart } from '@engine/avatar';
import { DEFAULT_AVATAR_LOADOUT } from '@engine/avatar';

export interface LoadoutMigrationResult {
  readonly loadout: AvatarLoadout;
  readonly migrated: boolean;
  readonly fromVersion: number;
  readonly toVersion: number;
}

/**
 * Migrator for avatar loadouts between versions
 */
export class AvatarLoadoutMigrator {
  private static readonly CURRENT_VERSION = 2;
  private static readonly SUPPORTED_VERSIONS = [1, 2];

  /**
   * Get current loadout version
   */
  static getCurrentVersion(): number {
    return this.CURRENT_VERSION;
  }

  /**
   * Migrate loadout to current version
   */
  static migrate(loadout: AvatarLoadout): LoadoutMigrationResult {
    const fromVersion = loadout.version ?? 1;
    const toVersion = this.CURRENT_VERSION;

    if (fromVersion === toVersion) {
      return {
        loadout,
        migrated: false,
        fromVersion,
        toVersion,
      };
    }

    if (!this.SUPPORTED_VERSIONS.includes(fromVersion)) {
      console.warn(
        `[AvatarLoadoutMigrator] Unsupported loadout version ${fromVersion}, using default loadout`
      );
      return {
        loadout: DEFAULT_AVATAR_LOADOUT,
        migrated: true,
        fromVersion,
        toVersion,
      };
    }

    let migratedLoadout = loadout;

    // Migrate step by step
    for (let version = fromVersion; version < toVersion; version++) {
      migratedLoadout = this.migrateFromVersion(migratedLoadout, version, version + 1);
    }

    return {
      loadout: migratedLoadout,
      migrated: true,
      fromVersion,
      toVersion,
    };
  }

  /**
   * Migrate from one version to the next
   */
  private static migrateFromVersion(
    loadout: AvatarLoadout,
    fromVersion: number,
    toVersion: number
  ): AvatarLoadout {
    if (fromVersion === 1 && toVersion === 2) {
      return this.migrateV1ToV2(loadout);
    }

    // Unknown migration path
    console.warn(
      `[AvatarLoadoutMigrator] Unknown migration path from v${fromVersion} to v${toVersion}`
    );
    return loadout;
  }

  /**
   * Migrate from version 1 to version 2
   * V2 adds normalization and ensures all parts have proper structure
   */
  private static migrateV1ToV2(loadout: AvatarLoadout): AvatarLoadout {
    const migratedParts: Partial<Record<string, AvatarLoadoutPart>> = {};

    // Normalize parts: ensure material field consistency (material takes precedence over mat)
    for (const [slot, part] of Object.entries(loadout.parts || {})) {
      if (!part) {
        continue;
      }

      const migratedPart: AvatarLoadoutPart = {
        mesh: part.mesh,
      };

      // Normalize material: prefer 'material' over 'mat', but keep both for compatibility
      if (part.material) {
        migratedPart.material = part.material;
        migratedPart.mat = part.material; // Keep mat for backward compatibility
      } else if (part.mat) {
        migratedPart.material = part.mat;
        migratedPart.mat = part.mat;
      }

      // Copy colors if present
      if (part.colors) {
        migratedPart.colors = { ...part.colors };
      }

      migratedParts[slot] = migratedPart;
    }

    return {
      version: 2,
      parts: migratedParts,
    };
  }

  /**
   * Normalize loadout to current version (migrate if needed, ensure structure)
   */
  static normalize(loadout: AvatarLoadout): AvatarLoadout {
    const result = this.migrate(loadout);
    return result.loadout;
  }

  /**
   * Check if loadout needs migration
   */
  static needsMigration(loadout: AvatarLoadout): boolean {
    const version = loadout.version ?? 1;
    return version < this.CURRENT_VERSION;
  }
}

