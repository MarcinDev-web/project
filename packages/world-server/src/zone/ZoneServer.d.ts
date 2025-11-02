import { EditScope, type ZoneRole } from '@engine/net-protocol';
import type { Scene } from '@engine/world';
import type { EcsReplicator } from '../replication/EcsReplicator.js';
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
/**
 * Rate limiting configuration for voxel operations
 */
export interface VoxelRateLimitConfig {
    /** Max operations per time window */
    maxOps: number;
    /** Time window in milliseconds */
    windowMs: number;
}
export declare class ZoneServer {
    private readonly tickIntervalMs;
    private tickTimer;
    private readonly clients;
    private readonly voxelRateLimit;
    private readonly scene;
    private readonly replicator;
    private readonly snapshotScheduler;
    private _seqCounter;
    constructor(options: ZoneServerOptions);
    start(): void;
    stop(): void;
    protected tick(): void;
    onSnapshot?: (clientId: string, snapshot: import('@engine/net-protocol').SnapshotMessage) => void;
    addClient(id: string, permissions?: ClientPermission): void;
    removeClient(id: string): void;
    /**
     * Set or update client permissions
     */
    setClientPermissions(clientId: string, permissions: ClientPermission): void;
    /**
     * Check if client has required scope
     */
    hasScope(clientId: string, scope: EditScope): boolean;
    /**
     * Check if client can perform voxel operation (permission + rate limit)
     */
    canPerformVoxelOp(clientId: string): boolean;
    /**
     * Record a voxel operation (call after successful permission check)
     */
    recordVoxelOp(clientId: string): void;
    /**
     * Get client's role
     */
    getClientRole(clientId: string): ZoneRole | null;
}
//# sourceMappingURL=ZoneServer.d.ts.map