/**
 * WeaponHUD Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scene, Entity } from '@engine/world';
import { WeaponHUD } from '../WeaponHUD';
import { WeaponComponent } from '@engine/world/components/WeaponComponent';
import { InventoryComponent } from '@engine/world/components/InventoryComponent';
import { setupPvPLoadout } from '@engine/world';

describe('WeaponHUD', () => {
  let scene: Scene;
  let container: HTMLElement;
  let hud: WeaponHUD;
  let player: Entity;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    container = document.createElement('div');
    document.body.appendChild(container);

    player = scene.createEntity('Player');
    setupPvPLoadout(player);

    hud = new WeaponHUD({
      scene,
      playerEntity: player,
      container,
    });
  });

  afterEach(() => {
    hud.dispose();
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
  });

  it('should create HUD element', () => {
    hud.show();
    expect(hud).toBeDefined();
  });

  it('should show HUD when shown', () => {
    hud.show();
    const root = container.querySelector('.weapon-hud');
    expect(root).toBeDefined();
    expect(root?.classList.contains('visible')).toBe(true);
  });

  it('should hide HUD when hidden', () => {
    hud.show();
    hud.hide();
    const root = container.querySelector('.weapon-hud');
    expect(root?.classList.contains('visible')).toBe(false);
  });

  it('should display weapon name', () => {
    hud.show();
    const nameEl = container.querySelector('.weapon-hud-name');
    expect(nameEl).toBeDefined();
    expect(nameEl?.textContent).toBeTruthy();
  });

  it('should display ammo count', () => {
    hud.show();
    const ammoEl = container.querySelector('.weapon-hud-ammo-current');
    expect(ammoEl).toBeDefined();
    expect(ammoEl?.textContent).toBeTruthy();
  });

  it('should update when player entity changes', () => {
    hud.show();
    const newPlayer = scene.createEntity('New Player');
    setupPvPLoadout(newPlayer);
    
    hud.updatePlayerEntity(newPlayer);
    const nameEl = container.querySelector('.weapon-hud-name');
    expect(nameEl).toBeDefined();
  });

  it('should handle null player entity', () => {
    hud.show();
    hud.updatePlayerEntity(null);
    const nameEl = container.querySelector('.weapon-hud-name');
    expect(nameEl?.textContent).toContain('No Weapon');
  });

  it('should dispose cleanly', () => {
    hud.show();
    hud.dispose();
    const root = container.querySelector('.weapon-hud');
    expect(root).toBeNull();
  });
});

