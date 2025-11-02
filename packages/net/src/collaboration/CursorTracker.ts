import { ReplicationClient } from '../ReplicationClient';
import type { CursorUpdateMessage } from '../types/replication';
import type { PublicUser } from '../types/replication';
import type { Vec3 } from '@engine/core/math';

/**
 * Remote cursor data for visualization.
 */
export interface RemoteCursor {
  userId: string;
  user: PublicUser;
  position: Vec3;
  rotation?: [number, number, number, number]; // camera rotation
  lastUpdateTime: number;
  color: string; // Color for visualization
}

/**
 * Configuration for CursorTracker.
 */
export interface CursorTrackerConfig {
  /** Replication client for network communication. */
  replicationClient: ReplicationClient;
  /** How often to send cursor updates (in milliseconds). */
  sendInterval?: number; // Default: 100ms (10 updates per second)
  /** Throttle remote cursor updates (to reduce UI overhead). */
  remoteUpdateThrottle?: number; // Default: 200ms (5 updates per second)
}

/**
 * Callback types for cursor events.
 */
export type OnCursorAddedCallback = (cursor: RemoteCursor) => void;
export type OnCursorUpdatedCallback = (cursor: RemoteCursor) => void;
export type OnCursorRemovedCallback = (userId: string) => void;

/**
 * Tracks and visualizes cursor/camera positions of other users.
 * Handles:
 * - Sending local camera position updates
 * - Receiving and displaying remote cursor positions
 * - Visual indicators for other users' cameras
 */
export class CursorTracker {
  private readonly config: Required<CursorTrackerConfig>;
  private readonly remoteCursors = new Map<string, RemoteCursor>();
  private readonly users = new Map<string, PublicUser>(); // Track users by userId
  private sendTimer = 0;
  private localUserId: string | null = null;
  private currentPosition: Vec3 | null = null;
  private currentRotation: [number, number, number, number] | undefined = undefined;
  private lastSentTime = 0;

  // Event handlers
  private onCursorAddedHandlers: OnCursorAddedCallback[] = [];
  private onCursorUpdatedHandlers: OnCursorUpdatedCallback[] = [];
  private onCursorRemovedHandlers: OnCursorRemovedCallback[] = [];

