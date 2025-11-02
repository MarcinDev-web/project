/**
 * ZoneManager - Orchestrates all zone systems (server, voxel ops, versioning, telemetry)
 */
import { ZoneServer, type ZoneServerOptions, type ClientPermission } from './ZoneServer.js';
import { VoxelOperationHandler } from './VoxelOperationHandler.js';
import { ZoneVersioning } from './ZoneVersioning.js';
import { VoxelStore } from '@engine/voxel';
import { TelemetryCollector } from '../telemetry/GameTelemetry.js';
import { CreatorEconomy } from '@engine/economy';
/**
 * Zone manager configuration
 */
export interface ZoneManagerOptions extends ZoneServerOptions {
    /** Zone ID */
    zoneId: string;
    /** Creator user ID */
    creatorId: string;
    /** Chunk size for voxel store */
    voxelChunkSize?: number;
    /** Enable telemetry collection */
    enableTelemetry?: boolean;
    /** Enable creator economy */
    enableEconomy?: boolean;
}
/**
 * Zone manager - coordinates all zone systems
 */
export declare class ZoneManager {
    private readonly zoneId;
    private readonly zoneServer;
    private readonly voxelStore;
    private readonly voxelHandler;
    private readonly versioning;
    private readonly telemetry?;
    private readonly creatorEconomy?;
    private readonly currencyManager;
    constructor(options: ZoneManagerOptions);
    /**
     * Start the zone server
     */
    start(): void;
    /**
     * Stop the zone server
     */
    stop(): void;
    /**
     * Add client to zone
     */
    addClient(clientId: string, permissions?: ClientPermission): void;
    /**
     * Remove client from zone
     */
    removeClient(clientId: string): void;
    /**
     * Get voxel operation handler
     */
    getVoxelHandler(): VoxelOperationHandler;
    /**
     * Get versioning manager
     */
    getVersioning(): ZoneVersioning;
    /**
     * Get telemetry collector
     */
    getTelemetry(): TelemetryCollector | undefined;
    /**
     * Get creator economy
     */
    getCreatorEconomy(): CreatorEconomy | undefined;
    /**
     * Get zone server
     */
    getZoneServer(): ZoneServer;
    /**
     * Get voxel store
     */
    getVoxelStore(): VoxelStore;
    /**
     * Create a version snapshot (for publish)
     */
    createVersion(createdBy: string, changelog?: string, isLive?: boolean): ReturnType<ZoneVersioning['createVersion']>;
    /**
     * Publish version (make it live)
     */
    publishVersion(versionId: string): void;
    /**
     * Dispose all resources
     */
    dispose(): void;
}
//# sourceMappingURL=ZoneManager.d.ts.map