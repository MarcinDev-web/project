import { b64uEncode, b64uDecode } from './base64url.js';

/**
 * Zone role permissions
 */
export enum ZoneRole {
  /** Zone owner - full control */
  OWNER = 'owner',
  /** Moderator - can kick/ban, edit in staging */
  MODERATOR = 'moderator',
  /** Builder - can edit in staging */
  BUILDER = 'builder',
  /** Guest - read-only, no editing */
  GUEST = 'guest',
}

/**
 * Editing scopes define what operations a user can perform
 */
export enum EditScope {
  /** Can place/remove/paint voxels */
  VOXEL_EDIT = 'voxel:edit',
  /** Can modify entities/components */
  ENTITY_EDIT = 'entity:edit',
  /** Can publish versions */
  PUBLISH = 'publish',
  /** Can manage other users (kick/ban) */
  MODERATE = 'moderate',
  /** Full control (owner only) */
  ADMIN = 'admin',
}

export interface ZoneTokenPayload {
  zoneId: string;
  userId: string;
  exp: number;
  nonce: string;
  /** User's role in this zone */
  role: ZoneRole;
  /** Permitted editing scopes */
  scopes: EditScope[];
}

async function hmacSha256(keyBytes: Uint8Array, dataBytes: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes.buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

export async function signZoneToken(
  payload: ZoneTokenPayload,
  secret: Uint8Array
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();
  const headerB = enc.encode(JSON.stringify(header));
  const payloadB = enc.encode(JSON.stringify(payload));
  const p1 = `${b64uEncode(headerB)}.${b64uEncode(payloadB)}`;
  const sig = await hmacSha256(secret, enc.encode(p1));
  return `${p1}.${b64uEncode(sig)}`;
}

export async function verifyZoneToken(
  token: string,
  secret: Uint8Array
): Promise<ZoneTokenPayload | null> {
  const enc = new TextEncoder();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const hB64 = parts[0]!;
  const pB64 = parts[1]!;
  const sB64 = parts[2]!;
  const p1 = `${hB64}.${pB64}`;
  const expected = await hmacSha256(secret, enc.encode(p1));
  const sig = b64uDecode(sB64);
  if (sig.length !== expected.length) return null;
  for (let i = 0; i < sig.length; i++) if (sig[i] !== expected[i]) return null;
  const payloadJson = new TextDecoder().decode(b64uDecode(pB64));
  const payload = JSON.parse(payloadJson) as ZoneTokenPayload;
  if (Date.now() / 1000 > payload.exp) return null;
  return payload;
}
