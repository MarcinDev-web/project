/**
 * PvP Demo Scene - Ready-to-use PvP arena with weapons
 * 
 * Features:
 * - Two spawn points for players
 * - Pre-configured weapons and inventory
 * - WeaponSystem and InventorySystem setup
 * - Health components for damage
 * - Arena layout with cover
 */

import { Scene, Entity, MeshComponent, MaterialComponent } from '@engine/world';
import { WeaponSystem, InventorySystem } from '@engine/world';
import { HealthComponent } from '@engine/world/components/HealthComponent';
import { CharacterController } from '@engine/world/components/CharacterController';
import { PhysicsComponent } from '@engine/world/components/PhysicsComponent';
import { SpawnPointComponent } from '@engine/world/components/SpawnPointComponent';
import { setupPvPLoadout, setupWeaponEntity } from '@engine/world/utils';
import type { Vec3 } from '@engine/core/math';

export interface PvPDemoSceneOptions {
  /** Scene to populate */
  scene: Scene;
  /** Whether to create arena geometry */
  createArena?: boolean;
  /** Arena size (default: 30) */
  arenaSize?: number;
}

/**
 * Creates a PvP demo scene with weapons, spawn points, and systems
 */
export function createPvPDemoScene(options: PvPDemoSceneOptions): {
  scene: Scene;
  weaponSystem: WeaponSystem;
  inventorySystem: InventorySystem;
  player1: Entity;
  player2: Entity;
} {
  const { scene, createArena = true, arenaSize = 30 } = options;

  // Create arena floor and walls if requested
  if (createArena) {
    createArenaGeometry(scene, arenaSize);
  }

  // Create spawn points
  const spawn1 = createSpawnPoint(scene, 'Spawn Point 1', [-10, 1, 0]);
  const spawn2 = createSpawnPoint(scene, 'Spawn Point 2', [10, 1, 0]);

  // Create player entities
  const player1 = createPlayer(scene, 'Player 1', [-10, 1, 0]);
  const player2 = createPlayer(scene, 'Player 2', [10, 1, 0]);

  // Setup weapons for players
  setupPvPLoadout(player1);
  setupPvPLoadout(player2);

  // Initialize weapon systems
  const weaponSystem = new WeaponSystem(scene);
  const inventorySystem = new InventorySystem(scene);

  return {
    scene,
    weaponSystem,
    inventorySystem,
    player1,
    player2,
  };
}

/**
 * Creates arena geometry (floor and walls)
 */
function createArenaGeometry(scene: Scene, size: number): void {
  const halfSize = Math.floor(size / 2);

  // Floor
  for (let x = -halfSize; x <= halfSize; x++) {
    for (let z = -halfSize; z <= halfSize; z++) {
      const floor = new Entity(`Floor_${x}_${z}`);
      floor.transform.position = [x, -0.5, z];
      floor.transform.scale = [1, 1, 1];
      
      const mesh = new MeshComponent();
      mesh.meshId = 1; // Cube mesh
      floor.addComponent(mesh);
      
      const material = new MaterialComponent();
      material.materialId = (x + z) % 2 === 0 ? 1 : 4; // Stone or grass
      floor.addComponent(material);
      
      scene.addEntity(floor);
    }
  }

  // Walls (simple boundary)
  const wallHeight = 3;
  for (let i = -halfSize; i <= halfSize; i++) {
    // North wall
    createWallBlock(scene, `Wall_N_${i}`, [i, wallHeight / 2, halfSize], wallHeight);
    // South wall
    createWallBlock(scene, `Wall_S_${i}`, [i, wallHeight / 2, -halfSize], wallHeight);
    // East wall
    createWallBlock(scene, `Wall_E_${i}`, [halfSize, wallHeight / 2, i], wallHeight);
    // West wall
    createWallBlock(scene, `Wall_W_${i}`, [-halfSize, wallHeight / 2, i], wallHeight);
  }

  // Cover objects (crates/barriers)
  createCoverObject(scene, 'Cover_1', [-5, 0.5, 0]);
  createCoverObject(scene, 'Cover_2', [5, 0.5, 0]);
  createCoverObject(scene, 'Cover_3', [0, 0.5, -5]);
  createCoverObject(scene, 'Cover_4', [0, 0.5, 5]);
}

/**
 * Creates a wall block
 */
function createWallBlock(scene: Scene, name: string, position: Vec3, height: number): void {
  const wall = new Entity(name);
  wall.transform.position = position;
  wall.transform.scale = [1, height, 1];
  
  const mesh = new MeshComponent();
  mesh.meshId = 1; // Cube mesh
  wall.addComponent(mesh);
  
  const material = new MaterialComponent();
  material.materialId = 1; // Stone
  wall.addComponent(material);
  
  scene.addEntity(wall);
}

/**
 * Creates a cover object (crate/barrier)
 */
function createCoverObject(scene: Scene, name: string, position: Vec3): void {
  const cover = new Entity(name);
  cover.transform.position = position;
  cover.transform.scale = [2, 1, 2];
  
  const mesh = new MeshComponent();
  mesh.meshId = 1; // Cube mesh
  cover.addComponent(mesh);
  
  const material = new MaterialComponent();
  material.materialId = 14; // Concrete
  cover.addComponent(material);
  
  // Add physics for collision
  const physics = new PhysicsComponent();
  physics.shape = 'box';
  physics.mass = 0; // Static
  cover.addComponent(physics);
  
  scene.addEntity(cover);
}

/**
 * Creates a spawn point entity
 */
function createSpawnPoint(scene: Scene, name: string, position: Vec3): Entity {
  const spawn = new Entity(name);
  spawn.transform.position = position;
  
  const spawnComp = new SpawnPointComponent();
  spawn.addComponent(spawnComp);
  
  scene.addEntity(spawn);
  return spawn;
}

/**
 * Creates a player entity with health, character controller, and physics
 */
function createPlayer(scene: Scene, name: string, position: Vec3): Entity {
  const player = new Entity(name);
  player.transform.position = position;

  // Health component
  const health = new HealthComponent();
  health.maxHealth = 100;
  health.currentHealth = 100;
  player.addComponent(health);

  // Character controller
  const controller = new CharacterController();
  controller.speed = 5.0;
  controller.jumpHeight = 2.0;
  player.addComponent(controller);

  // Physics component
  const physics = new PhysicsComponent();
  physics.shape = 'capsule';
  physics.mass = 1.0;
  physics.radius = 0.5;
  physics.height = 2.0;
  player.addComponent(physics);

  scene.addEntity(player);
  return player;
}

/**
 * Quick setup function to add PvP demo to existing scene
 */
export function addPvPDemoToScene(scene: Scene): {
  weaponSystem: WeaponSystem;
  inventorySystem: InventorySystem;
  player1: Entity;
  player2: Entity;
} {
  const result = createPvPDemoScene({
    scene,
    createArena: false, // Don't recreate arena if scene already has geometry
    arenaSize: 30,
  });

  return {
    weaponSystem: result.weaponSystem,
    inventorySystem: result.inventorySystem,
    player1: result.player1,
    player2: result.player2,
  };
}

