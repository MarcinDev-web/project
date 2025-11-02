export interface UserState {
    id: string;
    lastZoneId?: string;
}
export interface Persistence {
    getUser(id: string): Promise<UserState | null>;
    saveUser(state: UserState): Promise<void>;
}
export declare class InMemoryPersistence implements Persistence {
    private readonly users;
    getUser(id: string): Promise<UserState | null>;
    saveUser(state: UserState): Promise<void>;
}
//# sourceMappingURL=Persistence.d.ts.map