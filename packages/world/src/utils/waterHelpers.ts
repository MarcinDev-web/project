import type { Entity } from '../core/Entity.js';
import { WaterComponent } from '../components/WaterComponent.js';
import type { Vec2, Vec3 } from '@engine/core/math';

/**
 * Helper functions for working with water in games
 */

/**
 * Check if an entity has water component
 */
export function hasWater(entity: Entity): boolean {
  return entity.getComponent(WaterComponent) !== null;
}

/**
 * Get water component from entity (if exists)
 */
export function getWater(entity: Entity): WaterComponent | null {
  return entity.getComponent(WaterComponent) || null;
}

/**
 * Set water size
 */
export function setWaterSize(entity: Entity, size: Vec2): boolean {
  const water = getWater(entity);
  if (!water) return false;
  water.size = size;
  return true;
}

/**
 * Set water position (via entity transform)
 */
export function setWaterPosition(entity: Entity, position: Vec3): boolean {
  if (!hasWater(entity)) return false;
  entity.transform.position = position;
  return true;
}

/**
 * Enable or disable water rendering
 */
export function setWaterEnabled(entity: Entity, enabled: boolean): boolean {
  const water = getWater(entity);
  if (!water) return false;
  water.enabled = enabled;
  return true;
}

/**
 * Set water animation speed
 */
export function setWaterSpeed(entity: Entity, speed: number): boolean {
  const water = getWater(entity);
  if (!water) return false;
  water.waveSpeed = speed;
  return true;
}

/**
 * Set water color tint
 */
export function setWaterColor(
  entity: Entity,
  r: number,
  g: number,
  b: number,
  a: number = 0.7
): boolean {
  const water = getWater(entity);
  if (!water) return false;
  water.waterColor = [r, g, b, a];
  return true;
}

/**
 * Set water transparency (0 = opaque, 1 = fully transparent)
 */
export function setWaterTransparency(entity: Entity, transparency: number): boolean {
  const water = getWater(entity);
  if (!water) return false;
  water.transparency = Math.max(0, Math.min(1, transparency));
  return true;
}

