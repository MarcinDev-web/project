import { describe, it, expect } from 'vitest';
import { WEAPON_PRESETS, getWeaponPreset, getAllWeaponPresets } from './weapons.js';

describe('weapons', () => {
  describe('WEAPON_PRESETS', () => {
    it('should have presets for all weapon types', () => {
      expect(WEAPON_PRESETS.rifle).toBeDefined();
      expect(WEAPON_PRESETS.shotgun).toBeDefined();
      expect(WEAPON_PRESETS.sniper).toBeDefined();
      expect(WEAPON_PRESETS.pistol).toBeDefined();
      expect(WEAPON_PRESETS.smg).toBeDefined();
      expect(WEAPON_PRESETS.custom).toBeDefined();
    });

    it('should have valid stats for rifle', () => {
      const rifle = WEAPON_PRESETS.rifle;
      expect(rifle.type).toBe('hitscan');
      expect(rifle.damage).toBeGreaterThan(0);
      expect(rifle.fireRate).toBeGreaterThan(0);
      expect(rifle.range).toBeGreaterThan(0);
      expect(rifle.maxAmmo).toBeGreaterThan(0);
      expect(rifle.reloadDuration).toBeGreaterThan(0);
    });

    it('should have valid stats for shotgun', () => {
      const shotgun = WEAPON_PRESETS.shotgun;
      expect(shotgun.type).toBe('projectile');
      expect(shotgun.damage).toBeGreaterThan(0);
      expect(shotgun.projectileSpeed).toBeGreaterThan(0);
      expect(shotgun.projectileLifetime).toBeGreaterThan(0);
    });
  });

  describe('getWeaponPreset', () => {
    it('should return preset for valid type', () => {
      const rifle = getWeaponPreset('rifle');
      expect(rifle.preset).toBe('rifle');
    });

    it('should return different presets for different types', () => {
      const rifle = getWeaponPreset('rifle');
      const sniper = getWeaponPreset('sniper');
      expect(rifle.damage).not.toBe(sniper.damage);
    });
  });

  describe('getAllWeaponPresets', () => {
    it('should return all preset types', () => {
      const presets = getAllWeaponPresets();
      expect(presets.length).toBeGreaterThanOrEqual(6);
      expect(presets).toContain('rifle');
      expect(presets).toContain('shotgun');
    });
  });
});
