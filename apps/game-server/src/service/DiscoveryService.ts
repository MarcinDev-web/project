import Redis from 'ioredis';
import type { IDisposable } from '@engine/core';

export interface DiscoveryOptions {
  redisUrl: string;
  publicHost: string;
  publicPort: number;
  region?: string;
  maxCapacity: number;
}

export class DiscoveryService implements IDisposable {
  private readonly redis: Redis;
  private readonly serverId: string;
  private readonly options: DiscoveryOptions;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(options: DiscoveryOptions) {
    this.options = options;
    this.redis = new Redis(options.redisUrl);
    this.serverId = `game-server:${options.publicHost}:${options.publicPort}`;
    
    // Handle redis errors to prevent crash
    this.redis.on('error', (err) => {
      console.error('[DiscoveryService] Redis error:', err);
    });
  }

  async register(): Promise<void> {
    const key = `gameservers:${this.options.region || 'default'}`;
    const serverInfo = {
      id: this.serverId,
      host: this.options.publicHost,
      port: this.options.publicPort,
      capacity: this.options.maxCapacity,
      load: 0,
      lastHeartbeat: Date.now(),
    };

    await this.redis.hset(key, this.serverId, JSON.stringify(serverInfo));
    
    // Set expiration for the key to handle crashes
    // We don't set it on the hash itself but we update the heartbeat
    
    this.startHeartbeat();
    console.log(`[DiscoveryService] Registered server ${this.serverId}`);
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(async () => {
      await this.updateHeartbeat();
    }, 5000); // 5s heartbeat
  }

  async updateLoad(currentPlayers: number): Promise<void> {
    const key = `gameservers:${this.options.region || 'default'}`;
    const infoStr = await this.redis.hget(key, this.serverId);
    
    if (infoStr) {
      const info = JSON.parse(infoStr);
      info.load = currentPlayers;
      info.lastHeartbeat = Date.now();
      await this.redis.hset(key, this.serverId, JSON.stringify(info));
    }
  }

  private async updateHeartbeat(): Promise<void> {
    const key = `gameservers:${this.options.region || 'default'}`;
    const infoStr = await this.redis.hget(key, this.serverId);
    
    if (infoStr) {
      const info = JSON.parse(infoStr);
      info.lastHeartbeat = Date.now();
      await this.redis.hset(key, this.serverId, JSON.stringify(info));
    } else {
      // Re-register if missing
      await this.register();
    }
  }

  async dispose(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const key = `gameservers:${this.options.region || 'default'}`;
    await this.redis.hdel(key, this.serverId);
    await this.redis.quit();
    console.log(`[DiscoveryService] Unregistered server ${this.serverId}`);
  }
}

