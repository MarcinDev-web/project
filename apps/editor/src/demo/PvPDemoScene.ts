/**
 * PvP Demo Scene - ready-to-use PvP arena with gameplay helpers.
 *
 * Enhancements (Nov 2025):
 * - Visual input overlay (optional, auto when DOM available)
 * - Built-in WeaponPickupSystem + InteractionSystem wiring
 * - Randomized loadouts & automated respawn manager
 * - Spawn points configured with givePvPLoadout + spawnPlayerAtSpawnPoint flow
 * - Optional HUD + network bootstrap helpers
 */

import {
  AttachmentComponent,
  CameraComponent,
  CharacterController,
  Entity,
  HealthComponent,
  InteractionSystem,
  InventoryComponent,
  InventorySystem,
  MaterialComponent,
  MeshComponent,
  PhysicsComponent,
  RigidbodyType,
  Scene,
  SpawnPointComponent,
  WeaponComponent,
  WeaponPickupSystem,
  WeaponSystem,
  PvPRespawnManager,
  setupInventory,
  setupPvPLoadout,
  setupWeaponEntity,
  spawnPlayerAtSpawnPoint,
} from '@engine/world';
import type { CharacterInput } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import { WeaponPickupComponent } from '@engine/world/components/WeaponPickupComponent';
import { InteractableComponent } from '@engine/world/components/InteractableComponent';
import type { WeaponPresetType, AmmoType } from '@engine/world/types/weapon';
import type { Vec3 } from '@engine/core/math';
import { CharacterInputHandler, type InputBindings } from '@engine/input';
import { WeaponHUD } from '../editor/ui/WeaponHUD';
import { MultiplayerGameplayManager } from '@engine/net';
import type { ReplicationClient } from '@engine/net';

