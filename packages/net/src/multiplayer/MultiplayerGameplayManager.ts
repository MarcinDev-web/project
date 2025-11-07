import type { Entity, Scene, CharacterController, PhysicsWorld, CharacterInput } from '@engine/world';
import { CharacterController as CharacterControllerClass, Entity as EntityClass } from '@engine/world';
import { ReplicationClient, type PublicUser } from '../ReplicationClient';
import { ReplicationState } from '../types/replication';
import { PlayerSync } from './PlayerSync';
import { InputReplicator } from './InputReplicator';
import { PhysicsSync } from './PhysicsSync';

/**
 * Network multiplayer manager for gameplay mode.
 * Handles:
 * - Local player synchronization
 * - Remote player avatar spawning
 * - Network input replication
 * - Physics synchronization
 */
export class MultiplayerGameplayManager {
  private readonly replicationClient: ReplicationClient;
  private readonly scene: Scene;
  private readonly physicsWorld: PhysicsWorld;
  private localPlayerEntity: Entity | null = null;
  private localPlayerController: CharacterController | null = null;
  private remotePlayers = new Map<string, Entity>(); // userId -> Entity
  private playerSync: PlayerSync | null = null;
  private inputReplicator: InputReplicator | null = null;
  private physicsSync: PhysicsSync | null = null;
  private sessionId: string | null = null;
  private isConnected = false;

  constructor(
    replicationClient: ReplicationClient,
    scene: Scene,
    physicsWorld: PhysicsWorld
  ) {
    this.replicationClient = replicationClient;
    this.scene = scene;
    this.physicsWorld = physicsWorld;

    // Subscribe to user events
    this.replicationClient.onUserJoined((user) => {
      this.handleUserJoined(user);
    });

    this.replicationClient.onUserLeft((userId) => {
      this.handleUserLeft(userId);
    });
  }

  /**
   * Start multiplayer session and connect to server.
   */
  async startSession(sessionId: string, localPlayerEntity: Entity): Promise<void> {
    this.sessionId = sessionId;
    this.localPlayerEntity = localPlayerEntity;
    this.localPlayerController = localPlayerEntity.getComponent(CharacterControllerClass) ?? null;

    if (!this.localPlayerController) {
      throw new Error('Local player entity must have CharacterController component');
    }

    // Mark local player entity with userId for PhysicsSync identification
    const localUserId = this.getLocalUserId();
    if (localUserId) {
      localPlayerEntity.userData.userId = localUserId;
      localPlayerEntity.userData.isLocalPlayer = true;
    }

    // Check if already connected (reuse existing connection)
    const currentState = this.replicationClient.getState();
    if (currentState === ReplicationState.Disconnected || currentState === ReplicationState.Error) {
      // Connect to server only if not already connected
      await this.replicationClient.connect(sessionId);
    }
    this.isConnected = true;

    // Initialize sync systems
    this.playerSync = new PlayerSync({
      localPlayerEntity,
      replicationClient: this.replicationClient,
      localUserId: this.getLocalUserId(),
    });

    this.inputReplicator = new InputReplicator({
      replicationClient: this.replicationClient,
    });

    this.physicsSync = new PhysicsSync({
      physicsWorld: this.physicsWorld,
      scene: this.scene,
      replicationClient: this.replicationClient,
    });
  }

  /**
   * Stop multiplayer session and disconnect.
   */
  async stopSession(): Promise<void> {
    // Don't disconnect ReplicationClient - it may be used by collaboration editing
    // Just cleanup multiplayer-specific systems
    this.isConnected = false;

    // Cleanup sync systems
    if (this.playerSync) {
      this.playerSync.dispose();
      this.playerSync = null;
    }

    if (this.inputReplicator) {
      this.inputReplicator.dispose();
      this.inputReplicator = null;
    }

    if (this.physicsSync) {
      this.physicsSync.dispose();
      this.physicsSync = null;
    }

    // Remove remote player avatars
    for (const entity of this.remotePlayers.values()) {
      this.scene.removeEntity(entity);
    }
    this.remotePlayers.clear();

    this.sessionId = null;
    this.localPlayerEntity = null;
    this.localPlayerController = null;
  }

