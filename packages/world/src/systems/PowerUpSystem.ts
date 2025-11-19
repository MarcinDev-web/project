import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { PowerUpComponent, type PowerUpType } from '../components/PowerUpComponent.js';
import { PowerUpPickupComponent } from '../components/PowerUpPickupComponent.js';
import { ShieldComponent } from '../components/ShieldComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { CharacterController } from '../components/CharacterController.js';
import { distanceVec3 } from '@engine/core/math';

export class PowerUpSystem {
  private readonly scene: Scene;
  private readonly pickupDistance: number = 2.0;
  private readonly scratchVec1: [number, number, number] = [0, 0, 0];
  private readonly scratchVec2: [number, number, number] = [0, 0, 0];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  update(deltaTime: number): void {
    this.updatePickups(deltaTime);
    this.updateActiveBuffs(deltaTime);
    this.checkPickups();
  }

  private updatePickups(deltaTime: number): void {
    const pickups = this.scene.queryEntities(PowerUpPickupComponent);
    for (const entity of pickups) {
      const pickup = entity.getComponent(PowerUpPickupComponent);
      if (!pickup || pickup.isAvailable) continue;

      pickup.cooldown -= deltaTime;
      if (pickup.cooldown <= 0) {
        pickup.isAvailable = true;
        pickup.cooldown = 0;
        // Make visible again
        entity.transform.scale = [1, 1, 1];
        // Emit respawn event
        this.scene.events.emit('powerup:respawn', { entity });
      }
    }
  }

  private updateActiveBuffs(deltaTime: number): void {
    const entities = this.scene.queryEntities(PowerUpComponent);
    for (const entity of entities) {
      const powerUp = entity.getComponent(PowerUpComponent);
      if (!powerUp) continue;

      for (const [type, buff] of powerUp.buffs) {
        buff.elapsed += deltaTime;
        if (buff.elapsed >= buff.duration) {
          this.removeBuff(entity, type);
        }
      }
    }
  }

  private checkPickups(): void {
    const players = this.scene.queryEntities(CharacterController);
    const pickups = this.scene.queryEntities(PowerUpPickupComponent);

    for (const player of players) {
      // Skip dead players
      const health = player.getComponent(HealthComponent);
      if (health && !health.isAlive()) continue;

      const playerPos = player.transform.getWorldPosition();
      this.scratchVec1[0] = playerPos[0];
      this.scratchVec1[1] = playerPos[1];
      this.scratchVec1[2] = playerPos[2];

      for (const pickupEntity of pickups) {
        const pickup = pickupEntity.getComponent(PowerUpPickupComponent);
        if (!pickup || !pickup.isAvailable) continue;

        const pickupPos = pickupEntity.transform.getWorldPosition();
        this.scratchVec2[0] = pickupPos[0];
        this.scratchVec2[1] = pickupPos[1];
        this.scratchVec2[2] = pickupPos[2];

        if (distanceVec3(this.scratchVec1, this.scratchVec2) <= this.pickupDistance) {
          this.collectPickup(player, pickupEntity, pickup);
        }
      }
    }
  }

  private collectPickup(player: Entity, pickupEntity: Entity, pickup: PowerUpPickupComponent): void {
    // Apply effect
    let applied = false;

    switch (pickup.type) {
      case 'Health':
        const health = player.getComponent(HealthComponent);
        if (health && health.currentHealth < health.maxHealth) {
          health.heal(pickup.value);
          applied = true;
        }
        break;

      case 'Shield':
        let shield = player.getComponent(ShieldComponent);
        if (!shield) {
          shield = new ShieldComponent();
          player.addComponent(shield);
        }
        if (shield.currentShield < shield.maxShield) {
          shield.currentShield = Math.min(shield.maxShield, shield.currentShield + pickup.value);
          applied = true;
        }
        break;

      case 'Speed':
      case 'Damage':
        this.applyBuff(player, pickup.type, pickup.value, pickup.duration);
        applied = true;
        break;
    }

    if (applied) {
      // Consume pickup
      pickup.isAvailable = false;
      pickup.cooldown = pickup.respawnTime;
      // Hide pickup
      pickupEntity.transform.scale = [0, 0, 0];
      
      // Emit event
      this.scene.events.emit('powerup:collected', { 
        player, 
        pickup: pickupEntity, 
        type: pickup.type 
      });
    }
  }

  private applyBuff(entity: Entity, type: PowerUpType, value: number, duration: number): void {
    let powerUp = entity.getComponent(PowerUpComponent);
    if (!powerUp) {
      powerUp = new PowerUpComponent();
      entity.addComponent(powerUp);
    }

    const existingBuff = powerUp.buffs.get(type);

    if (existingBuff) {
      // If buff exists, check if we need to update value
      if (existingBuff.value !== value) {
        // Revert old value first
        this.revertBuffEffect(entity, type, existingBuff.value);
        // Apply new value
        this.applyBuffEffect(entity, type, value);
      }
      // Reset duration
      existingBuff.duration = duration;
      existingBuff.elapsed = 0;
      existingBuff.value = value;
    } else {
      // New buff
      powerUp.addBuff(type, value, duration);
      this.applyBuffEffect(entity, type, value);
    }
  }

  private removeBuff(entity: Entity, type: PowerUpType): void {
    const powerUp = entity.getComponent(PowerUpComponent);
    if (!powerUp) return;

    const buff = powerUp.buffs.get(type);
    if (!buff) return;

    this.revertBuffEffect(entity, type, buff.value);
    powerUp.removeBuff(type);
    
    // Emit event
    this.scene.events.emit('powerup:expired', { 
      entity, 
      type 
    });
  }

  private applyBuffEffect(entity: Entity, type: PowerUpType, value: number): void {
    if (type === 'Speed') {
      const controller = entity.getComponent(CharacterController);
      if (controller) {
        controller.config.moveSpeed *= value;
      }
    }
  }

  private revertBuffEffect(entity: Entity, type: PowerUpType, value: number): void {
    if (type === 'Speed') {
      const controller = entity.getComponent(CharacterController);
      if (controller) {
        controller.config.moveSpeed /= value;
      }
    }
  }
}
