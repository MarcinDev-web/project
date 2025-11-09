import type { Scene } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import {
  ReplicationClient,
  OperationReplicator,
  CursorTracker,
  StateSnapshotter,
  ConflictResolver,
  ConflictResolutionStrategy,
  MultiplayerGameplayManager,
  type PublicUser,
} from '@engine/net';
import { CollaborationPanel } from '../ui/CollaborationPanel';
import type { Vec3 } from '@engine/core/math';
import type { Entity } from '@engine/world';
import type { CharacterInput } from '@engine/world';

/**
 * Configuration for CollaborationManager.
 */
export interface CollaborationManagerConfig {
  /** Scene to replicate. */
  scene: Scene;
  /** JWT token for authentication. */
  jwtToken: string;
  /** WebSocket URL (defaults to ws://localhost:3001). */
  wsUrl?: string;
  /** Callback when collaboration starts. */
  onStart?: () => void;
  /** Callback when collaboration stops. */
  onStop?: () => void;
  /** PhysicsWorld for multiplayer gameplay (optional). */
  physicsWorld?: PhysicsWorld | null;
}

/**
 * Manager for collaboration features in the editor.
 * Handles:
 * - Collaboration session management
 * - Operation replication
 * - Cursor tracking
 * - State snapshots
 * - Conflict resolution
 */
export class CollaborationManager {
  private readonly config: CollaborationManagerConfig;
  private replicationClient: ReplicationClient | null = null;
  private operationReplicator: OperationReplicator | null = null;
  private cursorTracker: CursorTracker | null = null;
  private stateSnapshotter: StateSnapshotter | null = null;
  private conflictResolver: ConflictResolver | null = null;
  private collaborationPanel: CollaborationPanel | null = null;
  private multiplayerGameplayManager: MultiplayerGameplayManager | null = null;
  private currentSessionId: string | null = null;
  private isActive = false;
  private currentUserId: string | null = null;
  
  // Play Mode synchronization
  private pendingPlayModeRequest: string | null = null;
  private playModeRequestTimeout: ReturnType<typeof setTimeout> | null = null;
  private onPlayModeRequestedHandlers: Array<(fromUser: PublicUser, requestId: string) => void> = [];
  private onPlayModeStartedHandlers: Array<() => void> = [];

  // UI follow handlers
  private onFollowUserHandler: ((userId: string) => void) | null = null;
  private onStopFollowHandler: (() => void) | null = null;

  // Presenter mode state and handlers
  private presenterUserId: string | null = null;
  private onPresenterChangedHandlers: Array<(userId: string | null) => void> = [];
  private onTogglePresenterHandler: ((active: boolean) => void) | null = null;