const DEFAULT_INPUT_BINDINGS: InputBindings = {
  movement: {
    forward: ['KeyW', 'ArrowUp'],
    backward: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
  },
  actions: {
    jump: ['Space'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    interact: ['KeyE'],
  },
};

interface RandomLoadout {
  label: string;
  weapons: Array<{
    preset: WeaponPresetType;
    attachments?: string[];
    ammoType?: AmmoType;
    weaponAmmo?: number;
  }>;
  maxWeapons?: number;
  switchDuration?: number;
}

const RANDOM_LOADOUTS: ReadonlyArray<RandomLoadout> = [
  {
    label: 'Balanced',
    weapons: [
      {
        preset: 'rifle',
        attachments: ['red_dot', 'vertical_grip'],
        ammoType: 'standard',
        weaponAmmo: 30,
      },
      {
        preset: 'pistol',
        attachments: ['light_suppressor'],
        ammoType: 'hollow_point',
        weaponAmmo: 12,
      },
    ],
  },
  {
    label: 'Marksman',
    weapons: [
      {
        preset: 'sniper',
        attachments: ['sniper_scope', 'long_barrel'],
        ammoType: 'armor_piercing',
        weaponAmmo: 5,
      },
      {
        preset: 'smg',
        attachments: ['red_dot', 'fast_mag'],
        ammoType: 'standard',
        weaponAmmo: 40,
      },
    ],
    switchDuration: 0.35,
  },
  {
    label: 'Close Quarters',
    weapons: [
      {
        preset: 'shotgun',
        attachments: ['short_barrel'],
        ammoType: 'hollow_point',
        weaponAmmo: 6,
      },
      {
        preset: 'smg',
        attachments: ['fast_mag'],
        ammoType: 'standard',
        weaponAmmo: 35,
      },
      {
        preset: 'pistol',
        ammoType: 'standard',
        weaponAmmo: 12,
      },
    ],
    maxWeapons: 6,
  },
];

const PICKUP_PRESETS: ReadonlyArray<WeaponPresetType> = ['rifle', 'shotgun', 'smg', 'sniper'];
const PICKUP_POSITIONS: ReadonlyArray<Vec3> = [
  [-8, 1, 4],
  [8, 1, -4],
  [0, 1, 8],
  [0, 1, -8],
];
const DEFAULT_RESPAWN_DELAY = 4;

function applyRandomLoadout(entity: Entity): void {
  entity.removeComponent(InventoryComponent);
  entity.removeComponent(AttachmentComponent);
  entity.removeComponent(WeaponComponent);

  const loadout = RANDOM_LOADOUTS[Math.floor(Math.random() * RANDOM_LOADOUTS.length)]!;
  setupInventory(entity, loadout.weapons, {
    maxWeapons: loadout.maxWeapons ?? 9,
    switchDuration: loadout.switchDuration ?? 0.45,
  });
}

export interface PvPNetworkOptions {
  replicationClient: ReplicationClient;
  sessionId: string;
  physicsWorld: PhysicsWorld;
  autoStart?: boolean;
}

export interface PvPDemoSceneOptions {
  scene: Scene;
  createArena?: boolean;
  arenaSize?: number;
  hudContainer?: HTMLElement | null;
  inputContainer?: HTMLElement | null;
  canvas?: HTMLCanvasElement | null;
  enableHUD?: boolean;
  enableInputVisualizer?: boolean;
  enableWeaponPickups?: boolean;
  network?: PvPNetworkOptions | null;
}

export interface PvPDemoSceneResult {
  scene: Scene;
  weaponSystem: WeaponSystem;
  inventorySystem: InventorySystem;
  weaponPickupSystem: WeaponPickupSystem;
  interactionSystem: InteractionSystem | null;
  player1: Entity;
  player2: Entity;
  hud: WeaponHUD | null;
  inputHandler: CharacterInputHandler;
  inputVisualizer: InputVisualizer | null;
  weaponInput: WeaponInputController | null;
  respawnManager: PvPRespawnManager;
  networkManager: MultiplayerGameplayManager | null;
  update(deltaTime: number): void;
  dispose(): void;
}

/**
 * Creates a PvP demo scene with weapons, spawn points, systems, and optional UI/network helpers.
 */
export function createPvPDemoScene(options: PvPDemoSceneOptions): PvPDemoSceneResult {
  const {
    scene,
    createArena = true,
    arenaSize = 30,
    hudContainer,
    inputContainer,
    canvas = null,
    enableHUD = true,
    enableInputVisualizer = true,
    enableWeaponPickups = true,
    network = null,
  } = options;

  if (createArena) {
    createArenaGeometry(scene, arenaSize);
  }

  ensurePrimaryCamera(scene);

  const spawnPoints = [
    createSpawnPoint(scene, 'Spawn Point 1', [-10, 1, 0], true),
    createSpawnPoint(scene, 'Spawn Point 2', [10, 1, 0]),
    createSpawnPoint(scene, 'Spawn Point 3', [0, 1, -10]),
    createSpawnPoint(scene, 'Spawn Point 4', [0, 1, 10]),
  ];

  const player1 = createPlayer(scene, 'Player 1', [-10, 1, 0]);
  const player2 = createPlayer(scene, 'Player 2', [10, 1, 0]);
  setupPvPLoadout(player1);
  setupPvPLoadout(player2);

  const weaponSystem = new WeaponSystem(scene);
  const inventorySystem = new InventorySystem(scene);
  const weaponPickupSystem = new WeaponPickupSystem(scene);

  const domAvailable = typeof window !== 'undefined' && typeof document !== 'undefined';
  const interactionSystem =
    domAvailable
      ? new InteractionSystem(scene, {
          canvas: canvas ?? undefined,
          promptStyle: { position: 'center-bottom' },
          detectionMode: 'hybrid',
        })
      : null;

  if (enableWeaponPickups) {
    createWeaponPickups(scene);
  }

  const characterInput = new CharacterInputHandler();
  characterInput.setBindings(DEFAULT_INPUT_BINDINGS);
  characterInput.setCameraDirections([0, 0, -1], [1, 0, 0]);

  const respawnManager = new PvPRespawnManager({
    scene,
    spawnPoints,
    weaponPickupSystem,
    respawnDelay: DEFAULT_RESPAWN_DELAY,
    onAfterRespawn: (entity) => {
      applyRandomLoadout(entity);
    },
  });
  respawnManager.register(player1);
  respawnManager.register(player2);
  applyRandomLoadout(player1);
  applyRandomLoadout(player2);

  const hud =
    enableHUD && domAvailable
      ? new WeaponHUD({
          scene,
          playerEntity: player1,
          container: hudContainer ?? document.body,
        })
      : null;
  hud?.show();

  let lastInput = characterInput.getInput();

  const inputVisualizer =
    enableInputVisualizer && domAvailable
      ? new InputVisualizer({
          container: inputContainer ?? document.body,
          getInput: () => lastInput,
        })
      : null;

  const weaponInput =
    domAvailable
      ? new WeaponInputController({
          player: player1,
          weaponSystem,
          inventorySystem,
          weaponPickupSystem,
        })
      : null;

  const networkManager = setupNetworkManager(scene, network, player1);

  const disposers = setupDamageListener(scene, respawnManager);

  function update(deltaTime: number): void {
    lastInput = characterInput.getInput();
    player1.getComponent(CharacterController)?.setInput(lastInput);

    weaponSystem.update(deltaTime);
    inventorySystem.update(deltaTime);
    weaponPickupSystem.update(deltaTime);
    interactionSystem?.update(deltaTime);
    respawnManager.update(deltaTime);
    networkManager?.update(deltaTime);
  }

  function dispose(): void {
    hud?.dispose();
    inputVisualizer?.dispose();
    weaponInput?.dispose();
    interactionSystem?.dispose();
    characterInput.destroy();
    respawnManager.dispose();
    for (const disposeHandler of disposers) {
      disposeHandler();
    }
    if (networkManager) {
      void networkManager.stopSession();
      networkManager.dispose();
    }
  }

  return {
    scene,
    weaponSystem,
    inventorySystem,
    weaponPickupSystem,
    interactionSystem,
    player1,
    player2,
    hud,
    inputHandler: characterInput,
    inputVisualizer,
    weaponInput,
    respawnManager,
    networkManager,
    update,
    dispose,
  };
}

export function addPvPDemoToScene(scene: Scene): {
  weaponSystem: WeaponSystem;
  inventorySystem: InventorySystem;
  player1: Entity;
  player2: Entity;
} {
  const result = createPvPDemoScene({
    scene,
    createArena: false,
    arenaSize: 30,
  });

  return {
    weaponSystem: result.weaponSystem,
    inventorySystem: result.inventorySystem,
    player1: result.player1,
    player2: result.player2,
  };
}

function createArenaGeometry(scene: Scene, size: number): void {
  const halfSize = Math.floor(size / 2);

  for (let x = -halfSize; x <= halfSize; x++) {
    for (let z = -halfSize; z <= halfSize; z++) {
      const floor = new Entity(`Floor_${x}_${z}`);
      floor.transform.position = [x, -0.5, z];
      floor.transform.scale = [1, 1, 1];

      const mesh = new MeshComponent();
      mesh.meshType = 'cube';
      floor.addComponent(mesh);

      const material = new MaterialComponent();
      material.materialId = (x + z) % 2 === 0 ? 1 : 4;
      floor.addComponent(material);

      scene.addEntity(floor);
    }
  }

  const wallHeight = 3;
  for (let i = -halfSize; i <= halfSize; i++) {
    createWallBlock(scene, `Wall_N_${i}`, [i, wallHeight / 2, halfSize], wallHeight);
    createWallBlock(scene, `Wall_S_${i}`, [i, wallHeight / 2, -halfSize], wallHeight);
    createWallBlock(scene, `Wall_E_${i}`, [halfSize, wallHeight / 2, i], wallHeight);
    createWallBlock(scene, `Wall_W_${i}`, [-halfSize, wallHeight / 2, i], wallHeight);
  }

  createCoverObject(scene, 'Cover_1', [-5, 0.5, 0]);
  createCoverObject(scene, 'Cover_2', [5, 0.5, 0]);
  createCoverObject(scene, 'Cover_3', [0, 0.5, -5]);
  createCoverObject(scene, 'Cover_4', [0, 0.5, 5]);
}

function createWallBlock(scene: Scene, name: string, position: Vec3, height: number): void {
  const wall = new Entity(name);
  wall.transform.position = [...position] as Vec3;
  wall.transform.scale = [1, height, 1];

  const mesh = new MeshComponent();
  mesh.meshType = 'cube';
  wall.addComponent(mesh);

  const material = new MaterialComponent();
  material.materialId = 1;
  wall.addComponent(material);

  scene.addEntity(wall);
}

function createCoverObject(scene: Scene, name: string, position: Vec3): void {
  const cover = new Entity(name);
  cover.transform.position = [...position] as Vec3;
  cover.transform.scale = [2, 1, 2];

  const mesh = new MeshComponent();
  mesh.meshType = 'cube';
  cover.addComponent(mesh);

  const material = new MaterialComponent();
  material.materialId = 14;
  cover.addComponent(material);

  const physics = new PhysicsComponent();
  physics.rigidbodyType = RigidbodyType.Static;
  physics.mass = 0;
  physics.useGravity = false;
  const halfExtents: Vec3 = [1, 0.5, 1];
  physics.addBoxCollider(halfExtents);
  cover.addComponent(physics);

  scene.addEntity(cover);
}

function createSpawnPoint(scene: Scene, name: string, position: Vec3, isDefault = false): Entity {
  const spawn = new Entity(name);
  spawn.transform.position = [...position] as Vec3;

  const spawnComp = new SpawnPointComponent();
  spawnComp.isDefault = isDefault;
  spawnComp.giveWeaponOnSpawn = true;
  spawnComp.givePvPLoadout = true;
  spawn.addComponent(spawnComp);

  scene.addEntity(spawn);
  return spawn;
}

function createPlayer(scene: Scene, name: string, position: Vec3): Entity {
  const player = new Entity(name);
  player.transform.position = [...position] as Vec3;

  const health = new HealthComponent();
  health.maxHealth = 100;
  health.currentHealth = 100;
  player.addComponent(health);

  const controller = new CharacterController({
    moveSpeed: 5.0,
    jumpForce: 6.0,
  });
  player.addComponent(controller);

  const physics = new PhysicsComponent();
  physics.rigidbodyType = RigidbodyType.Dynamic;
  physics.mass = 70;
  physics.addCapsuleCollider(0.5, 2.0);
  physics.freezeRotationX = true;
  physics.freezeRotationZ = true;
  player.addComponent(physics);

  scene.addEntity(player);
  return player;
}

function ensurePrimaryCamera(scene: Scene): Entity {
  if (scene.primaryCamera) {
    return scene.primaryCamera;
  }
  const camera = new Entity('PvP Demo Camera');
  camera.transform.position = [0, 12, 24];

  const cameraComponent = new CameraComponent();
  camera.addComponent(cameraComponent);
  scene.addEntity(camera);
  scene.setPrimaryCamera(camera);
  return camera;
}

function createWeaponPickups(scene: Scene): void {
  PICKUP_POSITIONS.forEach((position, index) => {
    const preset = PICKUP_PRESETS[index % PICKUP_PRESETS.length]!;
    const pickup = new Entity(`PvP Pickup ${index}`);
    pickup.transform.position = [...position] as Vec3;
    pickup.transform.scale = [0.75, 0.75, 0.75];

    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    pickup.addComponent(mesh);

    const material = new MaterialComponent();
    material.materialId = 12;
    pickup.addComponent(material);

    const pickupComponent = new WeaponPickupComponent();
    pickupComponent.weaponPreset = preset;
    pickupComponent.autoRespawn = true;
    pickupComponent.respawnTime = 10 + Math.random() * 8;
    pickup.addComponent(pickupComponent);

    const interactable = new InteractableComponent();
    interactable.promptText = 'Pick up weapon (E)';
    pickup.addComponent(interactable);

    setupWeaponEntity(pickup, preset);
    scene.addEntity(pickup);
  });
}

function setupNetworkManager(
  scene: Scene,
  network: PvPNetworkOptions | null,
  player: Entity
): MultiplayerGameplayManager | null {
  if (!network) {
    return null;
  }
  try {
    const manager = new MultiplayerGameplayManager(
      network.replicationClient,
      scene,
      network.physicsWorld
    );
    if (network.autoStart !== false) {
      void manager.startSession(network.sessionId, player);
    }
    return manager;
  } catch (error) {
    console.warn('PvP demo: failed to initialize multiplayer gameplay manager', error);
    return null;
  }
}

function setupDamageListener(scene: Scene, respawnManager: PvPRespawnManager): Array<() => void> {
  const disposers: Array<() => void> = [];
  const hitscanDisposer = scene.events.on('weapon:hitscan:hit', (event) => {
    const payload = event as { hit?: Entity };
    const victim = payload?.hit;
    if (!victim || !respawnManager.isTracked(victim)) {
      return;
    }
    const health = victim.getComponent(HealthComponent);
    if (health && health.currentHealth <= 0) {
      respawnManager.scheduleRespawn(victim);
    }
  });
  disposers.push(hitscanDisposer);
  return disposers;
}

interface InputVisualizerConfig {
  container: HTMLElement;
  getInput: () => CharacterInput;
}

class InputVisualizer {
  private root: HTMLElement | null = null;
  private rafId: number | null = null;
  private readonly keyRefs = new Map<string, HTMLElement>();

  constructor(private readonly config: InputVisualizerConfig) {
    if (typeof document === 'undefined' || !config.container) {
      return;
    }
    this.ensureStyles();
    this.root = document.createElement('div');
    this.root.className = 'pvp-demo-input';
    config.container.appendChild(this.root);
    this.createKeys();
    this.start();
  }

  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.root?.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
    this.keyRefs.clear();
  }

  private start(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const loop = () => {
      this.update();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private update(): void {
    if (!this.root) return;
    const input = this.config.getInput();
    const forward = input.moveDirection[2];
    const strafe = input.moveDirection[0];

    this.setActive('KeyW', forward < -0.1);
    this.setActive('KeyS', forward > 0.1);
    this.setActive('KeyA', strafe < -0.1);
    this.setActive('KeyD', strafe > 0.1);
    this.setActive('Space', input.jump);
    this.setActive('ShiftLeft', input.sprint);
  }

  private setActive(code: string, active: boolean): void {
    const el = this.keyRefs.get(code);
    if (!el) return;
    el.classList.toggle('active', active);
  }

  private createKeys(): void {
    const group = document.createElement('div');
    group.className = 'pvp-demo-input__group';
    const row1 = document.createElement('div');
    row1.className = 'pvp-demo-input__row';
    row1.appendChild(this.createKey('KeyW', 'W'));
    const row2 = document.createElement('div');
    row2.className = 'pvp-demo-input__row';
    row2.appendChild(this.createKey('KeyA', 'A'));
    row2.appendChild(this.createKey('KeyS', 'S'));
    row2.appendChild(this.createKey('KeyD', 'D'));
    const row3 = document.createElement('div');
    row3.className = 'pvp-demo-input__row';
    row3.appendChild(this.createKey('Space', 'Space'));
    row3.appendChild(this.createKey('ShiftLeft', 'Shift'));
    group.appendChild(row1);
    group.appendChild(row2);
    group.appendChild(row3);
    this.root?.appendChild(group);
  }

  private createKey(code: string, label: string): HTMLElement {
    const key = document.createElement('span');
    key.textContent = label;
    key.className = 'pvp-demo-input__key';
    this.keyRefs.set(code, key);
    return key;
  }

  private ensureStyles(): void {
    if (document.getElementById('pvp-demo-input-styles')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'pvp-demo-input-styles';
    style.textContent = `
      .pvp-demo-input {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 10001;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .pvp-demo-input__group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .pvp-demo-input__row {
        display: flex;
        justify-content: center;
        gap: 4px;
      }
      .pvp-demo-input__key {
        min-width: 36px;
        padding: 6px 10px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.6);
        color: rgba(255, 255, 255, 0.8);
        font-size: 12px;
        text-align: center;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .pvp-demo-input__key.active {
        background: rgba(59, 130, 246, 0.8);
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }
}

interface WeaponInputControllerConfig {
  player: Entity;
  weaponSystem: WeaponSystem;
  inventorySystem: InventorySystem;
  weaponPickupSystem: WeaponPickupSystem;
}

class WeaponInputController {
  private isFiring = false;
  private fireLoopId: number | null = null;

  constructor(private readonly config: WeaponInputControllerConfig) {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  dispose(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.fireLoopId !== null) {
      cancelAnimationFrame(this.fireLoopId);
      this.fireLoopId = null;
    }
    this.isFiring = false;
  }

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.isFiring = true;
      this.startFireLoop();
    }
  };

  private handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.isFiring = false;
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    switch (event.code) {
      case 'KeyR':
        this.config.weaponSystem.reload(this.config.player);
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3': {
        const index = Number.parseInt(event.code.replace('Digit', ''), 10) - 1;
        if (index >= 0) {
          this.config.inventorySystem.switchWeapon(this.config.player, index);
        }
        break;
      }
      case 'KeyE':
        this.config.weaponPickupSystem.pickupNearestWeapon(this.config.player);
        break;
      default:
        break;
    }
  };

  private startFireLoop(): void {
    if (typeof window === 'undefined') return;
    const loop = () => {
      if (!this.isFiring) {
        this.fireLoopId = null;
        return;
      }
      const direction = this.getForwardDirection();
      this.config.weaponSystem.fire(this.config.player, direction);
      this.fireLoopId = requestAnimationFrame(loop);
    };
    if (this.fireLoopId === null) {
      this.fireLoopId = requestAnimationFrame(loop);
    }
  }

  private getForwardDirection(): Vec3 {
    const forward = [0, 0, -1] as Vec3;
    this.config.player.transform.getForward(forward);
    return forward;
  }
}