  // Color palette for remote cursors
  private readonly colorPalette = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
  ];
  private colorIndex = 0;
  private userIdToColor = new Map<string, string>();

  constructor(config: CursorTrackerConfig) {
    this.config = {
      sendInterval: config.sendInterval ?? 100,
      remoteUpdateThrottle: config.remoteUpdateThrottle ?? 200,
      ...config,
    };

    // Subscribe to cursor updates from network
    this.config.replicationClient.onCursorUpdate((message) => {
      this.handleRemoteCursorUpdate(message);
    });

    // Subscribe to user events
    this.config.replicationClient.onUserJoined((user) => {
      this.handleUserJoined(user);
    });

    this.config.replicationClient.onUserLeft((userId) => {
      this.handleUserLeft(userId);
    });
  }

  /**
   * Update cursor tracker (call every frame).
   * Sends local cursor position if needed.
   */
  update(deltaTime: number): void {
    // Send local cursor position at interval
    this.sendTimer += deltaTime * 1000; // Convert to milliseconds
    if (this.sendTimer >= this.config.sendInterval) {
      if (this.currentPosition) {
        this.sendCursorUpdate(this.currentPosition, this.currentRotation);
      }
      this.sendTimer = 0;
    }
  }

  /**
   * Set local cursor position (call when camera moves).
   */
  setLocalCursor(position: Vec3, rotation?: [number, number, number, number]): void {
    this.currentPosition = [...position] as Vec3;
    this.currentRotation = rotation ? [...rotation] as [number, number, number, number] : undefined;
    
    // Send immediately if enough time has passed
    const now = Date.now();
    if (now - this.lastSentTime >= this.config.sendInterval) {
      this.sendCursorUpdate(position, rotation);
      this.lastSentTime = now;
    }
  }

  /**
   * Send cursor update to server.
   */
  private sendCursorUpdate(
    position: Vec3,
    rotation?: [number, number, number, number]
  ): void {
    this.config.replicationClient.sendCursorUpdate(
      [position[0], position[1], position[2]],
      rotation
    );
  }

  /**
   * Handle remote cursor update from network.
   */
  private handleRemoteCursorUpdate(message: CursorUpdateMessage): void {
    // Ignore updates from self
    if (message.userId === this.localUserId) {
      return;
    }

    const userId = message.userId ?? 'unknown';
    
    // Get or create remote cursor
    let cursor = this.remoteCursors.get(userId);
    if (!cursor) {
      // Find user info (should be available from user-joined event)
      const user = this.getUserInfo(userId);
      if (!user) {
        // User not found, skip
        return;
      }

      cursor = {
        userId,
        user,
        position: [...message.position] as Vec3,
        ...(message.rotation && { rotation: message.rotation }),
        lastUpdateTime: message.timestamp,
        color: this.getColorForUser(userId),
      };
      this.remoteCursors.set(userId, cursor);

      // Notify handlers
      this.onCursorAddedHandlers.forEach((cb) => cb(cursor!));
    } else {
      // Update existing cursor
      cursor.position = [...message.position] as Vec3;
      if (message.rotation) {
        cursor.rotation = message.rotation;
      } else {
        delete cursor.rotation;
      }
      cursor.lastUpdateTime = message.timestamp;

      // Throttle updates to avoid UI overhead
      const now = Date.now();
      if (now - cursor.lastUpdateTime < this.config.remoteUpdateThrottle) {
        return;
      }

      // Notify handlers
      this.onCursorUpdatedHandlers.forEach((cb) => cb(cursor!));
    }
  }

  /**
   * Handle user joined event.
   */
  private handleUserJoined(user: PublicUser): void {
    // Store user info for later lookup
    this.users.set(user.id, user);
    // User cursor will be created when first cursor update is received
    // But we can pre-allocate color
    this.getColorForUser(user.id);
  }

  /**
   * Handle user left event.
   */
  private handleUserLeft(userId: string): void {
    const cursor = this.remoteCursors.get(userId);
    if (cursor) {
      this.remoteCursors.delete(userId);
      this.userIdToColor.delete(userId);

      // Notify handlers
      this.onCursorRemovedHandlers.forEach((cb) => cb(userId));
    }
    
    // Remove user info
    this.users.delete(userId);
  }

  /**
   * Get color for user (assigns color on first use).
   */
  private getColorForUser(userId: string): string {
    let color = this.userIdToColor.get(userId);
    if (!color) {
      color = this.colorPalette[this.colorIndex % this.colorPalette.length]!;
      this.userIdToColor.set(userId, color);
      this.colorIndex++;
    }
    return color;
  }

  /**
   * Get user info (tracked from user-joined events).
   */
  private getUserInfo(userId: string): PublicUser | null {
    return this.users.get(userId) ?? null;
  }

  /**
   * Set local user ID.
   */
  setLocalUserId(userId: string): void {
    this.localUserId = userId;
  }

  /**
   * Get all remote cursors.
   */
  getRemoteCursors(): Map<string, RemoteCursor> {
    return new Map(this.remoteCursors);
  }

  /**
   * Get remote cursor for a specific user.
   */
  getRemoteCursor(userId: string): RemoteCursor | null {
    return this.remoteCursors.get(userId) ?? null;
  }

  /**
   * Register event handlers.
   */
  onCursorAdded(callback: OnCursorAddedCallback): () => void {
    this.onCursorAddedHandlers.push(callback);
    return () => {
      const index = this.onCursorAddedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onCursorAddedHandlers.splice(index, 1);
      }
    };
  }

  onCursorUpdated(callback: OnCursorUpdatedCallback): () => void {
    this.onCursorUpdatedHandlers.push(callback);
    return () => {
      const index = this.onCursorUpdatedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onCursorUpdatedHandlers.splice(index, 1);
      }
    };
  }

  onCursorRemoved(callback: OnCursorRemovedCallback): () => void {
    this.onCursorRemovedHandlers.push(callback);
    return () => {
      const index = this.onCursorRemovedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onCursorRemovedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Cleanup - call when cursor tracker is no longer needed.
   */
  dispose(): void {
    this.remoteCursors.clear();
    this.users.clear();
    this.userIdToColor.clear();
    this.onCursorAddedHandlers = [];
    this.onCursorUpdatedHandlers = [];
    this.onCursorRemovedHandlers = [];
  }
}