  /**
   * Update multiplayer systems (call every frame).
   */
  update(deltaTime: number): void {
    if (!this.isConnected) return;

    this.playerSync?.update(deltaTime);
    this.physicsSync?.update(deltaTime);
  }

  /**
   * Process character input for local player.
   * Wraps CharacterController input with network replication.
   */
  processInput(input: CharacterInput): void {
    if (!this.isConnected || !this.localPlayerController) {
      return;
    }

    // Apply input to local controller
    this.localPlayerController.setInput(input);

    // Replicate input to network
    if (this.inputReplicator) {
      this.inputReplicator.recordInput(input);

      // For critical actions (jump), send immediately
      if (input.jump) {
        this.inputReplicator.sendImmediate(input);
      }
    }
  }

  /**
   * Spawn avatar for remote player.
   */
  private spawnRemotePlayerAvatar(userId: string, user: PublicUser): Entity {
    // Create entity for remote player
    const avatar = new EntityClass(`remote_player_${userId}`);
    
    // Position at origin (will be updated by PlayerSync)
    avatar.transform.position = [0, 0, 0];
    
    // Add CharacterController component (for display/visualization)
    // Note: This controller won't receive local input, only network updates
    const controller = new CharacterControllerClass({
      moveSpeed: 5.0,
      sprintMultiplier: 1.5,
      jumpForce: 8.0,
      gravityMultiplier: 1.0,
      maxSlopeAngle: 45,
      stepHeight: 0.3,
      groundCheckDistance: 0.1,
      airControlMultiplier: 0.3,
      rotationSpeed: 10,
      autoRotate: true,
    });
    avatar.addComponent(controller);

    // Add simple visual representation (capsule/sphere mesh)
    // In a full implementation, this would load a proper avatar model
    // For now, we'll rely on the CharacterController's visual representation
    
    // Mark as remote player
    avatar.userData.isRemotePlayer = true;
    avatar.userData.userId = userId;
    avatar.userData.userEmail = user.email;

    // Add to scene
    this.scene.addEntity(avatar);

    // Register in PlayerSync
    if (this.playerSync) {
      this.playerSync.registerRemotePlayer(userId, avatar);
    }

    return avatar;
  }

  /**
   * Handle user joined event.
   */
  private handleUserJoined(user: PublicUser): void {
    // Don't spawn avatar for local player
    const localUserId = this.getLocalUserId();
    if (localUserId && user.id === localUserId) {
      return;
    }

    // Spawn avatar for remote player
    const avatar = this.spawnRemotePlayerAvatar(user.id, user);
    this.remotePlayers.set(user.id, avatar);

    console.log(`Remote player joined: ${user.email} (${user.id})`);
  }

  /**
   * Handle user left event.
   */
  private handleUserLeft(userId: string): void {
    const avatar = this.remotePlayers.get(userId);
    if (avatar) {
      // Unregister from PlayerSync
      if (this.playerSync) {
        this.playerSync.unregisterRemotePlayer(userId);
      }

      // Remove entity from scene
      this.scene.removeEntity(avatar);
      this.remotePlayers.delete(userId);

      console.log(`Remote player left: ${userId}`);
    }
  }

  /**
   * Get local user ID (should be provided by ReplicationClient or auth system).
   */
  private getLocalUserId(): string | null {
    return this.replicationClient.getLocalUserId();
  }

  /**
   * Get local player entity.
   */
  getLocalPlayerEntity(): Entity | null {
    return this.localPlayerEntity;
  }

  /**
   * Get remote player entities.
   */
  getRemotePlayers(): Map<string, Entity> {
    return new Map(this.remotePlayers);
  }

  /**
   * Check if multiplayer session is active.
   */
  isSessionActive(): boolean {
    return this.isConnected && this.sessionId !== null;
  }

  /**
   * Get current session ID.
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}

