// Note: These types reference editor-specific types that need to be adapted
// This is a temporary implementation for migration purposes

import type { ScriptCapabilityPermissions } from '@engine/script/security/CapabilityTypes';

export interface ControllerBindings {
  preferences: {
    fov: number;
    invertY: boolean;
    sensitivity: number;
    hudLayout: string;
  };
}

export interface PawnConfig {
  // Placeholder - will be properly defined when editor types are separated
  [key: string]: unknown;
}

export interface PlayManifest {
  controller: ControllerBindings;
  pawn: PawnConfig;
  /** Script capability permissions (source of truth for sandbox access) */
  permissions?: {
    script?: ScriptCapabilityPermissions;
  };
  /** Simulation configuration */
  simulation?: {
    /** RNG seed for deterministic simulation */
    rngSeed?: number;
  };
}

export function extractControllerBindings(manifest: PlayManifest): ControllerBindings {
  return manifest.controller;
}

export function extractPawnConfig(manifest: PlayManifest): PawnConfig {
  return manifest.pawn;
}
