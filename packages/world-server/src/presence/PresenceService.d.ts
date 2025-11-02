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
export declare class InMemoryPresenceService implements PresenceService {
    private readonly records;
    private readonly locks;
    join(userId: string, zoneId: string): void;
    leave(userId: string, zoneId: string): void;
    heartbeat(userId: string, zoneId: string): void;
    isOnline(userId: string): boolean;
    zonesOf(userId: string): string[];
    lock(key: string, ttlMs: number): boolean;
    unlock(key: string): void;
}
//# sourceMappingURL=PresenceService.d.ts.map