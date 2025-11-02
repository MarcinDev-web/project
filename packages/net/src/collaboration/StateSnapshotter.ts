import type { Scene, SceneData } from '@engine/world';
import { Scene as SceneClass } from '@engine/world';
import { ReplicationClient } from '../ReplicationClient';
import type { SceneSnapshot } from '../types/replication';

/**
 * Configuration for StateSnapshotter.
 */
export interface StateSnapshotterConfig {
  /** Scene to snapshot. */
  scene: Scene;
  /** Replication client for network communication. */
  replicationClient: ReplicationClient;
  /** How often to create snapshots (in milliseconds). */
  snapshotInterval?: number; // Default: 5000ms (5 seconds)
  /** Maximum number of snapshots to keep in memory. */
  maxSnapshots?: number; // Default: 10
  /** Enable automatic snapshot request on disconnect recovery. */
  enableRecovery?: boolean; // Default: true
}

/**
 * Callback types for snapshot events.
 */
export type OnSnapshotCreatedCallback = (snapshot: SceneSnapshot) => void;
export type OnSnapshotReceivedCallback = (snapshot: SceneSnapshot) => void;

/**
 * Creates periodic snapshots of scene state for synchronization and recovery.
 * Handles:
 * - Periodic scene state snapshots
 * - Snapshot versioning
 * - Recovery after disconnects
 * - Full state synchronization
 */
export class StateSnapshotter {
  private readonly config: Required<StateSnapshotterConfig>;
  private snapshotTimer = 0;
  private snapshotVersion = 0;
  private snapshots: SceneSnapshot[] = [];

  // Event handlers
  private onSnapshotCreatedHandlers: OnSnapshotCreatedCallback[] = [];
  private onSnapshotReceivedHandlers: OnSnapshotReceivedCallback[] = [];

  constructor(config: StateSnapshotterConfig) {
    this.config = {
      snapshotInterval: config.snapshotInterval ?? 5000,
      maxSnapshots: config.maxSnapshots ?? 10,
      enableRecovery: config.enableRecovery ?? true,
      ...config,
    };

    // Subscribe to snapshot messages from network
    this.config.replicationClient.onSnapshot((snapshot) => {
      this.handleRemoteSnapshot(snapshot);
    });

    // Subscribe to connection state changes for recovery
    if (this.config.enableRecovery) {
      this.config.replicationClient.onStateChange((state) => {
        if (state === 'joined') {
          // Request snapshot when reconnected
          this.requestSnapshot();
        }
      });
    }
  }

  /**
   * Update snapshotter (call every frame).
   * Creates snapshots at interval.
   */
  update(deltaTime: number): void {
    this.snapshotTimer += deltaTime * 1000; // Convert to milliseconds
    if (this.snapshotTimer >= this.config.snapshotInterval) {
      this.createSnapshot();
      this.snapshotTimer = 0;
    }
  }

  /**
   * Create a snapshot of current scene state.
   */
  createSnapshot(): SceneSnapshot {
    const sceneData = this.config.scene.toJSON();
    const timestamp = Date.now();

    const snapshot: SceneSnapshot = {
      sceneData: sceneData as unknown,
      timestamp,
      version: this.snapshotVersion++,
    };

    // Store snapshot
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift(); // Remove oldest
    }

    // Send snapshot to server (via operation)
    this.sendSnapshot(snapshot);

    // Notify handlers
    this.onSnapshotCreatedHandlers.forEach((cb) => cb(snapshot));

    return snapshot;
  }

  /**
   * Request a snapshot from server (for recovery).
   */
  requestSnapshot(): void {
    // In a full implementation, this would send a snapshot-request message
    // For now, we'll just log it
    console.log('Requesting snapshot from server...');
    
    // The server should respond with a snapshot message
    // This is handled by the server-side implementation
  }

  /**
   * Apply snapshot to scene (recover state).
   */
  applySnapshot(snapshot: SceneSnapshot): void {
    try {
      // Clear current scene
      const entities = [...this.config.scene.rootEntities];
      for (const entity of entities) {
        this.config.scene.removeEntity(entity);
      }

      // Load scene from snapshot
      const sceneData = snapshot.sceneData as SceneData;
      const newScene = SceneClass.fromJSON(sceneData);

      // Copy entities from new scene to current scene
      for (const entity of newScene.rootEntities) {
        this.config.scene.addEntity(entity);
      }

      // Update scene name
      this.config.scene.name = newScene.name;

      // Update snapshot version
      this.snapshotVersion = snapshot.version;

      console.log(`Applied snapshot version ${snapshot.version} at ${new Date(snapshot.timestamp).toISOString()}`);

      // Notify handlers
      this.onSnapshotReceivedHandlers.forEach((cb) => cb(snapshot));
    } catch (error) {
      console.error('Failed to apply snapshot:', error);
      throw error;
    }
  }

  /**
   * Handle remote snapshot from network.
   */
  private handleRemoteSnapshot(snapshot: SceneSnapshot): void {
    // Check if snapshot is newer than current
    if (snapshot.version > this.snapshotVersion) {
      // Apply snapshot if it's newer
      this.applySnapshot(snapshot);
    } else {
      console.log(`Ignoring snapshot version ${snapshot.version} (current: ${this.snapshotVersion})`);
    }
  }

  /**
   * Send snapshot to server.
   */
  private sendSnapshot(snapshot: SceneSnapshot): void {
    // Send as operation
    this.config.replicationClient.sendOperation({
      id: `snapshot_${snapshot.version}_${snapshot.timestamp}`,
      type: 'component-update',
      timestamp: snapshot.timestamp,
      userId: this.getLocalUserId() ?? 'local',
      data: {
        snapshot: snapshot,
      },
    });
  }

  /**
   * Get latest snapshot.
   */
  getLatestSnapshot(): SceneSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1]! : null;
  }

  /**
   * Get snapshot by version.
   */
  getSnapshotByVersion(version: number): SceneSnapshot | null {
    return this.snapshots.find((s) => s.version === version) ?? null;
  }

  /**
   * Get all stored snapshots.
   */
  getAllSnapshots(): SceneSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get current snapshot version.
   */
  getCurrentVersion(): number {
    return this.snapshotVersion;
  }

  /**
   * Reset snapshot version (call when synchronizing with server).
   */
  resetVersion(version: number): void {
    this.snapshotVersion = version;
  }

  /**
   * Get local user ID.
   */
  private getLocalUserId(): string | null {
    return this.config.replicationClient.getLocalUserId();
  }

  /**
   * Register event handlers.
   */
  onSnapshotCreated(callback: OnSnapshotCreatedCallback): () => void {
    this.onSnapshotCreatedHandlers.push(callback);
    return () => {
      const index = this.onSnapshotCreatedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onSnapshotCreatedHandlers.splice(index, 1);
      }
    };
  }

  onSnapshotReceived(callback: OnSnapshotReceivedCallback): () => void {
    this.onSnapshotReceivedHandlers.push(callback);
    return () => {
      const index = this.onSnapshotReceivedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onSnapshotReceivedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Cleanup - call when snapshotter is no longer needed.
   */
  dispose(): void {
    this.snapshots = [];
    this.onSnapshotCreatedHandlers = [];
    this.onSnapshotReceivedHandlers = [];
  }
}

