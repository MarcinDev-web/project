import { ZoneServer, ZoneServerOptions } from '@engine/world-server';
import { Scene } from '@engine/world';
import { InputFrame, SnapshotMessage } from '@engine/net-protocol';
import { Disposable } from '@engine/core';
import { GameServerReplicator } from './GameServerReplicator';
// import { HeadlessPhysics } from '@engine/wasm-physics'; // Wasm physics integration

export interface RoomOptions {
  id: string;
  tickRate: number;
}

export class Room implements Disposable {
  public readonly id: string;
  private readonly zoneServer: ZoneServer;
  private readonly scene: Scene;
  private isRunning = false;
  private lastTickTime = 0;
  
  constructor(options: RoomOptions) {
    this.id = options.id;
    
    // Initialize Scene
    this.scene = new Scene();
    
    // Initialize Physics (Placeholder for now as HeadlessPhysics is not exposed)
    // this.physics = new HeadlessPhysics();
    // this.scene.addSystem(this.physics);

    // Initialize ZoneServer (Handles snapshots and replication)
    this.zoneServer = new ZoneServer({
      tickRateHz: options.tickRate,
      scene: this.scene,
      replicator: new GameServerReplicator(this.scene)
    });
    
    // Hook up snapshot callback
    this.zoneServer.onSnapshot = (clientId, snapshot) => {
      this.broadcastSnapshot(clientId, snapshot);
    };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickTime = performance.now();
    
    // Start the simulation loop
    // We use a precise loop or setImmediate in real prod, but setInterval is fine for MVP
    const intervalMs = 1000 / 60; // 60Hz simulation
    this.tickLoop(intervalMs);
    
    this.zoneServer.start();
    console.log(`[Room ${this.id}] Started simulation`);
  }

  private tickLoop(intervalMs: number): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    try {
      // 1. Update ECS (includes physics if added as system)
      // The scene.update() would typically call all systems
      // this.scene.update(dt); 
      
      // 2. ZoneServer handles AoI and Snapshots internally via its own timer
      // But we ensure it has the latest state
    } catch (e) {
      console.error(`[Room ${this.id}] Simulation error:`, e);
    }

    // Schedule next tick
    setTimeout(() => this.tickLoop(intervalMs), intervalMs);
  }

  // Handle client input
  handleInput(clientId: string, frame: InputFrame): void {
    // Inject input into the ECS world for the specific entity controlled by this client
    // This would typically route to a PlayerControllerSystem
    // this.scene.injectInput(clientId, frame);
    console.debug(`[Room ${this.id}] Received input from ${clientId}: seq=${frame.seq}`);
  }

  addClient(clientId: string): void {
    this.zoneServer.addClient(clientId);
    // Spawn player entity in the world
    // const playerEntity = new Entity();
    // playerEntity.addComponent(new PlayerComponent(clientId));
    // this.scene.addEntity(playerEntity);
    console.log(`[Room ${this.id}] Added client ${clientId}`);
  }

  removeClient(clientId: string): void {
    this.zoneServer.removeClient(clientId);
    // this.scene.removeEntity(playerEntityId);
    console.log(`[Room ${this.id}] Removed client ${clientId}`);
  }

  private broadcastSnapshot(clientId: string, snapshot: SnapshotMessage): void {
    // This will be wired up by the RoomManager to send via WebSocket
    this.onSendSnapshot?.(clientId, snapshot);
  }

  // Callback to be assigned by RoomManager
  public onSendSnapshot?: (clientId: string, snapshot: SnapshotMessage) => void;

  dispose(): void {
    this.isRunning = false;
    this.zoneServer.stop();
    // this.scene.dispose();
    console.log(`[Room ${this.id}] Disposed`);
  }
}
