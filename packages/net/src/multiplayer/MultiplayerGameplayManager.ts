import type { Entity, Scene, CharacterController, PhysicsWorld, CharacterInput } from '@engine/world';
import { CharacterController as CharacterControllerClass, Entity as EntityClass } from '@engine/world';
import { InputChannel, HmacIntentAuthenticator } from '@engine/world/net/InputChannel';
import { ReplicationClient, type PublicUser } from '../ReplicationClient';
import { ReplicationState } from '../types/replication';
import { PlayerSync } from './PlayerSync';
import { InputReplicator } from './InputReplicator';
import { PhysicsSync } from './PhysicsSync';
import { OperationReplicator } from '../collaboration/OperationReplicator';
import { ErrorHandler, type ErrorCallback } from './ErrorHandler';
import { ValidationError, StateError, ErrorFactory, ErrorSeverity } from './errors';

interface MultiplayerSecurityOptions {
  intentSigningKey?: string;
  intentKeyId?: string;
}

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
  private readonly errorHandler: ErrorHandler;
  private localPlayerEntity: Entity | null = null;
  private localPlayerController: CharacterController | null = null;
  private remotePlayers = new Map<string, Entity>(); // userId -> Entity
  private playerSync: PlayerSync | null = null;
  private inputReplicator: InputReplicator | null = null;
  private physicsSync: PhysicsSync | null = null;
  private operationReplicator: OperationReplicator | null = null;
  private sessionId: string | null = null;
  private isConnected = false;
  private unsubscribeStateChange: (() => void) | null = null;
  private wasConnectedBefore = false; // Track if we were connected before (for reconnection)
  private errorCallbacks: ErrorCallback[] = [];
  private readonly intentSigningKey: string | null;
  private readonly intentKeyId: string;
  private intentChannel: InputChannel | null = null;
  private intentAuthenticator: HmacIntentAuthenticator | null = null;

  constructor(
    replicationClient: ReplicationClient,
    scene: Scene,
    physicsWorld: PhysicsWorld,
    errorHandler?: ErrorHandler,
    securityOptions?: MultiplayerSecurityOptions
  ) {
    // Create or use provided error handler
    this.errorHandler = errorHandler ?? new ErrorHandler();
    
    // Validate required parameters
    if (!replicationClient) {
      throw ErrorFactory.missingField('replicationClient');
    }
    if (!scene) {
      throw ErrorFactory.missingField('scene');
    }
    if (!physicsWorld) {
      throw ErrorFactory.missingField('physicsWorld');
    }

    this.replicationClient = replicationClient;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.intentSigningKey = securityOptions?.intentSigningKey ?? null;
    this.intentKeyId = securityOptions?.intentKeyId ?? 'client-intent';

    // Subscribe to state changes to handle connection, disconnection, and reconnection
    this.unsubscribeStateChange = this.replicationClient.onStateChange((state) => {
      this.handleConnectionStateChange(state);
    });

    // Subscribe to user events
    this.replicationClient.onUserJoined((user) => {
      this.handleUserJoined(user);
      // Also update userId when user joined (in case it's our own join)
      this.updateUserId();
    });

    this.replicationClient.onUserLeft((userId) => {
      this.handleUserLeft(userId);
    });

    // Subscribe to ReplicationClient errors
    this.replicationClient.onError((error, code) => {
      this.errorHandler.handleError(
        new StateError(`ReplicationClient error: ${error}`, {
          code: code ?? 'REPLICATION_CLIENT_ERROR',
          context: { error, code },
          retryable: true,
        })
      );
    });
  }

  /**
   * Handle connection state changes (including reconnection).
   */
  private handleConnectionStateChange(state: ReplicationState): void {
    if (state === ReplicationState.Connected || state === ReplicationState.Joined) {
      // Connection established or joined session
      if (!this.isConnected && this.sessionId) {
        // This is a reconnection
        this.handleReconnection();
      } else {
        // First connection
        this.isConnected = true;
        this.wasConnectedBefore = true;
      }
      
      // Update userId when connected or joined
      this.updateUserId();
    } else if (state === ReplicationState.Disconnected || state === ReplicationState.Error) {
      // Connection lost
      if (this.isConnected && this.sessionId) {
        // We were connected, so this is a disconnection
        this.handleDisconnection();
      }
    }
  }

  /**
   * Handle disconnection (connection lost).
   */
  private handleDisconnection(): void {
    if (!this.isConnected) {
      return; // Already handled
    }

    console.log('MultiplayerGameplayManager: Connection lost, waiting for reconnection...');
    this.isConnected = false;

    // Don't dispose components - we'll reuse them on reconnection
    // Just pause updates
  }

  /**
   * Handle reconnection (connection restored).
   */
  private handleReconnection(): void {
    if (!this.sessionId || !this.localPlayerEntity) {
      this.errorHandler.handleError(
        new StateError('Cannot reconnect - missing sessionId or localPlayerEntity', {
          code: 'RECONNECTION_MISSING_DATA',
          context: { sessionId: this.sessionId, hasLocalPlayerEntity: !!this.localPlayerEntity },
          retryable: false,
        })
      );
      return;
    }

    console.log('MultiplayerGameplayManager: Reconnection successful, restoring session...');
    
    // Restore connection state
    this.isConnected = true;

    // Reinitialize sync systems if they were disposed (shouldn't happen, but safety check)
    if (!this.playerSync && this.localPlayerEntity) {
      this.playerSync = new PlayerSync({
        localPlayerEntity: this.localPlayerEntity,
        replicationClient: this.replicationClient,
        localUserId: this.getLocalUserId(),
        errorHandler: this.errorHandler,
      });
      
      // Subscribe to PlayerSync errors
      this.playerSync.onError((error) => {
        this.errorHandler.handleError(error);
      });
    }

    if (!this.inputReplicator) {
      const intentChannel = this.ensureIntentChannel();
      this.inputReplicator = new InputReplicator({
        replicationClient: this.replicationClient,
        errorHandler: this.errorHandler,
        ...(intentChannel && { intentChannel }),
      });
      
      // Subscribe to InputReplicator errors
      this.inputReplicator.onError((error) => {
        this.errorHandler.handleError(error);
      });
    }

    if (!this.physicsSync) {
      this.physicsSync = new PhysicsSync({
        physicsWorld: this.physicsWorld,
        scene: this.scene,
        replicationClient: this.replicationClient,
        errorHandler: this.errorHandler,
      });
      
      // Subscribe to PhysicsSync errors
      this.physicsSync.onError((error) => {
        this.errorHandler.handleError(error);
      });
    }

    if (!this.operationReplicator) {
      this.operationReplicator = new OperationReplicator({
        scene: this.scene,
        replicationClient: this.replicationClient,
        enableBuffering: true,
        enableConflictResolution: true,
      });
      
      this.operationReplicator.onOperationFailed((op, error) => {
        this.errorHandler.handleError(
          new StateError('Operation replication failed', {
            code: 'OPERATION_FAILED',
            context: { operationId: op.id, type: op.type },
            retryable: true,
            cause: error,
          })
        );
      });
    }

    // Reset sync states for clean reconnection
    this.resetSyncStates();

    // Update userId
    this.updateUserId();

    // Request snapshot to resync state (if server supports it)
    // Note: Server should send snapshot automatically on rejoin, but we can request it
    this.replicationClient.requestSnapshot();
  }

  /**
   * Reset sync states after reconnection.
   */
  private resetSyncStates(): void {
    // Reset PlayerSync state
    if (this.playerSync) {
      this.playerSync.resetForReconnection();
    }

    // Reset PhysicsSync state
    if (this.physicsSync) {
      this.physicsSync.resetForReconnection();
    }

    // Flush input buffer on reconnection
    if (this.inputReplicator) {
      this.inputReplicator.flushBuffer();
    }
  }

  /**
   * Start multiplayer session and connect to server.
   */
  async startSession(sessionId: string, localPlayerEntity: Entity): Promise<void> {
    // Validate inputs
    if (!sessionId || typeof sessionId !== 'string') {
      throw ErrorFactory.invalidInput('sessionId', sessionId, 'must be a non-empty string');
    }
    if (!localPlayerEntity) {
      throw ErrorFactory.missingField('localPlayerEntity');
    }

    // If already in a session, stop it first
    if (this.sessionId && this.sessionId !== sessionId) {
      await this.stopSession();
    }

    this.sessionId = sessionId;
    this.localPlayerEntity = localPlayerEntity;
    this.localPlayerController = localPlayerEntity.getComponent(CharacterControllerClass) ?? null;

    if (!this.localPlayerController) {
      throw new StateError('Local player entity must have CharacterController component', {
        code: 'STATE_MISSING_CONTROLLER',
        context: { entityId: localPlayerEntity.id },
        retryable: false,
      });
    }

    // Mark local player entity with userId for PhysicsSync identification
    // Will be updated when userId becomes available via updateUserId()
    const localUserId = this.getLocalUserId();
    if (localUserId) {
      localPlayerEntity.userData.userId = localUserId;
      localPlayerEntity.userData.isLocalPlayer = true;
    }

    // Check if already connected (reuse existing connection)
    const currentState = this.replicationClient.getState();
    if (currentState === ReplicationState.Disconnected || currentState === ReplicationState.Error) {
      // Connect to server only if not already connected
      try {
        await this.replicationClient.connect(sessionId);
      } catch (error) {
        this.errorHandler.handleError(
          new StateError('Failed to connect to server', {
            code: 'CONNECTION_FAILED',
            context: { sessionId },
            retryable: true,
            ...(error instanceof Error ? { cause: error } : {}),
          })
        );
        throw error;
      }
    } else {
      // Already connected, just mark as connected
      this.isConnected = true;
      this.wasConnectedBefore = true;
    }

    // Initialize sync systems (or reuse if reconnecting)
    if (!this.playerSync) {
      this.playerSync = new PlayerSync({
        localPlayerEntity,
        replicationClient: this.replicationClient,
        localUserId: this.getLocalUserId(),
        errorHandler: this.errorHandler,
      });
      
      // Subscribe to PlayerSync errors
      this.playerSync.onError((error) => {
        this.errorHandler.handleError(error);
      });
    } else {
      // Update localPlayerEntity if it changed
      // Note: PlayerSync doesn't support changing localPlayerEntity, so we recreate it
      this.playerSync.dispose();
      this.playerSync = new PlayerSync({
        localPlayerEntity,
        replicationClient: this.replicationClient,
        localUserId: this.getLocalUserId(),
        errorHandler: this.errorHandler,
      });
      
      // Subscribe to PlayerSync errors
      this.playerSync.onError((error) => {
        this.errorHandler.handleError(error);
      });
    }

    if (!this.inputReplicator) {
      const intentChannel = this.ensureIntentChannel();
      this.inputReplicator = new InputReplicator({
        replicationClient: this.replicationClient,
        errorHandler: this.errorHandler,
        ...(intentChannel && { intentChannel }),
      });
      
      // Subscribe to InputReplicator errors
      this.inputReplicator.onError((error) => {
        this.errorHandler.handleError(error);
      });
    }

    if (!this.physicsSync) {
      this.physicsSync = new PhysicsSync({
        physicsWorld: this.physicsWorld,
        scene: this.scene,
        replicationClient: this.replicationClient,
        errorHandler: this.errorHandler,
      });
      
      // Subscribe to PhysicsSync errors
      this.physicsSync.onError((error) => {
        this.errorHandler.handleError(error);
      });
    }

    if (!this.operationReplicator) {
      this.operationReplicator = new OperationReplicator({
        scene: this.scene,
        replicationClient: this.replicationClient,
        enableBuffering: true,
        enableConflictResolution: true,
      });
      
      this.operationReplicator.onOperationFailed((op, error) => {
        this.errorHandler.handleError(
          new StateError('Operation replication failed', {
            code: 'OPERATION_FAILED',
            context: { operationId: op.id, type: op.type },
            retryable: true,
            cause: error,
          })
        );
      });
    }

    // Update userId after components are created (in case it becomes available later)
    this.updateUserId();
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

    if (this.operationReplicator) {
      this.operationReplicator.dispose();
      this.operationReplicator = null;
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
   * Cleanup - call when manager is no longer needed.
   */
  dispose(): void {
    if (this.unsubscribeStateChange) {
      this.unsubscribeStateChange();
      this.unsubscribeStateChange = null;
    }
    void this.stopSession();
  }

  /**
   * Update multiplayer systems (call every frame).
   */
  update(deltaTime: number): void {
    // Validate deltaTime
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      this.errorHandler.handleError(
        ErrorFactory.invalidInput('deltaTime', deltaTime, 'must be a non-negative finite number')
      );
      return;
    }

    // Check connection state
    const currentState = this.replicationClient.getState();
    const shouldBeConnected = currentState === ReplicationState.Connected || currentState === ReplicationState.Joined;
    
    // Update connection state if needed
    if (shouldBeConnected !== this.isConnected && this.sessionId) {
      if (shouldBeConnected && !this.isConnected) {
        // Reconnection happened
        this.handleReconnection();
      } else if (!shouldBeConnected && this.isConnected) {
        // Disconnection happened
        this.handleDisconnection();
      }
    }

    // Only update sync systems if connected
    if (!this.isConnected) {
      return;
    }

    // Check for userId if not yet available (in case it was set after connection)
    this.updateUserId();

    // Update sync systems with error handling
    try {
      this.playerSync?.update(deltaTime);
    } catch (error) {
      this.errorHandler.handleError(
        new StateError('PlayerSync update failed', {
          code: 'SYNC_UPDATE_FAILED',
          context: { component: 'PlayerSync' },
          retryable: true,
          ...(error instanceof Error ? { cause: error } : {}),
        })
      );
    }

    try {
      this.physicsSync?.update(deltaTime);
    } catch (error) {
      this.errorHandler.handleError(
        new StateError('PhysicsSync update failed', {
          code: 'SYNC_UPDATE_FAILED',
          context: { component: 'PhysicsSync' },
          retryable: true,
          ...(error instanceof Error ? { cause: error } : {}),
        })
      );
    }
  }

  /**
   * Process character input for local player.
   * Wraps CharacterController input with network replication.
   */
  processInput(input: CharacterInput): void {
    if (!this.isConnected || !this.localPlayerController) {
      return;
    }

    // Validate input
    if (!input) {
      this.errorHandler.handleError(
        ErrorFactory.invalidInput('input', input, 'input object is required')
      );
      return;
    }

    // Apply input to local controller
    try {
      this.localPlayerController.setInput(input);
    } catch (error) {
      this.errorHandler.handleError(
        new StateError('Failed to set input on controller', {
          code: 'INPUT_SET_FAILED',
          context: { input },
          retryable: false,
          ...(error instanceof Error ? { cause: error } : {}),
        })
      );
      return;
    }

    // Replicate input to network
    if (this.inputReplicator) {
      try {
        this.inputReplicator.recordInput(input);

        // For critical actions (jump), send immediately
        if (input.jump) {
          this.inputReplicator.sendImmediate(input);
        }
      } catch (error) {
        this.errorHandler.handleError(
          new StateError('Failed to replicate input', {
            code: 'INPUT_REPLICATION_FAILED',
            context: { input },
            retryable: true,
            ...(error instanceof Error ? { cause: error } : {}),
          })
        );
      }
    }
  }

  private ensureIntentChannel(): InputChannel | null {
    if (!this.intentSigningKey) {
      return null;
    }
    if (!this.intentAuthenticator) {
      this.intentAuthenticator = new HmacIntentAuthenticator({
        secret: this.intentSigningKey,
        keyId: this.intentKeyId,
      });
    }
    if (!this.intentChannel) {
      this.intentChannel = new InputChannel({
        actorId: this.getLocalUserId() ?? 'anonymous',
        authenticator: this.intentAuthenticator,
      });
    } else {
      const localUserId = this.getLocalUserId();
      if (localUserId) {
        this.intentChannel.setActorId(localUserId);
      }
    }
    return this.intentChannel;
  }

  /**
   * Spawn avatar for remote player.
   */
  private spawnRemotePlayerAvatar(userId: string, user: PublicUser): Entity {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw ErrorFactory.invalidInput('userId', userId, 'must be a non-empty string');
    }
    if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') {
      throw ErrorFactory.invalidInput('user', user, 'must be a valid PublicUser object');
    }

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
    try {
      this.scene.addEntity(avatar);
    } catch (error) {
      this.errorHandler.handleError(
        new StateError('Failed to add remote player avatar to scene', {
          code: 'AVATAR_SPAWN_FAILED',
          context: { userId, user },
          retryable: true,
          ...(error instanceof Error ? { cause: error } : {}),
        })
      );
      throw error;
    }

    // Register in PlayerSync
    if (this.playerSync) {
      try {
        this.playerSync.registerRemotePlayer(userId, avatar);
      } catch (error) {
        this.errorHandler.handleError(
          new StateError('Failed to register remote player in PlayerSync', {
            code: 'PLAYER_REGISTRATION_FAILED',
            context: { userId },
            retryable: true,
            ...(error instanceof Error ? { cause: error } : {}),
          })
        );
      }
    }

    return avatar;
  }

  /**
   * Handle user joined event.
   */
  private handleUserJoined(user: PublicUser): void {
    // Validate user
    if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') {
      this.errorHandler.handleError(
        ErrorFactory.invalidInput('user', user, 'must be a valid PublicUser object')
      );
      return;
    }

    // Don't spawn avatar for local player
    const localUserId = this.getLocalUserId();
    if (localUserId && user.id === localUserId) {
      return;
    }

    // Spawn avatar for remote player with error handling
    try {
      const avatar = this.spawnRemotePlayerAvatar(user.id, user);
      this.remotePlayers.set(user.id, avatar);
      console.log(`Remote player joined: ${user.email} (${user.id})`);
    } catch (error) {
      this.errorHandler.handleError(
        new StateError('Failed to spawn remote player avatar', {
          code: 'AVATAR_SPAWN_FAILED',
          context: { user },
          retryable: true,
          ...(error instanceof Error ? { cause: error } : {}),
        })
      );
    }
  }

  /**
   * Handle user left event.
   */
  private handleUserLeft(userId: string): void {
    // Validate userId
    if (!userId || typeof userId !== 'string') {
      this.errorHandler.handleError(
        ErrorFactory.invalidInput('userId', userId, 'must be a non-empty string')
      );
      return;
    }

    const avatar = this.remotePlayers.get(userId);
    if (avatar) {
      // Unregister from PlayerSync
      if (this.playerSync) {
        try {
          this.playerSync.unregisterRemotePlayer(userId);
        } catch (error) {
          this.errorHandler.handleError(
            new StateError('Failed to unregister remote player from PlayerSync', {
              code: 'PLAYER_UNREGISTRATION_FAILED',
              context: { userId },
              retryable: false,
              ...(error instanceof Error ? { cause: error } : {}),
            })
          );
        }
      }

      // Remove entity from scene
      try {
        this.scene.removeEntity(avatar);
        this.remotePlayers.delete(userId);
        console.log(`Remote player left: ${userId}`);
      } catch (error) {
        this.errorHandler.handleError(
          new StateError('Failed to remove remote player avatar from scene', {
            code: 'AVATAR_REMOVAL_FAILED',
            context: { userId },
            retryable: false,
            ...(error instanceof Error ? { cause: error } : {}),
          })
        );
      }
    }
  }

  /**
   * Update userId on local player entity and components when it becomes available.
   */
  private updateUserId(): void {
    const localUserId = this.getLocalUserId();
    if (!localUserId) {
      return;
    }

    // Update local player entity userData
    if (this.localPlayerEntity) {
      this.localPlayerEntity.userData.userId = localUserId;
      this.localPlayerEntity.userData.isLocalPlayer = true;
    }

    // Update PlayerSync userId
    if (this.playerSync) {
      this.playerSync.setLocalUserId(localUserId);
    }

    if (this.intentChannel) {
      this.intentChannel.setActorId(localUserId);
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

  /**
   * Manually trigger reconnection attempt.
   * Useful if you want to force a reconnection.
   */
  async reconnect(): Promise<void> {
    if (!this.sessionId) {
      throw new StateError('Cannot reconnect - no active session', {
        code: 'RECONNECTION_NO_SESSION',
        retryable: false,
      });
    }

    const currentState = this.replicationClient.getState();
    if (currentState === ReplicationState.Connected || currentState === ReplicationState.Joined) {
      console.log('MultiplayerGameplayManager: Already connected, no need to reconnect');
      return;
    }

    console.log('MultiplayerGameplayManager: Manually triggering reconnection...');
    this.isConnected = false;
    
    try {
      await this.replicationClient.connect(this.sessionId);
      // handleReconnection() will be called via state change handler
    } catch (error) {
      this.errorHandler.handleError(
        new StateError('Manual reconnection failed', {
          code: 'RECONNECTION_FAILED',
          context: { sessionId: this.sessionId },
          retryable: true,
          ...(error instanceof Error ? { cause: error } : {}),
        })
      );
      throw error;
    }
  }

  /**
   * Subscribe to error events from all components.
   * Returns unsubscribe function.
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    
    // Subscribe to error handler (which aggregates all component errors)
    const unsubscribe = this.errorHandler.onError(callback);
    
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index >= 0) {
        this.errorCallbacks.splice(index, 1);
      }
      unsubscribe();
    };
  }

  /**
   * Get error handler instance.
   */
  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  /**
   * Get connection state.
   */
  getConnectionState(): ReplicationState {
    return this.replicationClient.getState();
  }

  /**
   * Get operation replicator instance.
   */
  getOperationReplicator(): OperationReplicator | null {
    return this.operationReplicator;
  }

  /**
   * Check if currently connected.
   */
  isConnectedToServer(): boolean {
    return this.isConnected && this.replicationClient.getState() === ReplicationState.Joined;
  }
}
