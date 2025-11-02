export interface ZoneInfo {
  id: string;
  endpoint: string; // wss://host:port or https://... for negotiation
  capacity: number;
  load: number;
  healthy: boolean;
  region?: string;
}

export class DirectoryService {
  private readonly zones = new Map<string, ZoneInfo>();

  register(zone: ZoneInfo): void {
    this.zones.set(zone.id, zone);
  }

  updateHealth(id: string, healthy: boolean, load?: number): void {
    const z = this.zones.get(id);
    if (!z) return;
    z.healthy = healthy;
    if (typeof load === 'number') z.load = load;
  }

  pickZone(preferredRegion?: string): ZoneInfo | null {
    const list = Array.from(this.zones.values()).filter((z) => z.healthy);
    if (!list.length) return null;
    const filtered = preferredRegion ? list.filter((z) => z.region === preferredRegion) : list;
    const pool = filtered.length ? filtered : list;
    pool.sort((a, b) => a.load / a.capacity - b.load / b.capacity);
    return pool[0] ?? null;
  }

  getZone(id: string): ZoneInfo | null {
    return this.zones.get(id) ?? null;
  }

  listZones(healthyOnly = false): ZoneInfo[] {
    const zones = Array.from(this.zones.values());
    return healthyOnly ? zones.filter((z) => z.healthy) : zones;
  }
}