  constructor(config: CollaborationManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize collaboration manager.
   */
  initialize(): void {
    // Create ReplicationClient
    const wsUrl = this.config.wsUrl ?? 'ws://localhost:3001';
    this.replicationClient = new ReplicationClient(wsUrl, this.config.jwtToken);

    // Create collaboration panel
    this.collaborationPanel = new CollaborationPanel({
      replicationClient: this.replicationClient,
      onStartSession: (sessionId) => {
        this.startCollaboration(sessionId);
      },
      onStopSession: () => {
        this.stopCollaboration();
      },
      onFollowUser: (userId) => this.onFollowUserHandler?.(userId),
      onStopFollow: () => this.onStopFollowHandler?.(),
      onTogglePresenter: (active) => this.onTogglePresenterHandler?.(active),
    });

    // Create conflict resolver
    this.conflictResolver = new ConflictResolver({
      strategy: ConflictResolutionStrategy.LastWriteWins,
      enableLogging: true,
    });

    // Track presenter via player-update state
    this.replicationClient.onPlayerUpdate((message) => {
      const state = (message as any).state as Record<string, unknown> | undefined;
      if (!state || typeof state.presenter !== 'boolean') return;
      const sender = (message as any).userId as string | undefined;
      const playerId = (message as any).playerId as string | undefined;
      const userId = sender || playerId || null;
      if (!userId) return;
      if (state.presenter === true) {
        this.setPresenterInternal(userId);
      } else {
        if (this.presenterUserId === userId) {
          this.setPresenterInternal(null);
        }
      }
    });
  }

  /**
   * Start collaboration session.
   */
  private async startCollaboration(sessionId: string): Promise<void> {
    if (!this.replicationClient) {
      throw new Error('CollaborationManager not initialized');
    }

    this.currentSessionId = sessionId;

    // Connect to session
    await this.replicationClient.connect(sessionId);

    // Initialize collaboration components
    this.operationReplicator = new OperationReplicator({
      scene: this.config.scene,
      replicationClient: this.replicationClient,
    });

    this.cursorTracker = new CursorTracker({
      replicationClient: this.replicationClient,
    });

    this.stateSnapshotter = new StateSnapshotter({
      scene: this.config.scene,
      replicationClient: this.replicationClient,
    });

    // Set local user ID (should come from auth system)
    if (this.currentUserId) {
      this.operationReplicator.setLocalUserId(this.currentUserId);
      this.cursorTracker.setLocalUserId(this.currentUserId);
    }

    // Subscribe to Play Mode synchronization events
    this.replicationClient.onPlayModeRequest((message) => {
      this.handlePlayModeRequest(message);
    });

    this.replicationClient.onPlayModeStart((message) => {
      this.handlePlayModeStart(message);
    });

    // Update currentUserId if available from ReplicationClient
    const clientUserId = this.replicationClient.getLocalUserId();
    if (clientUserId && !this.currentUserId) {
      this.currentUserId = clientUserId;
      this.operationReplicator?.setLocalUserId(clientUserId);
      this.cursorTracker?.setLocalUserId(clientUserId);
    }

    this.isActive = true;

    if (this.config.onStart) {
      this.config.onStart();
    }
  }

  /**
   * Stop collaboration session.
   */
  private stopCollaboration(): void {
    if (this.replicationClient) {
      this.replicationClient.disconnect();
    }

    // Cleanup components
    this.operationReplicator?.dispose();
    this.operationReplicator = null;

    this.cursorTracker?.dispose();
    this.cursorTracker = null;

    this.stateSnapshotter?.dispose();
    this.stateSnapshotter = null;

    this.currentSessionId = null;
    this.isActive = false;

    if (this.config.onStop) {
      this.config.onStop();
    }
  }

  /**
   * Update collaboration systems (call every frame).
   */
  update(deltaTime: number): void {
    if (!this.isActive) return;

    this.cursorTracker?.update(deltaTime);
    this.stateSnapshotter?.update(deltaTime);
    // Multiplayer gameplay is updated separately in play mode
  }

  /**
   * Start multiplayer gameplay session.
   * Should be called when entering play mode.
   */
  async startMultiplayerGameplay(localPlayerEntity: Entity): Promise<void> {
    if (!this.isActive || !this.currentSessionId || !this.replicationClient) {
      return; // Collaboration not active
    }

    const physicsWorld = this.config.physicsWorld;
    if (!physicsWorld) {
      console.warn('PhysicsWorld not available for multiplayer gameplay');
      return;
    }

    // Create multiplayer gameplay manager (reuses existing ReplicationClient connection)
    this.multiplayerGameplayManager = new MultiplayerGameplayManager(
      this.replicationClient,
      this.config.scene,
      physicsWorld
    );

    // Start multiplayer session (reuses existing connection)
    // Note: MultiplayerGameplayManager will try to connect, but ReplicationClient is already connected
    // We need to pass the session ID and ensure the connection is maintained
    await this.multiplayerGameplayManager.startSession(this.currentSessionId, localPlayerEntity);
  }

  /**
   * Stop multiplayer gameplay session.
   * Should be called when exiting play mode.
   */
  async stopMultiplayerGameplay(): Promise<void> {
    if (this.multiplayerGameplayManager) {
      await this.multiplayerGameplayManager.stopSession();
      this.multiplayerGameplayManager = null;
    }
  }

  /**
   * Update multiplayer gameplay systems (call every frame in play mode).
   */
  updateMultiplayerGameplay(deltaTime: number): void {
    this.multiplayerGameplayManager?.update(deltaTime);
  }

  /**
   * Process input for multiplayer replication (call in play mode).
   */
  processMultiplayerInput(input: CharacterInput): void {
    this.multiplayerGameplayManager?.processInput(input);
  }

  /**
   * Send Play Mode end notification (when exiting Play Mode).
   */
  sendPlayModeEnd(): void {
    if (this.replicationClient && this.isActive) {
      this.replicationClient.sendPlayModeEnd();
    }
  }

  /**
   * Update cursor position (call when camera moves).
   */
  updateCursor(position: Vec3, rotation?: [number, number, number, number]): void {
    this.cursorTracker?.setLocalCursor(position, rotation);
  }

  /**
   * Replicate entity creation.
   */
  replicateEntityCreate(entity: any, parentId?: string): void {
    this.operationReplicator?.replicateEntityCreate(entity, parentId);
  }

  /**
   * Replicate entity deletion.
   */
  replicateEntityDelete(entityId: string): void {
    this.operationReplicator?.replicateEntityDelete(entityId);
  }

  /**
   * Replicate transform update.
   */
  replicateTransformUpdate(
    entityId: string,
    position?: Vec3,
    rotation?: [number, number, number, number],
    scale?: Vec3
  ): void {
    this.operationReplicator?.replicateTransformUpdate(entityId, position, rotation, scale);
  }

  /**
   * Mount collaboration panel to container.
   */
  mountPanel(container: HTMLElement): void {
    this.collaborationPanel?.mount(container);
  }

  /**
   * Unmount collaboration panel.
   */
  unmountPanel(): void {
    this.collaborationPanel?.unmount();
  }

  /**
   * Get collaboration panel (for custom mounting).
   */
  getPanel(): CollaborationPanel | null {
    return this.collaborationPanel;
  }

  /**
   * Check if collaboration is active.
   */
  isCollaborating(): boolean {
    return this.isActive;
  }

  /**
   * Get current session ID.
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get remote cursors (for rendering indicators).
   */
  getRemoteCursors(): Map<string, any> {
    return this.cursorTracker?.getRemoteCursors() ?? new Map();
  }

  /**
   * Set local user ID.
   */
  setLocalUserId(userId: string): void {
    this.currentUserId = userId;
    this.operationReplicator?.setLocalUserId(userId);
    this.cursorTracker?.setLocalUserId(userId);
  }

  /**
   * Request Play Mode synchronization.
   * Sends a request to all users in the session to join Play Mode.
   * Returns requestId if successful, null if collaboration is not active.
   */
  requestPlayMode(): string | null {
    if (!this.isActive || !this.replicationClient || !this.currentSessionId) {
      return null;
    }

    // Generate unique request ID
    const requestId = `playmode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.pendingPlayModeRequest = requestId;

    // Get local user info (need to construct PublicUser from currentUserId)
    // For now, we'll create a minimal PublicUser - in a real implementation,
    // this would come from auth system
    const fromUser: PublicUser = {
      id: this.currentUserId || 'unknown',
      email: this.currentUserId || 'unknown@local',
      createdAt: Date.now(),
    };

    // Send Play Mode request
    this.replicationClient.sendPlayModeRequest(requestId, fromUser);

    // Set timeout (30 seconds)
    this.playModeRequestTimeout = setTimeout(() => {
      if (this.pendingPlayModeRequest === requestId) {
        console.warn('Play Mode request timed out');
        this.pendingPlayModeRequest = null;
        this.playModeRequestTimeout = null;
        // Note: Server should handle timeout and send start to accepted users
      }
    }, 30000);

    return requestId;
  }

  /**
   * Respond to a Play Mode request.
   */
  respondToPlayModeRequest(requestId: string, accept: boolean): void {
    if (!this.isActive || !this.replicationClient) {
      return;
    }

    this.replicationClient.sendPlayModeResponse(requestId, accept);

    // Clear pending request if we're responding
    if (this.pendingPlayModeRequest === requestId) {
      this.pendingPlayModeRequest = null;
      if (this.playModeRequestTimeout) {
        clearTimeout(this.playModeRequestTimeout);
        this.playModeRequestTimeout = null;
      }
    }
  }

  /**
   * Subscribe to Play Mode request events.
   */
  onPlayModeRequested(callback: (fromUser: PublicUser, requestId: string) => void): () => void {
    this.onPlayModeRequestedHandlers.push(callback);
    return () => {
      const index = this.onPlayModeRequestedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onPlayModeRequestedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to Play Mode start events.
   */
  onPlayModeStarted(callback: () => void): () => void {
    this.onPlayModeStartedHandlers.push(callback);
    return () => {
      const index = this.onPlayModeStartedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onPlayModeStartedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Handle incoming Play Mode request.
   */
  private handlePlayModeRequest(message: { requestId: string; fromUser: PublicUser }): void {
    // Don't handle our own requests
    if (message.fromUser.id === this.currentUserId) {
      return;
    }

    // Notify handlers
    this.onPlayModeRequestedHandlers.forEach((cb) => cb(message.fromUser, message.requestId));
  }

  /**
   * Handle Play Mode start notification.
   */
  private handlePlayModeStart(message: { requestId: string }): void {
    // Clear pending request if this is the one we're waiting for
    if (this.pendingPlayModeRequest === message.requestId) {
      this.pendingPlayModeRequest = null;
      if (this.playModeRequestTimeout) {
        clearTimeout(this.playModeRequestTimeout);
        this.playModeRequestTimeout = null;
      }
    }

    // Notify handlers that Play Mode should start
    this.onPlayModeStartedHandlers.forEach((cb) => cb());
  }

  /**
   * Dispose collaboration manager.
   */
  dispose(): void {
    // Clear Play Mode request timeout
    if (this.playModeRequestTimeout) {
      clearTimeout(this.playModeRequestTimeout);
      this.playModeRequestTimeout = null;
    }

    this.stopCollaboration();
    this.stopMultiplayerGameplay();
    this.collaborationPanel?.dispose();
    this.collaborationPanel = null;
    this.replicationClient = null;
    this.conflictResolver?.dispose();
    this.conflictResolver = null;
    this.onPlayModeRequestedHandlers = [];
    this.onPlayModeStartedHandlers = [];
  }

  /** Wire follow/stop-follow actions from UI */
  setFollowHandlers(onFollowUser: (userId: string) => void, onStopFollow: () => void): void {
    this.onFollowUserHandler = onFollowUser;
    this.onStopFollowHandler = onStopFollow;
  }

  /** Update panel with current following state */
  setFollowingUser(userId: string | null): void {
    this.collaborationPanel?.setFollowing(userId);
  }

  // ===== Presenter Mode API =====
  enablePresenterMode(): void {
    if (!this.isActive || !this.replicationClient) return;
    const localId = this.replicationClient.getLocalUserId();
    if (!localId) return;
    this.sendPresenterState(true, localId);
    this.setPresenterInternal(localId);
  }

  disablePresenterMode(): void {
    if (!this.isActive || !this.replicationClient) return;
    const localId = this.replicationClient.getLocalUserId();
    if (!localId) return;
    this.sendPresenterState(false, localId);
    if (this.presenterUserId === localId) {
      this.setPresenterInternal(null);
    }
  }

  onPresenterChanged(callback: (userId: string | null) => void): () => void {
    this.onPresenterChangedHandlers.push(callback);
    return () => {
      const idx = this.onPresenterChangedHandlers.indexOf(callback);
      if (idx >= 0) this.onPresenterChangedHandlers.splice(idx, 1);
    };
  }

  setPresenterToggleHandler(handler: (active: boolean) => void): void {
    this.onTogglePresenterHandler = handler;
  }

  getPresenterUserId(): string | null {
    return this.presenterUserId;
  }

  getLocalUserId(): string | null {
    try {
      return this.replicationClient?.getLocalUserId?.() ?? null;
    } catch {
      return null;
    }
  }

  setPresenterOnPanel(userId: string | null): void {
    this.collaborationPanel?.setPresenter(userId);
  }

  private sendPresenterState(active: boolean, playerId: string): void {
    try {
      this.replicationClient.sendPlayerUpdate({
        playerId,
        state: { presenter: active },
      } as any);
    } catch {
      // ignore send errors
    }
  }

  private setPresenterInternal(userId: string | null): void {
    this.presenterUserId = userId;
    this.setPresenterOnPanel(userId);
    this.onPresenterChangedHandlers.forEach((cb) => cb(userId));
  }
}

