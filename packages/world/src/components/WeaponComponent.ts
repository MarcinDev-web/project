import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { WeaponPresetType, AmmoType, StatModifiers } from '../types/weapon.js';

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
export class WeaponComponent extends Component {
  static readonly type = 'Weapon';

  /** Weapon preset type (if created from preset) */
  weaponPreset?: WeaponPresetType;

  /** Weapon type */
  weaponType: WeaponType = 'hitscan';

  /** Base damage per shot (before modifiers) */
  private _baseDamage: number = 25;

  /** Base fire rate in shots per second (before modifiers) */
  private _baseFireRate: number = 10;

  /** Base maximum range (before modifiers) */
  private _baseRange: number = 100;

  /** Base spread angle in radians (before modifiers) */
  private _baseSpread: number = 0.02;

  /** Base maximum ammo capacity (before modifiers) */
  private _baseMaxAmmo: number = 30;

  /** Base reload duration in seconds (before modifiers) */
  private _baseReloadDuration: number = 2.0;

  /** Base projectile speed (before modifiers) */
  private _baseProjectileSpeed: number = 50;

  /** Base projectile lifetime (before modifiers) */
  private _baseProjectileLifetime?: number;

  /** Current ammo count */
  private _ammo: number = 30;

  /** Current ammo type being used */
  currentAmmoType: AmmoType = 'standard';

  /** Accepted ammo types for this weapon */
  acceptedAmmoTypes: AmmoType[] = ['standard'];

  /** Effective stats cache (recomputed when attachments or ammo changes) */
  // @ts-expect-error - Used for future caching optimization
  private _effectiveStatsDirty: boolean = true;

  /** Base damage (getters return base values, use getEffective* methods for modified stats) */
  get damage(): number {
    return this._baseDamage;
  }

  set damage(value: number) {
    this._baseDamage = value;
    this._effectiveStatsDirty = true;
  }

  /** Base fire rate */
  get fireRate(): number {
    return this._baseFireRate;
  }

  set fireRate(value: number) {
    this._baseFireRate = value;
    this._effectiveStatsDirty = true;
  }

  /** Base range */
  get range(): number {
    return this._baseRange;
  }

  set range(value: number) {
    this._baseRange = value;
    this._effectiveStatsDirty = true;
  }

  /** Base spread */
  get spread(): number {
    return this._baseSpread;
  }

  set spread(value: number) {
    this._baseSpread = value;
    this._effectiveStatsDirty = true;
  }

  /** Base max ammo */
  get maxAmmo(): number {
    return this._baseMaxAmmo;
  }

  set maxAmmo(value: number) {
    this._baseMaxAmmo = value;
    this._effectiveStatsDirty = true;
  }

  /** Base reload duration */
  get reloadDuration(): number {
    return this._baseReloadDuration;
  }

  set reloadDuration(value: number) {
    this._baseReloadDuration = value;
    this._effectiveStatsDirty = true;
  }

  /** Base projectile speed */
  get projectileSpeed(): number {
    return this._baseProjectileSpeed;
  }

  set projectileSpeed(value: number) {
    this._baseProjectileSpeed = value;
    this._effectiveStatsDirty = true;
  }

  /** Base projectile lifetime */
  get projectileLifetime(): number | undefined {
    return this._baseProjectileLifetime;
  }

  set projectileLifetime(value: number | undefined) {
    // For exactOptionalPropertyTypes, we must handle undefined explicitly
    if (value === undefined) {
      delete this._baseProjectileLifetime;
    } else {
      this._baseProjectileLifetime = value;
    }
    this._effectiveStatsDirty = true;
  }

  /** Time since last fire (for fire rate cooldown) */
  private _lastFireTime: number = -Infinity;

  /** Whether weapon is currently reloading */
  private _isReloading: boolean = false;

  /** Reload start time */
  private _reloadStartTime: number = -Infinity;

  /** Callback invoked when weapon fires */
  onFire?: (
    damage: number,
    direction: [number, number, number],
    origin: [number, number, number]
  ) => void;

