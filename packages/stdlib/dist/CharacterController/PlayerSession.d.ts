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
export declare class PlayerSession {
    readonly profile: PlayerProfile;
    private controller;
    constructor(profile: PlayerProfile);
    /**
     * Get player ID from profile
     */
    get id(): string;
    /**
     * Get player display name from profile
     */
    get displayName(): string;
    bindController(controller: PlayerController): void;
    unbindController(): void;
    update(deltaTime: number): void;
    getController(): PlayerController | null;
    /**
     * Dispose of this session and clean up resources.
     * Safe to call multiple times (idempotent).
     */
    dispose(): void;
}
//# sourceMappingURL=PlayerSession.d.ts.map