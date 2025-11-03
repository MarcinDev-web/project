import { describe, it, expect, beforeEach } from 'vitest';
import { AmmoComponent } from './AmmoComponent.js';

describe('AmmoComponent', () => {
  let ammo: AmmoComponent;

  beforeEach(() => {
    ammo = new AmmoComponent();
  });

  it('should create empty ammo component', () => {
    expect(ammo.getTotalAmmoCount()).toBe(0);
    expect(ammo.getAmmoCount('standard')).toBe(0);
  });

  it('should add ammo', () => {
    ammo.addAmmo('standard', 30);
    expect(ammo.getAmmoCount('standard')).toBe(30);
    expect(ammo.hasAmmo('standard')).toBe(true);
  });

  it('should consume ammo', () => {
    ammo.addAmmo('standard', 30);
    const consumed = ammo.consumeAmmo('standard', 10);
    expect(consumed).toBe(10);
    expect(ammo.getAmmoCount('standard')).toBe(20);
  });

  it('should not consume more ammo than available', () => {
    ammo.addAmmo('standard', 5);
    const consumed = ammo.consumeAmmo('standard', 10);
    expect(consumed).toBe(5);
    expect(ammo.getAmmoCount('standard')).toBe(0);
  });

  it('should track multiple ammo types', () => {
    ammo.addAmmo('standard', 30);
    ammo.addAmmo('armor_piercing', 20);
    expect(ammo.getAmmoCount('standard')).toBe(30);
    expect(ammo.getAmmoCount('armor_piercing')).toBe(20);
    expect(ammo.getTotalAmmoCount()).toBe(50);
  });

  it('should get available types', () => {
    ammo.addAmmo('standard', 10);
    ammo.addAmmo('armor_piercing', 5);
    const types = ammo.getAvailableTypes();
    expect(types).toContain('standard');
    expect(types).toContain('armor_piercing');
    expect(types).not.toContain('incendiary');
  });

  it('should clear all ammo', () => {
    ammo.addAmmo('standard', 30);
    ammo.addAmmo('armor_piercing', 20);
    ammo.clear();
    expect(ammo.getTotalAmmoCount()).toBe(0);
  });
});
