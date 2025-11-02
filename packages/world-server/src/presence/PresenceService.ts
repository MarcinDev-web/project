export interface PresenceRecord {
  userId: string;
  zoneId: string;
  lastSeen: number;
}

export interface PresenceService {
  join(userId: string, zoneId: string): void;
  leave(userId: string, zoneId: string): void;
  heartbeat(userId: string, zoneId: string): void;
  isOnline(userId: string): boolean;
  zonesOf(userId: string): string[];
  lock(key: string, ttlMs: number): boolean;
  unlock(key: string): void;
}

export class InMemoryPresenceService implements PresenceService {
  private readonly records = new Map<string, PresenceRecord>();
  private readonly locks = new Map<string, number>();

  join(userId: string, zoneId: string): void {
    const key = `${userId}@${zoneId}`;
    this.records.set(key, { userId, zoneId, lastSeen: Date.now() });
  }
  leave(userId: string, zoneId: string): void {
    const key = `${userId}@${zoneId}`;
    this.records.delete(key);
  }
  heartbeat(userId: string, zoneId: string): void {
    const key = `${userId}@${zoneId}`;
    const r = this.records.get(key); if (r) r.lastSeen = Date.now();
  }
  isOnline(userId: string): boolean {
    for (const r of this.records.values()) if (r.userId === userId) return true;
    return false;
  }
  zonesOf(userId: string): string[] {
    const out: string[] = [];
    for (const r of this.records.values()) if (r.userId === userId) out.push(r.zoneId);
    return out;
  }
  lock(key: string, ttlMs: number): boolean {
    const now = Date.now();
    const expires = this.locks.get(key) ?? 0;
    if (expires > now) return false;
    this.locks.set(key, now + ttlMs);
    return true;
  }
  unlock(key: string): void { this.locks.delete(key); }
}