  /** Callback invoked when reload starts */
  onReload?: () => void;

  /** Callback invoked when reload completes */
  onReloadComplete?: () => void;

  /** Callback invoked when out of ammo */
  onOutOfAmmo?: () => void;

  constructor(data?: WeaponComponentData) {
    super();
    if (data) {
      this.weaponType = data.type ?? this.weaponType;
      this._baseDamage = data.damage ?? this._baseDamage;
      this._baseFireRate = data.fireRate ?? this._baseFireRate;
      this._baseRange = data.range ?? this._baseRange;
      this._baseSpread = data.spread ?? this._baseSpread;
      this._ammo = data.ammo ?? this._ammo;
      this._baseMaxAmmo = data.maxAmmo ?? this._baseMaxAmmo;
      this._baseReloadDuration = data.reloadDuration ?? this._baseReloadDuration;
      this._baseProjectileSpeed = data.projectileSpeed ?? this._baseProjectileSpeed;
      if (data.projectileLifetime !== undefined) {
        this._baseProjectileLifetime = data.projectileLifetime;
      }
      // Clamp initial ammo to max
      this._ammo = Math.min(this._ammo, this._baseMaxAmmo);
    }
  }

  getType(): string {
    return WeaponComponent.type;
  }

  /**
   * Get current ammo count
   */
  get ammo(): number {
    return this._ammo;
  }

  /**
   * Set ammo count (clamped to [0, maxAmmo])
   */
  set ammo(value: number) {
    const oldAmmo = this._ammo;
    const effectiveMax = this.getEffectiveMaxAmmo();
    this._ammo = Math.max(0, Math.min(value, effectiveMax));

    // Fire out of ammo callback
    if (this._ammo === 0 && oldAmmo > 0 && this.onOutOfAmmo) {
      this.onOutOfAmmo();
    }
  }

  /**
   * Get effective damage (with attachments and ammo modifiers)
   * @param attachmentModifiers - Optional attachment modifiers (if not provided, will compute from entity)
   * @param ammoMultiplier - Optional ammo type damage multiplier
   */
  getEffectiveDamage(attachmentModifiers?: StatModifiers, ammoMultiplier?: number): number {
    let damage = this._baseDamage;

    // Apply attachment modifiers
    if (attachmentModifiers) {
      if (attachmentModifiers.damageMultiplier !== undefined) {
        damage *= attachmentModifiers.damageMultiplier;
      }
      if (attachmentModifiers.damageAdditive !== undefined) {
        damage += attachmentModifiers.damageAdditive;
      }
    }

    // Apply ammo type modifier
    if (ammoMultiplier !== undefined) {
      damage *= ammoMultiplier;
    }

    return Math.max(0, damage);
  }

  /**
   * Get effective fire rate (with attachments)
   */
  getEffectiveFireRate(attachmentModifiers?: StatModifiers): number {
    let fireRate = this._baseFireRate;

    if (attachmentModifiers?.fireRateMultiplier !== undefined) {
      fireRate *= attachmentModifiers.fireRateMultiplier;
    }

    return Math.max(0.1, fireRate); // Minimum 0.1 shots/sec
  }

  /**
   * Get effective range (with attachments)
   */
  getEffectiveRange(attachmentModifiers?: StatModifiers): number {
    let range = this._baseRange;

    if (attachmentModifiers) {
      if (attachmentModifiers.rangeMultiplier !== undefined) {
        range *= attachmentModifiers.rangeMultiplier;
      }
      if (attachmentModifiers.rangeAdditive !== undefined) {
        range += attachmentModifiers.rangeAdditive;
      }
    }

    return Math.max(0, range);
  }

  /**
   * Get effective spread (with attachments)
   */
  getEffectiveSpread(attachmentModifiers?: StatModifiers): number {
    let spread = this._baseSpread;

    if (attachmentModifiers?.spreadMultiplier !== undefined) {
      spread *= attachmentModifiers.spreadMultiplier;
    }

    return Math.max(0, spread);
  }

