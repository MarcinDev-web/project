import { Component } from './Component';
import type { WeaponPresetType, AmmoType, StatModifiers } from '../types/weapon';
/**
 * Weapon type
 */
export type WeaponType = 'hitscan' | 'projectile';
/**
 * Weapon component data
 */
export interface WeaponComponentData {
    /** Weapon type */
    type?: WeaponType;
    /** Damage per shot */
    damage?: number;
    /** Fire rate in shots per second */
    fireRate?: number;
    /** Maximum range (for hitscan) or projectile lifetime (for projectile) */
    range?: number;
    /** Spread angle in radians (for hitscan only) */
    spread?: number;
    /** Current ammo count */
    ammo?: number;
    /** Maximum ammo capacity */
    maxAmmo?: number;
    /** Reload duration in seconds */
    reloadDuration?: number;
    /** Projectile speed (for projectile type only) */
    projectileSpeed?: number;
    /** Projectile lifetime in seconds (for projectile type only, overrides range if set) */
    projectileLifetime?: number;
}
/**
 * WeaponComponent manages weapon data and state
 */
export declare class WeaponComponent extends Component {
    static readonly type = "Weapon";
    /** Weapon preset type (if created from preset) */
    weaponPreset?: WeaponPresetType;
    /** Weapon type */
    type: WeaponType;
    /** Base damage per shot (before modifiers) */
    private _baseDamage;
    /** Base fire rate in shots per second (before modifiers) */
    private _baseFireRate;
    /** Base maximum range (before modifiers) */
    private _baseRange;
    /** Base spread angle in radians (before modifiers) */
    private _baseSpread;
    /** Base maximum ammo capacity (before modifiers) */
    private _baseMaxAmmo;
    /** Base reload duration in seconds (before modifiers) */
    private _baseReloadDuration;
    /** Base projectile speed (before modifiers) */
    private _baseProjectileSpeed;
    /** Base projectile lifetime (before modifiers) */
    private _baseProjectileLifetime?;
    /** Current ammo count */
    private _ammo;
    /** Current ammo type being used */
    currentAmmoType: AmmoType;
    /** Accepted ammo types for this weapon */
    acceptedAmmoTypes: AmmoType[];
    /** Effective stats cache (recomputed when attachments or ammo changes) */
    private _effectiveStatsDirty;
    /** Base damage (getters return base values, use getEffective* methods for modified stats) */
    get damage(): number;
    set damage(value: number);
    /** Base fire rate */
    get fireRate(): number;
    set fireRate(value: number);
    /** Base range */
    get range(): number;
    set range(value: number);
    /** Base spread */
    get spread(): number;
    set spread(value: number);
    /** Base max ammo */
    get maxAmmo(): number;
    set maxAmmo(value: number);
    /** Base reload duration */
    get reloadDuration(): number;
    set reloadDuration(value: number);
    /** Base projectile speed */
    get projectileSpeed(): number;
    set projectileSpeed(value: number);
    /** Base projectile lifetime */
    get projectileLifetime(): number | undefined;
    set projectileLifetime(value: number | undefined);
    /** Time since last fire (for fire rate cooldown) */
    private _lastFireTime;
    /** Whether weapon is currently reloading */
    private _isReloading;
    /** Reload start time */
    private _reloadStartTime;
    /** Callback invoked when weapon fires */
    onFire?: (damage: number, direction: [number, number, number], origin: [number, number, number]) => void;
    /** Callback invoked when reload starts */
    onReload?: () => void;
    /** Callback invoked when reload completes */
    onReloadComplete?: () => void;
    /** Callback invoked when out of ammo */
    onOutOfAmmo?: () => void;
    constructor(data?: WeaponComponentData);
    getType(): string;
    /**
     * Get current ammo count
     */
    get ammo(): number;
    /**
     * Set ammo count (clamped to [0, maxAmmo])
     */
    set ammo(value: number);
    /**
     * Get effective damage (with attachments and ammo modifiers)
     * @param attachmentModifiers - Optional attachment modifiers (if not provided, will compute from entity)
     * @param ammoMultiplier - Optional ammo type damage multiplier
     */
    getEffectiveDamage(attachmentModifiers?: StatModifiers, ammoMultiplier?: number): number;
    /**
     * Get effective fire rate (with attachments)
     */
    getEffectiveFireRate(attachmentModifiers?: StatModifiers): number;
    /**
     * Get effective range (with attachments)
     */
    getEffectiveRange(attachmentModifiers?: StatModifiers): number;
    /**
     * Get effective spread (with attachments)
     */
    getEffectiveSpread(attachmentModifiers?: StatModifiers): number;
    /**
     * Get effective max ammo (with attachments)
     */
    getEffectiveMaxAmmo(attachmentModifiers?: StatModifiers): number;
    /**
     * Get effective reload duration (with attachments)
     */
    getEffectiveReloadDuration(attachmentModifiers?: StatModifiers): number;
    /**
     * Get effective projectile speed (with attachments)
     */
    getEffectiveProjectileSpeed(attachmentModifiers?: StatModifiers): number;
    /**
     * Get effective projectile lifetime
     */
    getEffectiveProjectileLifetime(): number | undefined;
    /**
     * Invalidate effective stats cache (call when attachments or ammo changes)
     */
    invalidateEffectiveStats(): void;
    /**
     * Check if weapon can fire (has ammo, not reloading, cooldown ready)
     * @param currentTime - Current time in seconds
     * @param attachmentModifiers - Optional attachment modifiers for effective fire rate
     */
    canFire(currentTime: number, attachmentModifiers?: StatModifiers): boolean;
    /**
     * Fire the weapon (marks as fired, updates timers)
     * @param currentTime - Current time in seconds
     * @returns true if fire was successful
     */
    fire(currentTime: number): boolean;
    /**
     * Start reloading
     * @param currentTime - Current time in seconds
     */
    startReload(currentTime: number): void;
    /**
     * Update reload state (called each frame)
     * @param currentTime - Current time in seconds
     * @param attachmentModifiers - Optional attachment modifiers for effective reload duration
     * @returns true if reload just completed
     */
    updateReload(currentTime: number, attachmentModifiers?: StatModifiers): boolean;
    /**
     * Check if weapon is currently reloading
     */
    get isReloading(): boolean;
    /**
     * Cancel reload
     */
    cancelReload(): void;
    /**
     * Get time since last fire
     * @param currentTime - Current time in seconds
     */
    getTimeSinceLastFire(currentTime: number): number;
    clone(): WeaponComponent;
    toJSON(): {
        weaponPreset?: WeaponPresetType;
        type: WeaponType;
        damage: number;
        fireRate: number;
        range: number;
        spread: number;
        ammo: number;
        maxAmmo: number;
        reloadDuration: number;
        projectileSpeed: number;
        projectileLifetime?: number;
        currentAmmoType: AmmoType;
        acceptedAmmoTypes: AmmoType[];
    };
    fromJSON(data: {
        weaponPreset?: WeaponPresetType;
        type?: WeaponType;
        damage?: number;
        fireRate?: number;
        range?: number;
        spread?: number;
        ammo?: number;
        maxAmmo?: number;
        reloadDuration?: number;
        projectileSpeed?: number;
        projectileLifetime?: number;
        currentAmmoType?: AmmoType;
        acceptedAmmoTypes?: AmmoType[];
    }): void;
}
//# sourceMappingURL=WeaponComponent.d.ts.map