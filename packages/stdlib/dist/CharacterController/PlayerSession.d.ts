import type { PlayerController } from './Controller';
export interface PlayerProfile {
    id: string;
    displayName: string;
}
export declare class PlayerSession {
    readonly profile: PlayerProfile;
    private controller;
    constructor(profile: PlayerProfile);
    bindController(controller: PlayerController): void;
    unbindController(): void;
    update(deltaTime: number): void;
    getController(): PlayerController | null;
}
//# sourceMappingURL=PlayerSession.d.ts.map