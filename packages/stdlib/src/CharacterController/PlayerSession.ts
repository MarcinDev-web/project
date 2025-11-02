import type { PlayerController } from './Controller';

export interface PlayerProfile {
  id: string;
  displayName: string;
  /** Optional ID of the player's avatar model */
  avatar?: string;
  /** Optional player preferences (extensible) */
  preferences?: Record<string, unknown>;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

export class PlayerSession {
  readonly profile: PlayerProfile;
  private controller: PlayerController | null = null;

  constructor(profile: PlayerProfile) {
    this.profile = profile;
  }

  /**
   * Get player ID from profile
   */
  get id(): string {
    return this.profile.id;
  }

  /**
   * Get player display name from profile
   */
  get displayName(): string {
    return this.profile.displayName;
  }

  bindController(controller: PlayerController): void {
    if (this.controller !== null) {
      console.warn(
        `[PlayerSession] Overwriting existing controller for player ${this.profile.id}. ` +
          `Previous controller ID: ${this.controller.id}, new controller ID: ${controller.id}`
      );
    }
    this.controller = controller;
  }

  unbindController(): void {
    this.controller?.unpossess();
    this.controller = null;
  }

  update(deltaTime: number): void {
    this.controller?.update(deltaTime);
  }

  getController(): PlayerController | null {
    return this.controller;
  }

  /**
   * Dispose of this session and clean up resources.
   * Safe to call multiple times (idempotent).
   */
  dispose(): void {
    this.unbindController();
  }
}

