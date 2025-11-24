import { 
  Entity, 
  Scene, 
  EnvironmentComponent, 
  LightComponent, 
  MeshComponent, 
  MaterialComponent, 
  SpawnPointComponent, 
  CheckpointComponent,
  MovingPlatformComponent,
  LaunchPadComponent,
  NpcComponent,
  WeaponComponent,
  WeaponPickupComponent,
  PowerUpPickupComponent,
  HealthComponent
} from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import type { TemplateProvider } from '../../types';
import type { WeaponPresetType } from '@engine/world/types/weapon.js';

export function createSkyIslandsTemplate(): TemplateProvider {
  return {
    meta: {
      id: 'template:sky-islands',
      kind: 'template',
      name: 'SkyForge: Sky Islands',
      description: 'A parkour playground with floating islands, moving platforms, enemies, and collectibles.',
      tags: ['game', 'parkour', 'sky', 'combat', 'prototype'],
      version: '1.1.0',
    },
    build: () => {
      const scene = new Scene('Sky Islands');

      // --- Environment ---
      const env = new Entity('Environment');
      const envComp = new EnvironmentComponent();
      envComp.skyboxType = 'procedural-sky';
      envComp.ambientIntensity = 0.4;
      envComp.fogDensity = 0.002; 
      envComp.fogColor = [0.7, 0.8, 1.0];
      env.addComponent(envComp);
      scene.addEntity(env);

      const sun = new Entity('Sun');
      const sunLight = new LightComponent();
      sunLight.lightType = 'directional';
      sunLight.color = [1.0, 0.95, 0.8];
      sunLight.intensity = 1.5;
      sunLight.direction = [-0.5, -1.0, -0.3];
      sunLight.castShadows = true;
      sun.addComponent(sunLight);
      scene.addEntity(sun);

      // --- Materials ---
      const grassColor = [0.2, 0.8, 0.3, 1.0];
      const stoneColor = [0.5, 0.5, 0.5, 1.0];
      const woodColor = [0.6, 0.4, 0.2, 1.0];
      const metalColor = [0.8, 0.8, 0.9, 1.0];
      const bounceColor = [1.0, 0.5, 0.0, 1.0];
      const checkpointColor = [0.2, 1.0, 1.0, 0.5];
      const enemyColor = [1.0, 0.2, 0.2, 1.0];
      const weaponColor = [0.3, 0.3, 1.0, 1.0];
      const crystalColor = [0.0, 1.0, 1.0, 0.8];

      // Helper to create a block
      const createBlock = (name: string, pos: number[], size: number[], color: number[], _isStatic = true) => {
        const entity = new Entity(name);
        const mesh = new MeshComponent();
        mesh.meshType = 'cube';
        entity.addComponent(mesh);
        
        const material = new MaterialComponent();
        material.color = color as any;
        entity.addComponent(material);

        entity.transform.position = pos as Vec3;
        entity.transform.scale = size as Vec3;
        
        return entity;
      };

      // Helper to create enemy
      const createEnemy = (name: string, pos: number[], type: 'patrol' | 'guard' = 'guard') => {
        const entity = new Entity(name);
        
        const mesh = new MeshComponent();
        mesh.meshType = 'capsule';
        entity.addComponent(mesh);
        
        const material = new MaterialComponent();
        material.color = enemyColor as any;
        entity.addComponent(material);

        // Add NPC components
        const npc = new NpcComponent();
        npc.faction = 'enemy';
        npc.unitType = 'soldier';
        npc.detectionRange = 15.0;
        
        if (type === 'patrol') {
          npc.behavior = 'patrol';
          // Patrol around spawn
          npc.patrolWaypoints = [
            [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0],
            [(pos[0] ?? 0) + 5, pos[1] ?? 0, (pos[2] ?? 0) + 5],
            [(pos[0] ?? 0) - 5, pos[1] ?? 0, (pos[2] ?? 0) + 5],
            [pos[0] ?? 0, pos[1] ?? 0, (pos[2] ?? 0) - 5]
          ];
        } else {
          npc.behavior = 'guard-position';
          npc.guardPosition = [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0];
          npc.guardRadius = 8.0;
        }
        entity.addComponent(npc);

        // Add Health
        const health = new HealthComponent();
        health.maxHealth = 50;
        health.currentHealth = 50;
        entity.addComponent(health);

        // Add Weapon
        const weapon = new WeaponComponent();
        weapon.damage = 10;
        weapon.fireRate = 1.0; // 1 shot per second
        weapon.range = 20;
        weapon.weaponType = 'projectile';
        entity.addComponent(weapon);

        entity.transform.position = pos as Vec3;
        return entity;
      };

      // Helper to create collectible
      const createCrystal = (name: string, pos: number[]) => {
        const entity = new Entity(name);
        
        const mesh = new MeshComponent();
        mesh.meshType = 'box'; // Using box for crystal
        entity.addComponent(mesh);
        
        const material = new MaterialComponent();
        material.color = crystalColor as any;
        material.emissiveIntensity = 1.0;
        material.emissiveColor = [0.0, 1.0, 1.0, 1.0];
        entity.addComponent(material);

        const pickup = new PowerUpPickupComponent();
        pickup.type = 'Speed'; // Speed boost!
        pickup.value = 1.5; // 50% faster
        pickup.duration = 10.0; // 10 seconds
        pickup.respawnTime = 15.0;
        entity.addComponent(pickup);

        entity.transform.position = pos as Vec3;
        entity.transform.scale = [0.5, 0.8, 0.5]; // Crystal shape-ish
        
        // Add simple rotation animation component? (Not available in simple setup, relying on systems)
        
        return entity;
      };

      // Helper to create weapon pickup
      const createWeaponPickup = (name: string, pos: number[], preset: WeaponPresetType) => {
        const entity = new Entity(name);
        
        const mesh = new MeshComponent();
        mesh.meshType = 'box';
        entity.addComponent(mesh);
        
        const material = new MaterialComponent();
        material.color = weaponColor as any;
        entity.addComponent(material);

        const pickup = new WeaponPickupComponent();
        pickup.weaponPreset = preset;
        pickup.respawnTime = 30.0;
        entity.addComponent(pickup);

        entity.transform.position = pos as Vec3;
        entity.transform.scale = [0.8, 0.3, 0.8];
        
        return entity;
      };

      // --- 1. Start Platform (Safety Zone) ---
      const startPlat = createBlock('StartPlatform', [0, 0, 0], [20, 1, 20], grassColor);
      scene.addEntity(startPlat);

      // Spawn Point
      const spawnPoint = new Entity('PlayerStart');
      const spawnComp = new SpawnPointComponent();
      spawnComp.isDefault = true;
      spawnPoint.addComponent(spawnComp);
      spawnPoint.transform.position = [0, 2, 0];
      scene.addEntity(spawnPoint);

      // Starter Weapon (Pistol)
      const starterWeapon = createWeaponPickup('StarterPistol', [2, 1, 2], 'pistol');
      scene.addEntity(starterWeapon);

      // --- 2. The Floating Steps (Moving Platforms) ---
      // Step 1: Static lead-in
      scene.addEntity(createBlock('Step1', [0, 1, 15], [4, 0.5, 4], stoneColor));
      
      // Moving Platform 1 (Simple back and forth)
      const moving1 = createBlock('MovingPlat1', [0, 1, 25], [4, 0.5, 4], woodColor);
      const mp1 = new MovingPlatformComponent();
      mp1.waypoints = [[0, 1, 25], [0, 5, 35]];
      mp1.speed = 3.0;
      mp1.loop = true;
      moving1.addComponent(mp1);
      scene.addEntity(moving1);

      // Checkpoint 1 on a stable island
      const island1 = createBlock('Island1', [0, 5, 45], [12, 2, 12], grassColor);
      scene.addEntity(island1);
      
      const cp1 = new Entity('Checkpoint1');
      const cp1Comp = new CheckpointComponent();
      cp1Comp.activationRadius = 4.0;
      cp1.addComponent(cp1Comp);
      cp1.transform.position = [0, 7, 45];
      // Visual marker for checkpoint
      const cp1Vis = createBlock('CP1_Vis', [0, 7.5, 45], [0.5, 3, 0.5], checkpointColor);
      scene.addEntity(cp1Vis);
      scene.addEntity(cp1);

      // First Enemy! (Patrolling Island 1)
      const enemy1 = createEnemy('PatrolBot1', [0, 7, 45], 'patrol');
      scene.addEntity(enemy1);

      // --- 3. The Launch Pad Jump ---
      // Gap to cross
      const gapStart = createBlock('GapStart', [10, 6, 45], [6, 1, 4], stoneColor);
      scene.addEntity(gapStart);

      // Launch Pad
      const launchPad = createBlock('LaunchPad', [12, 7, 45], [2, 0.2, 2], bounceColor);
      const lpComp = new LaunchPadComponent();
      lpComp.force = 15.0;
      lpComp.direction = [1, 1.5, 0]; // Launch forward-up towards X+
      launchPad.addComponent(lpComp);
      scene.addEntity(launchPad);

      // Target Island
      const island2 = createBlock('Island2', [30, 15, 45], [15, 5, 15], grassColor);
      scene.addEntity(island2);

      // Guard Enemy on Island 2
      const enemy2 = createEnemy('GuardBot1', [30, 18.5, 45], 'guard');
      scene.addEntity(enemy2);

      // Better Weapon (Rifle) on Island 2
      const riflePickup = createWeaponPickup('RiflePickup', [35, 18, 45], 'rifle');
      scene.addEntity(riflePickup);

      // --- 4. The Tower (Verticality) ---
      const towerBase = [30, 17.5, 45];
      
      // Spiral staircase around a non-existent pillar
      for (let i = 0; i < 8; i++) {
        const angle = i * (Math.PI / 2);
        const radius = 8;
        const height = i * 3;
        const x = (towerBase[0] ?? 0) + Math.cos(angle) * radius;
        const z = (towerBase[2] ?? 0) + Math.sin(angle) * radius;
        const y = (towerBase[1] ?? 0) + height;
        
        const step = createBlock(`TowerStep${i}`, [x, y, z], [3, 0.5, 3], metalColor);
        scene.addEntity(step);

        // Collectible on every 2nd step
        if (i % 2 === 0) {
             const crystal = createCrystal(`Crystal_${i}`, [x, y + 1, z]);
             scene.addEntity(crystal);
        }
      }

      // Summit
      const summit = createBlock('Summit', [30, 45, 45], [8, 1, 8], [1.0, 0.84, 0.0, 1.0]); // Goldish
      scene.addEntity(summit);

      // Boss Enemy? (Just a stronger guard)
      const boss = createEnemy('BossBot', [30, 47, 45], 'guard');
      const bossHealth = boss.getComponent(HealthComponent);
      if (bossHealth) bossHealth.maxHealth = 200;
      boss.transform.scale = [1.5, 1.5, 1.5];
      scene.addEntity(boss);

      // Checkpoint at summit
      const cp2 = new Entity('Checkpoint_Summit');
      const cp2Comp = new CheckpointComponent();
      cp2Comp.activationRadius = 4.0;
      cp2.addComponent(cp2Comp);
      cp2.transform.position = [30, 46, 45];
      scene.addEntity(cp2);

      return scene;
    }
  };
}
