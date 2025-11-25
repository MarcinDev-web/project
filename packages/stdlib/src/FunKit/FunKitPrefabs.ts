/**
 * Fun Kit Prefabs - Factory functions for interactive gameplay blocks
 */

import type { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { Transform } from '@engine/world';
import {
  CheckpointComponent,
  TimerGateComponent,
  LaunchPadComponent,
  BouncePadComponent,
  MovingPlatformComponent,
  HazardZoneComponent,
  SpeedZoneComponent,
} from '@engine/world';
import type { Vec3 } from '@engine/core';

/**
 * Create a checkpoint entity
 */
export function createCheckpoint(
  scene: Scene,
  position: Vec3,
  rotation?: number,
  activationRadius?: number
): Entity {
  const entity = new Entity('Checkpoint', new Transform());
  entity.transform.position = [...position] as Vec3;
  if (rotation !== undefined) {
    entity.transform.rotation = [0, rotation, 0, 1];
  }

  const checkpoint = new CheckpointComponent();
  if (rotation !== undefined) {
    checkpoint.rotation = rotation;
  }
  if (activationRadius !== undefined) {
    checkpoint.activationRadius = activationRadius;
  }
  entity.addComponent(checkpoint);

  scene.addEntity(entity);
  return entity;
}

/**
 * Create a timer gate (start or finish)
 */
export function createTimerGate(
  scene: Scene,
  position: Vec3,
  type: 'start' | 'finish',
  timeLimit?: number,
  autoStart?: boolean
): Entity {
  const entity = new Entity(`TimerGate_${type}`, new Transform());
  entity.transform.position = [...position] as Vec3;

  const gate = new TimerGateComponent();
  gate.gateType = type;
  if (timeLimit !== undefined) {
    gate.timeLimit = timeLimit;
  }
  if (autoStart !== undefined) {
    gate.autoStart = autoStart;
  }
  entity.addComponent(gate);

  scene.addEntity(entity);
  return entity;
}

/**
 * Create a launch pad
 */
export function createLaunchPad(
  scene: Scene,
  position: Vec3,
  direction: Vec3,
  force?: number
): Entity {
  const entity = new Entity('LaunchPad', new Transform());
  entity.transform.position = [...position] as Vec3;

  const pad = new LaunchPadComponent();
  pad.direction = [...direction] as Vec3;
  if (force !== undefined) {
    pad.force = force;
  }
  entity.addComponent(pad);

  scene.addEntity(entity);
  return entity;
}

/**
 * Create a bounce pad
 */
export function createBouncePad(scene: Scene, position: Vec3, bounceForce?: number): Entity {
  const entity = new Entity('BouncePad', new Transform());
  entity.transform.position = [...position] as Vec3;

  const pad = new BouncePadComponent();
  if (bounceForce !== undefined) {
    pad.bounceForce = bounceForce;
  }
  entity.addComponent(pad);

  scene.addEntity(entity);
  return entity;
}

/**
 * Create a moving platform
 */
export function createMovingPlatform(
  scene: Scene,
  position: Vec3,
  waypoints: Vec3[],
  speed?: number,
  loop?: boolean
): Entity {
  const entity = new Entity('MovingPlatform', new Transform());
  entity.transform.position = [...position] as Vec3;

  const platform = new MovingPlatformComponent();
  platform.waypoints = waypoints.map((w) => [...w] as Vec3);
  if (speed !== undefined) {
    platform.speed = speed;
  }
  if (loop !== undefined) {
    platform.loop = loop;
  }
  entity.addComponent(platform);

  scene.addEntity(entity);
  return entity;
}

/**
 * Create a hazard zone
 */
export function createHazardZone(
  scene: Scene,
  position: Vec3,
  killZone?: boolean,
  damagePerSecond?: number
): Entity {
  const entity = new Entity('HazardZone', new Transform());
  entity.transform.position = [...position] as Vec3;

  const hazard = new HazardZoneComponent();
  if (killZone !== undefined) {
    hazard.killZone = killZone;
  }
  if (damagePerSecond !== undefined) {
    hazard.damagePerSecond = damagePerSecond;
  }
  entity.addComponent(hazard);

  scene.addEntity(entity);
  return entity;
}

/**
 * Create a speed zone
 */
export function createSpeedZone(
  scene: Scene,
  position: Vec3,
  speedMultiplier?: number,
  direction?: Vec3
): Entity {
  const entity = new Entity('SpeedZone', new Transform());
  entity.transform.position = [...position] as Vec3;

  const zone = new SpeedZoneComponent();
  if (speedMultiplier !== undefined) {
    zone.speedMultiplier = speedMultiplier;
  }
  if (direction !== undefined) {
    zone.direction = [...direction] as Vec3;
  }
  entity.addComponent(zone);

  scene.addEntity(entity);
  return entity;
}
