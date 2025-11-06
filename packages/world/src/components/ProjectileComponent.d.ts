import { Component } from './Component.js';
/**
 * Projectile component data
 */
export interface ProjectileComponentData {
    /** Damage dealt on hit */
    damage?: number;
    /** Projectile speed */
    speed?: number;
    /** Lifetime in seconds */
    lifetime?: number;
    /** Owner entity ID that fired this projectile */
    ownerId?: string;
}
/**
 * ProjectileComponent represents a projectile entity
 */
export declare class ProjectileComponent extends Component {
    static readonly type = "Projectile";
    /** Damage dealt on hit */
    damage: number;
    /** Projectile speed */
    speed: number;
    /** Lifetime in seconds */
    lifetime: number;
    /** Owner entity ID that fired this projectile */
    ownerId: string;
    /** Spawn time (set on creation) */
    spawnTime: number;
    /** Callback invoked when projectile hits something */
    onHit?: (hitEntityId: string | null, hitPoint: [number, number, number]) => void;
    /** Callback invoked when projectile expires */
    onExpire?: () => void;
    constructor(data?: ProjectileComponentData);
    getType(): string;
    /**
     * Check if projectile has expired
     * @param currentTime - Current time in seconds
     */
    isExpired(currentTime: number): boolean;
    /**
     * Get remaining lifetime
     * @param currentTime - Current time in seconds
     */
    getRemainingLifetime(currentTime: number): number;
    clone(): ProjectileComponent;
    toJSON(): {
        damage: number;
        speed: number;
        lifetime: number;
        ownerId: string;
        spawnTime: number;
    };
    fromJSON(data: {
        damage?: number;
        speed?: number;
        lifetime?: number;
        ownerId?: string;
        spawnTime?: number;
    }): void;
}
//# sourceMappingURL=ProjectileComponent.d.ts.map