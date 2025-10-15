import type { PlayManifest } from '../editor/core/PlayManifest';
import type { ControllerBindings, PawnConfig } from '../editor/core/PlayManifest';

export function extractControllerBindings(manifest: PlayManifest): ControllerBindings {
  return manifest.controller;
}

export function extractPawnConfig(manifest: PlayManifest): PawnConfig {
  return manifest.pawn;
}


