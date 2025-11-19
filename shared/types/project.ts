/**
 * Shared project configuration used by editor, platform, and net-server.
 * This is serialized along with the scene to capture non-scene defaults
 * (spawn point, camera, gameplay toggles) for newly created games.
 */
import type { Quat, Vec3 } from '@engine/core/math';

export type GameVisibility = 'private' | 'unlisted' | 'public';
export type GameGenre = 'sandbox' | 'pvp' | 'co-op' | 'adventure';

export interface SpawnSettings {
  position: Vec3;
  rotation: Quat;
}

export interface CameraSettings {
  fov: number;
  near: number;
  far: number;
  /**
   * Offset (relative to player origin) used by third-person rigs.
   */
  thirdPersonOffset: Vec3;
}

export interface GameplaySettings {
  maxPlayers: number;
  allowJoinInProgress: boolean;
  respawnEnabled: boolean;
}

export interface WorldSettings {
  gravity: number;
  environmentPreset: 'stylized-balanced' | 'cinematic' | 'low';
  spawn: SpawnSettings;
}

export interface GameProjectConfig {
  version: 1;
  info: {
    name: string;
    description?: string;
    genre: GameGenre;
    visibility: GameVisibility;
  };
  camera: CameraSettings;
  gameplay: GameplaySettings;
  world: WorldSettings;
}

/**
  * Build a default configuration for a fresh project.
  */
export function createDefaultGameProjectConfig(
  name = 'My Project',
  description?: string
): GameProjectConfig {
  return {
    version: 1,
    info: {
      name,
      visibility: 'private',
      genre: 'sandbox',
      ...(description ? { description } : {}),
    },
    camera: {
      fov: 60,
      near: 0.1,
      far: 800,
      thirdPersonOffset: [0, 1.6, -3],
    },
    gameplay: {
      maxPlayers: 1,
      allowJoinInProgress: false,
      respawnEnabled: true,
    },
    world: {
      gravity: 9.81,
      environmentPreset: 'stylized-balanced',
      spawn: {
        position: [0, 1.1, 0],
        rotation: [0, 0, 0, 1],
      },
    },
  };
}
