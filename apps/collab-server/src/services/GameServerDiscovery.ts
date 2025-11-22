import Redis from 'ioredis';

export interface GameServerInfo {
  id: string;
  host: string;
  port: number;
  capacity: number;
  load: number;
  lastHeartbeat: number;
}

export class GameServerDiscovery {
  private readonly redis: Redis;
  private readonly region: string;

  constructor(redisUrl: string, region: string = 'default') {
    this.redis = new Redis(redisUrl);
    this.region = region;
  }

  async findBestServer(): Promise<GameServerInfo | null> {
    const key = `gameservers:${this.region}`;
    const servers = await this.redis.hgetall(key);
    
    let bestServer: GameServerInfo | null = null;
    let lowestLoadRatio = 1.0;
    const now = Date.now();

    for (const [id, infoStr] of Object.entries(servers)) {
      try {
        const info = JSON.parse(infoStr) as GameServerInfo;
        
        // Filter out dead servers (no heartbeat in 15s)
        if (now - info.lastHeartbeat > 15000) {
          // Optionally cleanup
          continue;
        }

        // Filter out full servers
        if (info.load >= info.capacity) {
          continue;
        }

        const loadRatio = info.load / info.capacity;
        
        if (loadRatio < lowestLoadRatio) {
          lowestLoadRatio = loadRatio;
          bestServer = info;
        }
      } catch (e) {
        console.error(`Failed to parse server info for ${id}`, e);
      }
    }

    return bestServer;
  }

  async dispose() {
    await this.redis.quit();
  }
}