  /**
   * Get effective max ammo (with attachments)
   */
  getEffectiveMaxAmmo(attachmentModifiers?: StatModifiers): number {
    let maxAmmo = this._baseMaxAmmo;

    if (attachmentModifiers) {
      if (attachmentModifiers.maxAmmoMultiplier !== undefined) {
        maxAmmo *= attachmentModifiers.maxAmmoMultiplier;
      }
      if (attachmentModifiers.maxAmmoAdditive !== undefined) {
        maxAmmo += attachmentModifiers.maxAmmoAdditive;
      }
    }

    return Math.max(1, Math.floor(maxAmmo)); // Minimum 1, rounded down
  }

  /**
   * Get effective reload duration (with attachments)
   */
  getEffectiveReloadDuration(attachmentModifiers?: StatModifiers): number {
    let duration = this._baseReloadDuration;

    if (attachmentModifiers?.reloadDurationMultiplier !== undefined) {
      duration *= attachmentModifiers.reloadDurationMultiplier;
    }

    return Math.max(0.1, duration); // Minimum 0.1 seconds
  }

  /**
   * Get effective projectile speed (with attachments)
   */
  getEffectiveProjectileSpeed(attachmentModifiers?: StatModifiers): number {
    let speed = this._baseProjectileSpeed;

    if (attachmentModifiers?.projectileSpeedMultiplier !== undefined) {
      speed *= attachmentModifiers.projectileSpeedMultiplier;
    }

    return Math.max(1, speed);
  }

  /**
   * Get effective projectile lifetime
   */
  getEffectiveProjectileLifetime(): number | undefined {
    return this._baseProjectileLifetime;
  }

  /**
   * Invalidate effective stats cache (call when attachments or ammo changes)
   */
  invalidateEffectiveStats(): void {
    this._effectiveStatsDirty = true;
  }

  /**
   * Check if weapon can fire (has ammo, not reloading, cooldown ready)
   * @param currentTime - Current time in seconds
   * @param attachmentModifiers - Optional attachment modifiers for effective fire rate
   */
  canFire(currentTime: number, attachmentModifiers?: StatModifiers): boolean {
    if (this._isReloading) return false;
    if (this._ammo <= 0) return false;

    const effectiveFireRate = this.getEffectiveFireRate(attachmentModifiers);
    const timeSinceLastFire = currentTime - this._lastFireTime;
    const minTimeBetweenShots = 1.0 / effectiveFireRate;
    if (timeSinceLastFire < minTimeBetweenShots) return false;

    return true;
  }

  /**
   * Fire the weapon (marks as fired, updates timers)
   * @param currentTime - Current time in seconds
   * @returns true if fire was successful
   */
  fire(currentTime: number): boolean {
    if (!this.canFire(currentTime)) {
      return false;
    }

    this._ammo--;
    this._lastFireTime = currentTime;

    return true;
  }

  /**
   * Start reloading
   * @param currentTime - Current time in seconds
   */
  startReload(currentTime: number): void {
    if (this._ammo >= this.maxAmmo) return; // Already full
    if (this._isReloading) return; // Already reloading

    this._isReloading = true;
    this._reloadStartTime = currentTime;

    if (this.onReload) {
      this.onReload();
    }
  }

  /**
   * Update reload state (called each frame)
   * @param currentTime - Current time in seconds
   * @param attachmentModifiers - Optional attachment modifiers for effective reload duration
   * @returns true if reload just completed
   */
  updateReload(currentTime: number, attachmentModifiers?: StatModifiers): boolean {
    if (!this._isReloading) return false;

    const effectiveDuration = this.getEffectiveReloadDuration(attachmentModifiers);
    const elapsed = currentTime - this._reloadStartTime;
    if (elapsed >= effectiveDuration) {
      // Reload complete
      const effectiveMax = this.getEffectiveMaxAmmo(attachmentModifiers);
      this._ammo = effectiveMax;
      this._isReloading = false;

      if (this.onReloadComplete) {
        this.onReloadComplete();
      }

      return true;
    }

    return false;
  }

