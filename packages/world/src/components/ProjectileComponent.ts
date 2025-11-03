import { Component } from './Component.js';
import { registerComponent } from './registry.js';

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
export class ProjectileComponent extends Component {
  static readonly type = 'Projectile';

  /** Damage dealt on hit */
  damage: number = 25;

  /** Projectile speed */
  speed: number = 50;

  /** Lifetime in seconds */
  lifetime: number = 3.0;

  /** Owner entity ID that fired this projectile */
  ownerId: string = '';

  /** Spawn time (set on creation) */
  spawnTime: number = 0;

  /** Callback invoked when projectile hits something */
  onHit?: (hitEntityId: string | null, hitPoint: [number, number, number]) => void;

  /** Callback invoked when projectile expires */
  onExpire?: () => void;

  constructor(data?: ProjectileComponentData) {
    super();
    if (data) {
      this.damage = data.damage ?? this.damage;
      this.speed = data.speed ?? this.speed;
      this.lifetime = data.lifetime ?? this.lifetime;
      this.ownerId = data.ownerId ?? this.ownerId;
    }
  }

  getType(): string {
    return ProjectileComponent.type;
  }

  /**
   * Check if projectile has expired
   * @param currentTime - Current time in seconds
   */
  isExpired(currentTime: number): boolean {
    return currentTime - this.spawnTime >= this.lifetime;
  }

  /**
   * Get remaining lifetime
   * @param currentTime - Current time in seconds
   */
  getRemainingLifetime(currentTime: number): number {
    const elapsed = currentTime - this.spawnTime;
    return Math.max(0, this.lifetime - elapsed);
  }

  clone(): ProjectileComponent {
    const copy = new ProjectileComponent();
    copy.damage = this.damage;
    copy.speed = this.speed;
    copy.lifetime = this.lifetime;
    copy.ownerId = this.ownerId;
    copy.spawnTime = this.spawnTime;
    // Callbacks are not cloned (entity-specific)
    return copy;
  }

  toJSON(): {
    damage: number;
    speed: number;
    lifetime: number;
    ownerId: string;
    spawnTime: number;
  } {
    return {
      damage: this.damage,
      speed: this.speed,
      lifetime: this.lifetime,
      ownerId: this.ownerId,
      spawnTime: this.spawnTime,
    };
  }

  fromJSON(data: {
    damage?: number;
    speed?: number;
    lifetime?: number;
    ownerId?: string;
    spawnTime?: number;
  }): void {
    if (typeof data.damage === 'number') this.damage = data.damage;
    if (typeof data.speed === 'number') this.speed = data.speed;
    if (typeof data.lifetime === 'number') this.lifetime = data.lifetime;
    if (typeof data.ownerId === 'string') this.ownerId = data.ownerId;
    if (typeof data.spawnTime === 'number') this.spawnTime = data.spawnTime;
  }
}

registerComponent(ProjectileComponent.type, ProjectileComponent);

