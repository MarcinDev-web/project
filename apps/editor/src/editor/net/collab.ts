import { ReplicationClient } from '@engine/net/ReplicationClient';

// Interfaces based on server contracts
export interface User {
  id: string;
  email: string;
  createdAt: number;
}

export interface Session {
  token: string;
  expiresAt: number;
}

export interface AuthResponse {
  user: User;
  session: Session;
}

export interface CreateSessionResponse {
  sessionId: string;
}

export interface SaveSnapshotResponse {
  snapshotId: string;
}

export interface LoadSnapshotResponse {
  payload: unknown;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export class CollabClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    // Default to env var or localhost
    // We avoid 'as any' casting by assuming standard Vite env types or checking existence
    this.baseUrl = baseUrl || (import.meta.env?.VITE_COLLAB_URL || 'http://localhost:4000');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });
    
    if (!res.ok) {
      let errorMessage = 'Request failed';
      try {
        const errorData = await res.json();
        if (errorData && typeof errorData === 'object' && 'error' in errorData) {
          errorMessage = errorData.error;
        }
      } catch {
        // Ignore JSON parse error, use status text
        errorMessage = res.statusText || errorMessage;
      }
      throw new ApiError(errorMessage, res.status);
    }

    return res.json() as Promise<T>;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  createReplicationClient(token: string): ReplicationClient {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws';
    return new ReplicationClient(wsUrl, token);
  }

  async createSession(token: string, projectId: string, sessionId?: string): Promise<string> {
    const res = await this.request<CreateSessionResponse>('/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, ...(sessionId ? { sessionId } : {}) }),
    });
    return res.sessionId;
  }

  async saveSnapshot(token: string, projectId: string, sessionId: string, payload: unknown): Promise<string> {
    const res = await this.request<SaveSnapshotResponse>('/save', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, sessionId, payload }),
    });
    return res.snapshotId;
  }

  async loadLatestSnapshot(token: string, projectId: string): Promise<unknown | null> {
    try {
      const res = await this.request<LoadSnapshotResponse>(`/load?projectId=${encodeURIComponent(projectId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.payload;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }
}