  /**
   * Check if weapon is currently reloading
   */
  get isReloading(): boolean {
    return this._isReloading;
  }

  /**
   * Cancel reload
   */
  cancelReload(): void {
    this._isReloading = false;
  }

  /**
   * Get time since last fire
   * @param currentTime - Current time in seconds
   */
  getTimeSinceLastFire(currentTime: number): number {
    return currentTime - this._lastFireTime;
  }

  clone(): WeaponComponent {
    const copy = new WeaponComponent();
    if (this.weaponPreset !== undefined) copy.weaponPreset = this.weaponPreset;
    copy.weaponType = this.weaponType;
    copy._baseDamage = this._baseDamage;
    copy._baseFireRate = this._baseFireRate;
    copy._baseRange = this._baseRange;
    copy._baseSpread = this._baseSpread;
    copy._baseMaxAmmo = this._baseMaxAmmo;
    copy._baseReloadDuration = this._baseReloadDuration;
    copy._baseProjectileSpeed = this._baseProjectileSpeed;
    if (this._baseProjectileLifetime !== undefined) {
      copy._baseProjectileLifetime = this._baseProjectileLifetime;
    }
    copy._ammo = this._ammo;
    copy.currentAmmoType = this.currentAmmoType;
    copy.acceptedAmmoTypes = [...this.acceptedAmmoTypes];
    copy._lastFireTime = this._lastFireTime;
    copy._isReloading = this._isReloading;
    copy._reloadStartTime = this._reloadStartTime;
    // Callbacks are not cloned (entity-specific)
    return copy;
  }

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
  } {
    return {
      ...(this.weaponPreset !== undefined && { weaponPreset: this.weaponPreset }),
      type: this.weaponType,
      damage: this._baseDamage,
      fireRate: this._baseFireRate,
      range: this._baseRange,
      spread: this._baseSpread,
      ammo: this._ammo,
      maxAmmo: this._baseMaxAmmo,
      reloadDuration: this._baseReloadDuration,
      projectileSpeed: this._baseProjectileSpeed,
      ...(this._baseProjectileLifetime !== undefined && {
        projectileLifetime: this._baseProjectileLifetime,
      }),
      currentAmmoType: this.currentAmmoType,
      acceptedAmmoTypes: [...this.acceptedAmmoTypes],
    };
  }

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
  }): void {
    if (data.weaponPreset !== undefined) this.weaponPreset = data.weaponPreset;
    if (data.type !== undefined) this.weaponType = data.type;
    if (typeof data.damage === 'number') this._baseDamage = data.damage;
    if (typeof data.fireRate === 'number') this._baseFireRate = data.fireRate;
    if (typeof data.range === 'number') this._baseRange = data.range;
    if (typeof data.spread === 'number') this._baseSpread = data.spread;
    if (typeof data.maxAmmo === 'number') {
      this._baseMaxAmmo = data.maxAmmo;
    }
    if (typeof data.ammo === 'number') {
      const effectiveMax = this.getEffectiveMaxAmmo();
      this._ammo = Math.max(0, Math.min(data.ammo, effectiveMax));
    }
    if (typeof data.reloadDuration === 'number') this._baseReloadDuration = data.reloadDuration;
    if (typeof data.projectileSpeed === 'number') this._baseProjectileSpeed = data.projectileSpeed;
    if (typeof data.projectileLifetime === 'number') {
      this._baseProjectileLifetime = data.projectileLifetime;
    } else if ('projectileLifetime' in data && data.projectileLifetime === null) {
      delete this._baseProjectileLifetime;
    }
    if (data.currentAmmoType !== undefined) this.currentAmmoType = data.currentAmmoType;
    if (data.acceptedAmmoTypes !== undefined) this.acceptedAmmoTypes = [...data.acceptedAmmoTypes];
  }
}

registerComponent(WeaponComponent.type, WeaponComponent);
