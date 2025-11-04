import { EditScope, type ZoneRole } from '@engine/net-protocol';
import { Scene, Entity } from '@engine/world';
import type { EcsReplicator } from '../replication/EcsReplicator.js';
import { SnapshotScheduler } from '../replication/SnapshotScheduler.js';
import type { ClientBaselineState } from '../replication/types.js';

export interface ZoneServerOptions {
  tickRateHz: number;
  scene?: Scene;
  replicator?: EcsReplicator;
}

export interface ClientPermission {
  userId: string;
  role: ZoneRole;
  scopes: EditScope[];
}

interface ClientState {
  id: string;
  lastAckInputSeq: number;
  lastBaselineSeq: number;
  permissions?: ClientPermission;
  // Rate limiting for voxel operations
  voxelOpsHistory: number[]; // Timestamps of recent operations
}

/**
 * Rate limiting configuration for voxel operations
 */
export interface VoxelRateLimitConfig {
  /** Max operations per time window */
  maxOps: number;
  /** Time window in milliseconds */
  windowMs: number;
}

const DEFAULT_VOXEL_RATE_LIMIT: VoxelRateLimitConfig = {
  maxOps: 100,
  windowMs: 1000, // 100 ops per second
};

export class ZoneServer {
  private readonly tickIntervalMs: number;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly clients = new Map<string, ClientState>();
  private readonly voxelRateLimit: VoxelRateLimitConfig;
  private readonly scene: Scene | null;
  private readonly replicator: EcsReplicator | null;
  private readonly snapshotScheduler: SnapshotScheduler | null;
  // seqCounter reserved for future sequence tracking
  // @ts-expect-error Reserved for future sequence tracking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _seqCounter = 1;

  constructor(options: ZoneServerOptions) {
    this.tickIntervalMs = Math.floor(1000 / options.tickRateHz);
    this.voxelRateLimit = DEFAULT_VOXEL_RATE_LIMIT;
    this.scene = options.scene ?? null;
    this.replicator = options.replicator ?? null;
    this.snapshotScheduler = this.replicator
      ? new SnapshotScheduler(this.replicator, { maxBytesPerTick: 8192 })
      : null;
  }

  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  // Called each tick to advance simulation
  protected tick(): void {
    if (!this.scene || !this.replicator || !this.snapshotScheduler) {
      return;
    }

    // Build snapshot for each client
    const context = { scene: this.scene };
    
    for (const [clientId, clientState] of this.clients.entries()) {
      // Get entities to replicate (simple: all root entities for now)
      // TODO: Use AoI (Area of Interest) to filter entities per client
      // Reserved for future per-client filtering
      void clientState;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // entities will be used when AoI filtering is implemented
      const entities = this.scene.rootEntities.map((e: Entity) => {
        // Convert entity ID to bigint (simple parsing)
        const numId = parseInt(e.id.replace('entity_', '')) || 0;
        return { id: BigInt(numId) };
      });
      void entities;

      const snapshot = this.snapshotScheduler.scheduleForClient(
        context,
        clientState as ClientBaselineState
      );

      if (snapshot) {
        // Emit snapshot for transport layer
        this.onSnapshot?.(clientId, snapshot);
      }
    }
  }

  // Callback for sending snapshots to clients
  onSnapshot?: (clientId: string, snapshot: import('@engine/net-protocol').SnapshotMessage) => void;

  addClient(id: string, permissions?: ClientPermission): void {
    if (this.clients.has(id)) return;
    this.clients.set(id, {
      id,
      lastAckInputSeq: 0,
      lastBaselineSeq: 0,
      ...(permissions !== undefined && { permissions }),
      voxelOpsHistory: [],
    });
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  /**
   * Set or update client permissions
   */
  setClientPermissions(clientId: string, permissions: ClientPermission): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.permissions = permissions;
    }
  }

  /**
   * Check if client has required scope
   */
  hasScope(clientId: string, scope: EditScope): boolean {
    const client = this.clients.get(clientId);
    if (!client?.permissions) return false;

    // Owner and admin have all scopes
    if (
      client.permissions.role === 'owner' ||
      client.permissions.scopes.includes(EditScope.ADMIN)
    ) {
      return true;
    }

    return client.permissions.scopes.includes(scope);
  }

  /**
   * Check if client can perform voxel operation (permission + rate limit)
   */
  canPerformVoxelOp(clientId: string): boolean {
    if (!this.hasScope(clientId, EditScope.VOXEL_EDIT)) {
      return false;
    }

    const client = this.clients.get(clientId);
    if (!client) return false;

    const now = Date.now();
    // Remove old entries outside the window
    client.voxelOpsHistory = client.voxelOpsHistory.filter(
      (ts) => now - ts < this.voxelRateLimit.windowMs
    );

    // Check if under limit
    return client.voxelOpsHistory.length < this.voxelRateLimit.maxOps;
  }

  /**
   * Record a voxel operation (call after successful permission check)
   */
  recordVoxelOp(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.voxelOpsHistory.push(Date.now());
    }
  }

  /**
   * Get client's role
   */
  getClientRole(clientId: string): ZoneRole | null {
    return this.clients.get(clientId)?.permissions?.role ?? null;
  }
}


