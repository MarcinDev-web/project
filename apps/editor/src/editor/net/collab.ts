import { ReplicationClient } from '@engine/net/ReplicationClient';

const COLLAB_URL = (import.meta as any).env?.VITE_COLLAB_URL || 'http://localhost:4000';

export interface AuthResult {
  user: { id: string; email: string; createdAt: number };
  session: { token: string; expiresAt: number };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${COLLAB_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  return (await res.json()) as AuthResult;
}

export function createReplicationClient(token: string): ReplicationClient {
  const wsUrl = `${COLLAB_URL.replace(/^http/, 'ws')}/ws`;
  return new ReplicationClient(wsUrl, token);
}

export async function createSession(token: string, projectId: string, sessionId?: string): Promise<string> {
  const res = await fetch(`${COLLAB_URL}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, ...(sessionId ? { sessionId } : {}) }),
  });
  if (!res.ok) throw new Error('Create session failed');
  const data = (await res.json()) as { sessionId: string };
  return data.sessionId;
}

export async function saveSnapshot(token: string, projectId: string, sessionId: string, payload: unknown): Promise<string> {
  const res = await fetch(`${COLLAB_URL}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, sessionId, payload }),
  });
  if (!res.ok) throw new Error('Save failed');
  const data = (await res.json()) as { snapshotId: string };
  return data.snapshotId;
}

export async function loadLatestSnapshot(token: string, projectId: string): Promise<unknown | null> {
  const res = await fetch(`${COLLAB_URL}/load?projectId=${encodeURIComponent(projectId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Load failed');
  const data = (await res.json()) as { payload: unknown };
  return data.payload;
}


