import type { PlayerController } from './Controller';

export interface PlayerProfile {
  id: string;
  displayName: string;
}

export class PlayerSession {
  readonly profile: PlayerProfile;
  private controller: PlayerController | null = null;

  constructor(profile: PlayerProfile) {
    this.profile = profile;
  }

  bindController(controller: PlayerController): void {
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
}

