import { b64uEncode } from './base64url.js';

async function hmacSha256(keyBytes: Uint8Array, dataBytes: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes.buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

export async function createProofOfPossession(token: string, clientNonce: string, secret: Uint8Array): Promise<string> {
  // Note: Placeholder PoP using HMAC(token || nonce). Replace with ephemeral keys later.
  const enc = new TextEncoder();
  const data = enc.encode(`${token}.${clientNonce}`);
  const sig = await hmacSha256(secret, data);
  return b64uEncode(sig);
}


