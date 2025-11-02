/**
 * ZoneManager - Orchestrates all zone systems (server, voxel ops, versioning, telemetry)
 */

import { ZoneServer, type ZoneServerOptions, type ClientPermission } from './ZoneServer.js';
import { VoxelOperationHandler } from './VoxelOperationHandler.js';
import { ZoneVersioning } from './ZoneVersioning.js';
import { VoxelStore } from '@engine/voxel';
import { TelemetryCollector } from '../telemetry/GameTelemetry.js';
import { CreatorEconomy } from '@engine/economy';
import { CurrencyManager } from '@engine/economy';

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
export class ZoneManager {
  private readonly zoneId: string;
  private readonly zoneServer: ZoneServer;
  private readonly voxelStore: VoxelStore;
  private readonly voxelHandler: VoxelOperationHandler;
  private readonly versioning: ZoneVersioning;
  private readonly telemetry?: TelemetryCollector;
  private readonly creatorEconomy?: CreatorEconomy;
  private readonly currencyManager: CurrencyManager;

  constructor(options: ZoneManagerOptions) {
    this.zoneId = options.zoneId;

    // Initialize core systems
    this.zoneServer = new ZoneServer(options);
    this.voxelStore = new VoxelStore(options.voxelChunkSize);

    // Initialize telemetry if enabled
    if (options.enableTelemetry !== false) {
      this.telemetry = new TelemetryCollector();
    }

    // Initialize voxel operation handler
    this.voxelHandler = new VoxelOperationHandler(
      this.zoneServer,
      this.voxelStore,
      this.zoneId,
      this.telemetry
    );

    // Initialize versioning
    this.versioning = new ZoneVersioning();

    // Initialize economy if enabled
    if (options.enableEconomy !== false) {
      this.currencyManager = new CurrencyManager();
      this.currencyManager.registerCurrency('xp'); // Creator XP currency

      if (options.creatorId && this.telemetry) {
        this.creatorEconomy = new CreatorEconomy(
          this.currencyManager,
          options.creatorId,
          this.zoneId,
          this.telemetry
        );
      }
    } else {
      this.currencyManager = new CurrencyManager(); // Still create for potential future use
    }
  }

  /**
   * Start the zone server
   */
  start(): void {
    this.zoneServer.start();
  }

  /**
   * Stop the zone server
   */
  stop(): void {
    this.zoneServer.stop();
  }

  /**
   * Add client to zone
   */
  addClient(clientId: string, permissions?: ClientPermission): void {
    this.zoneServer.addClient(clientId, permissions);
  }

  /**
   * Remove client from zone
   */
  removeClient(clientId: string): void {
    this.zoneServer.removeClient(clientId);
  }

  /**
   * Get voxel operation handler
   */
  getVoxelHandler(): VoxelOperationHandler {
    return this.voxelHandler;
  }

  /**
   * Get versioning manager
   */
  getVersioning(): ZoneVersioning {
    return this.versioning;
  }

  /**
   * Get telemetry collector
   */
  getTelemetry(): TelemetryCollector | undefined {
    return this.telemetry;
  }

  /**
   * Get creator economy
   */
  getCreatorEconomy(): CreatorEconomy | undefined {
    return this.creatorEconomy;
  }

  /**
   * Get zone server
   */
  getZoneServer(): ZoneServer {
    return this.zoneServer;
  }

  /**
   * Get voxel store
   */
  getVoxelStore(): VoxelStore {
    return this.voxelStore;
  }

  /**
   * Create a version snapshot (for publish)
   */
  createVersion(createdBy: string, changelog?: string, isLive = false): ReturnType<ZoneVersioning['createVersion']> {
    return this.versioning.createVersion(this.voxelStore, createdBy, changelog, isLive);
  }

  /**
   * Publish version (make it live)
   */
  publishVersion(versionId: string): void {
    this.versioning.setLiveVersion(versionId);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stop();
    this.voxelHandler.dispose();
    this.versioning.dispose();
    this.voxelStore.dispose();
    this.telemetry?.dispose();
    this.creatorEconomy?.dispose();
    this.currencyManager.dispose();
  }
}
