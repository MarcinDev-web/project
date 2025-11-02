# Weapon System Usage Guide

Quick guide for creators to use the weapon system in PvP gameplay.

## Quick Start

### 1. Setup Single Weapon Entity

```typescript
import { Scene, Entity } from '@engine/world';
import { setupWeaponEntity, WeaponLoadouts } from '@engine/world/utils';

const scene = new Scene();
const player = scene.createEntity('player');

// Option A: Use preset loadout
WeaponLoadouts.assaultRifle(player);

// Option B: Custom setup
setupWeaponEntity(player, 'rifle', {
  attachments: ['red_dot', 'vertical_grip', 'extended_mag'],
  ammoType: 'standard',
  ammoCount: 90,
});
```

### 2. Setup Weapon Inventory

```typescript
import { setupInventory, setupPvPLoadout } from '@engine/world/utils';

// Quick PvP loadout (rifle + pistol + sniper)
setupPvPLoadout(player);

// Or custom inventory
setupInventory(player, [
  { preset: 'rifle', attachments: ['red_dot'], ammoType: 'standard' },
  { preset: 'sniper', attachments: ['sniper_scope'], ammoType: 'armor_piercing' },
  { preset: 'pistol', ammoType: 'hollow_point' },
], {
  maxWeapons: 9,
  switchDuration: 0.5,
});
```

### 3. Fire Weapons

```typescript
import { WeaponSystem, InventorySystem } from '@engine/world';

const weaponSystem = new WeaponSystem(scene);
const inventorySystem = new InventorySystem(scene);

// Update systems each frame
weaponSystem.update(deltaTime);
inventorySystem.update(deltaTime);

// Fire active weapon
weaponSystem.fire(player, [0, 0, -1]); // Fire forward

// Switch weapon
inventorySystem.switchWeapon(player, 1); // Switch to weapon at index 1

// Reload
weaponSystem.reload(player);
```

## Available Weapon Presets

- `'rifle'` - Assault rifle (balanced)
- `'shotgun'` - Close range projectile weapon
- `'sniper'` - Long range high damage
- `'pistol'` - Sidearm
- `'smg'` - High fire rate, short range
- `'custom'` - Default stats

## Available Attachments

### Scopes
- `'red_dot'` - Red dot sight (-30% spread)
- `'acog'` - Medium magnification (-50% spread, +20% range)
- `'sniper_scope'` - High magnification (-70% spread, +50% range)

### Suppressors
- `'light_suppressor'` - Slight damage reduction (-5% damage, -10% range)
- `'heavy_suppressor'` - Maximum suppression (-15% damage, -20% range)

### Grips
- `'vertical_grip'` - Recoil reduction (-15% spread, +10% reload time)
- `'angled_grip'` - Handling (+10% fire rate, -5% reload time)

### Magazines
- `'extended_mag'` - More ammo (+50% capacity, +20% reload time)
- `'fast_mag'` - Faster reload (-30% reload time)

### Barrels
- `'long_barrel'` - Range and damage (+10% damage, +30% range)
- `'short_barrel'` - Handling (-10% damage, -20% range, +15% fire rate)

## Available Ammo Types

- `'standard'` - Balanced (100% damage)
- `'armor_piercing'` - Ignores 50% armor, -10% damage
- `'hollow_point'` - +20% damage, less effective vs armor
- `'incendiary'` - Damage over time, -15% initial damage
- `'explosive'` - Area damage, -25% direct damage

## Dynamic Modifications

```typescript
import { addAttachment, addAmmo, changeAmmoType, getEffectiveWeaponStats } from '@engine/world/utils';

// Add attachment during gameplay
addAttachment(player, 'extended_mag');

// Add ammo
addAmmo(player, 'armor_piercing', 30);

// Change ammo type
changeAmmoType(player, 'armor_piercing');

// Check effective stats
const stats = getEffectiveWeaponStats(player);
console.log('Damage:', stats.damage);
console.log('Spread:', stats.spread);
```

## Event Handling

```typescript
// Listen to weapon events
scene.events.on('weapon:fire', (event) => {
  console.log('Fired:', event.damage, event.weaponType);
});

scene.events.on('weapon:reload', (event) => {
  console.log('Reloading:', event.reloadDuration);
});

scene.events.on('weapon:switched', (event) => {
  console.log('Switched to:', event.newWeaponIndex);
});

scene.events.on('inventory:updated', (event) => {
  console.log('Inventory:', event.action);
});
```

## Preset Loadouts

Quick setup functions for common configurations:

```typescript
import { WeaponLoadouts } from '@engine/world/utils';

WeaponLoadouts.assaultRifle(player);  // Rifle with attachments
WeaponLoadouts.sniper(player);        // Sniper setup
WeaponLoadouts.closeQuarters(player); // Shotgun setup
WeaponLoadouts.smg(player);           // SMG setup
```

## Complete Example

```typescript
import { Scene, Entity } from '@engine/world';
import { WeaponSystem, InventorySystem } from '@engine/world';
import { setupPvPLoadout } from '@engine/world/utils';

const scene = new Scene();
const player = scene.createEntity('player');
player.transform.position = [0, 0, 0];

// Setup inventory
setupPvPLoadout(player);

// Setup systems
const weaponSystem = new WeaponSystem(scene);
const inventorySystem = new InventorySystem(scene);

// Game loop
function gameLoop(deltaTime: number) {
  weaponSystem.update(deltaTime);
  inventorySystem.update(deltaTime);
  
  // Input handling
  if (input.firePressed) {
    weaponSystem.fire(player, camera.forward);
  }
  
  if (input.reloadPressed) {
    weaponSystem.reload(player);
  }
  
  if (input.weaponSwitchPressed) {
    const currentIndex = inventory.getActiveWeaponIndex();
    inventorySystem.switchWeapon(player, (currentIndex + 1) % 3));
  }
}
```

## Helper Functions Reference

### Setup Functions
- `setupWeaponEntity(entity, preset, options?)` - Setup single weapon
- `setupInventory(entity, weapons, options?)` - Setup weapon inventory
- `setupPvPLoadout(entity)` - Quick PvP setup

### Modification Functions
- `addAttachment(entity, attachmentId)` - Add attachment
- `removeAttachment(entity, attachmentType)` - Remove attachment
- `addAmmo(entity, ammoType, amount)` - Add ammo
- `changeAmmoType(entity, ammoType)` - Change loaded ammo type

### Query Functions
- `getEffectiveWeaponStats(entity)` - Get effective stats (with modifiers)
- `getAvailableAttachmentsByType(type)` - Get attachment IDs by type
- `getAllAttachmentIds()` - Get all attachment IDs
- `getAllAmmoTypeNames()` - Get all ammo type names

### Loadouts
- `WeaponLoadouts.assaultRifle(entity)` - Assault rifle loadout
- `WeaponLoadouts.sniper(entity)` - Sniper loadout
- `WeaponLoadouts.closeQuarters(entity)` - Shotgun loadout
- `WeaponLoadouts.smg(entity)` - SMG loadout
