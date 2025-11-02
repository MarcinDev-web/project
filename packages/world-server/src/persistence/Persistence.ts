export interface UserState {
  id: string;
  lastZoneId?: string;
}

export interface Persistence {
  getUser(id: string): Promise<UserState | null>;
  saveUser(state: UserState): Promise<void>;
}

export class InMemoryPersistence implements Persistence {
  private readonly users = new Map<string, UserState>();
  async getUser(id: string): Promise<UserState | null> {
    return this.users.get(id) ?? null;
  }
  async saveUser(state: UserState): Promise<void> {
    this.users.set(state.id, state);
  }
}


