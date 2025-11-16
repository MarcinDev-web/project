import type { Entity } from '../core/Entity.js';
import type { Scene } from '../core/Scene.js';
import { HealthComponent } from '../components/HealthComponent.js';
import type { WeaponPickupSystem } from '../systems/WeaponPickupSystem.js';
import { spawnPlayerAtSpawnPoint } from './weaponHelpers.js';

export interface PvPRespawnManagerOptions {
  scene: Scene;
  /**
   * Spawn points available for respawn.
   * Can be updated later via setSpawnPoints.
   */
  spawnPoints: Entity[];
  /** Optional weapon pickup system to honor spawn point weapon config */
  weaponPickupSystem?: WeaponPickupSystem;
  /** Default respawn delay in seconds */
  respawnDelay?: number;
  /** Whether to reset entity health on respawn (default: true) */
  resetHealth?: boolean;
  /** Callback before respawn happens (e.g., cleanup state) */
  onBeforeRespawn?: (entity: Entity) => void;
  /** Callback after respawn completes (e.g., apply loadout) */
  onAfterRespawn?: (entity: Entity, spawnPoint: Entity) => void;
  /** Custom spawn point selector (defaults to uniform random) */
  selectSpawnPoint?: (spawnPoints: Entity[], entity: Entity) => Entity;
}

/**
 * PvPRespawnManager - schedules and performs player respawns with spawn points.
 *
 * Designed as a reusable helper for demos, editor play mode, and runtime.
 */
export class PvPRespawnManager {
  private readonly scene: Scene;
  private spawnPoints: Entity[];
  private readonly weaponPickupSystem?: WeaponPickupSystem;
  private readonly respawnDelay: number;
  private readonly resetHealth: boolean;
  private readonly onBeforeRespawn?: (entity: Entity) => void;
  private readonly onAfterRespawn?: (entity: Entity, spawnPoint: Entity) => void;
  private readonly selectSpawnPoint: (spawnPoints: Entity[], entity: Entity) => Entity;
  private readonly tracked = new Set<Entity>();
  private readonly pending = new Map<Entity, number>();
  private currentTime = 0;

  constructor(options: PvPRespawnManagerOptions) {
    this.scene = options.scene;
    this.spawnPoints = [...options.spawnPoints];
    this.weaponPickupSystem = options.weaponPickupSystem;
    this.respawnDelay = options.respawnDelay ?? 4;
    this.resetHealth = options.resetHealth !== false;
    this.onBeforeRespawn = options.onBeforeRespawn;
    this.onAfterRespawn = options.onAfterRespawn;
    this.selectSpawnPoint =
      options.selectSpawnPoint ??
      ((spawnPoints, entity) => {
        if (spawnPoints.length === 0) {
          throw new Error('PvPRespawnManager: No spawn points configured');
        }
        const index = Math.floor(Math.random() * spawnPoints.length);
        return spawnPoints[index] ?? spawnPoints[0]!;
      });
  }

  register(entity: Entity): void {
    this.tracked.add(entity);
  }

  unregister(entity: Entity): void {
    this.tracked.delete(entity);
    this.pending.delete(entity);
  }

  isTracked(entity: Entity): boolean {
    return this.tracked.has(entity);
  }

  setSpawnPoints(spawnPoints: Entity[]): void {
    this.spawnPoints = [...spawnPoints];
  }

  scheduleRespawn(entity: Entity, delay?: number): void {
    if (!this.tracked.has(entity)) {
      return;
    }
    const targetTime = this.currentTime + (delay ?? this.respawnDelay);
    this.pending.set(entity, targetTime);
  }

  respawnNow(entity: Entity, spawnPoint?: Entity): void {
    if (!this.tracked.has(entity)) {
      return;
    }
    const targetSpawn = spawnPoint ?? this.selectSpawnPoint(this.spawnPoints, entity);
    this.onBeforeRespawn?.(entity);
    spawnPlayerAtSpawnPoint(entity, targetSpawn, this.weaponPickupSystem);
    if (this.resetHealth) {
      this.resetEntityHealth(entity);
    }
    this.onAfterRespawn?.(entity, targetSpawn);
  }

  update(deltaTime: number): void {
    if (!(deltaTime > 0)) {
      return;
    }
    this.currentTime += deltaTime;
    for (const [entity, time] of [...this.pending.entries()]) {
      if (this.currentTime >= time) {
        this.pending.delete(entity);
        this.respawnNow(entity);
      }
    }
  }

  dispose(): void {
    this.tracked.clear();
    this.pending.clear();
  }

  private resetEntityHealth(entity: Entity): void {
    const health = entity.getComponent(HealthComponent);
    if (health) {
      health.currentHealth = health.maxHealth;
    }
  }
}

