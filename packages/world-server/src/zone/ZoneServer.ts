import { EditScope, type ZoneRole } from '@engine/net-protocol';
import { Scene, Entity } from '@engine/world';
import type { EcsReplicator } from '../replication/EcsReplicator.js';
import { SnapshotScheduler } from '../replication/SnapshotScheduler.js';
import type { ClientBaselineState } from '../replication/types.js';
import { SpatialHashGrid, selectAoI, type Vec3 as AoIVec3 } from '../aoi/GridAoI.js';

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
  // Area of Interest (AoI) - viewer position for entity filtering
  viewerPosition?: AoIVec3;
  viewRadius?: number; // Default view radius if not set
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
  // Area of Interest (AoI) spatial indexing
  private readonly aoiGrid: SpatialHashGrid;
  private readonly entityPositions = new Map<bigint, AoIVec3>(); // Track previous positions for move detection
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
    // Initialize AoI grid with 10-unit cells (good balance for most game scales)
    this.aoiGrid = new SpatialHashGrid(10);
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

    // Update AoI grid with current entity positions
    this.updateAoIGrid();

    // Build snapshot for each client
    const context = { scene: this.scene };
    
    for (const [clientId, clientState] of this.clients.entries()) {
      // Get entities to replicate using AoI filtering per client
      let entities: Array<{ id: bigint }>;
      
      if (clientState.viewerPosition && clientState.viewRadius !== undefined) {
        // Use AoI filtering based on client's viewer position
        const aoiResults = selectAoI(
          this.aoiGrid,
          clientState.viewerPosition,
          clientState.viewRadius
        );
        entities = aoiResults.map((result) => ({ id: result.id }));
      } else {
        // Fallback: all root entities if client position not set
        entities = this.scene.rootEntities.map((e: Entity) => {
          // Convert entity ID to bigint (simple parsing)
          const numId = parseInt(e.id.replace('entity_', '')) || 0;
          return { id: BigInt(numId) };
        });
      }

      const snapshot = this.snapshotScheduler.scheduleForClient(
        context,
        clientState as ClientBaselineState,
        entities
      );

      if (snapshot) {
        // Emit snapshot for transport layer
        this.onSnapshot?.(clientId, snapshot);
      }
    }
  }

  /**
   * Update AoI spatial grid with current entity positions from scene
   */
  private updateAoIGrid(): void {
    if (!this.scene) return;

    const allEntities = this.scene.getAllEntities();
    
    for (const entity of allEntities) {
      const numId = parseInt(entity.id.replace('entity_', '')) || 0;
      const entityId = BigInt(numId);
      const pos = entity.transform.position;
      
      // Convert Vec3 array to AoI Vec3 format
      const aoiPos: AoIVec3 = { x: pos[0], y: pos[1], z: pos[2] };
      
      const prevPos = this.entityPositions.get(entityId);
      if (prevPos) {
        // Entity exists in grid - check if moved
        const dx = Math.abs(aoiPos.x - prevPos.x);
        const dy = Math.abs(aoiPos.y - prevPos.y);
        const dz = Math.abs(aoiPos.z - prevPos.z);
        
        // Only update if position changed significantly (avoid micro-movements)
        if (dx > 0.1 || dy > 0.1 || dz > 0.1) {
          this.aoiGrid.move({ id: entityId, position: aoiPos }, prevPos);
          this.entityPositions.set(entityId, aoiPos);
        }
      } else {
        // New entity - insert into grid
        this.aoiGrid.insert({ id: entityId, position: aoiPos });
        this.entityPositions.set(entityId, aoiPos);
      }
    }
    
    // Remove entities that no longer exist in scene
    const sceneEntityIds = new Set(
      allEntities.map((e) => {
        const numId = parseInt(e.id.replace('entity_', '')) || 0;
        return BigInt(numId);
      })
    );
    
    for (const [entityId, pos] of this.entityPositions.entries()) {
      if (!sceneEntityIds.has(entityId)) {
        this.aoiGrid.remove({ id: entityId, position: pos });
        this.entityPositions.delete(entityId);
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
      viewRadius: 100, // Default view radius (100 units)
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

  /**
   * Get client's userId from permissions
   */
  getClientUserId(clientId: string): string | null {
    return this.clients.get(clientId)?.permissions?.userId ?? null;
  }

  /**
   * Update client's viewer position for AoI filtering
   * Call this when client position changes (e.g., from player input updates)
   */
  setClientViewerPosition(clientId: string, position: AoIVec3, viewRadius?: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.viewerPosition = position;
      if (viewRadius !== undefined) {
        client.viewRadius = viewRadius;
      }
    }
  }

  /**
   * Get client's current viewer position
   */
  getClientViewerPosition(clientId: string): AoIVec3 | undefined {
    return this.clients.get(clientId)?.viewerPosition;
  }
}


