import type { HandshakeHello, HandshakeAccept } from '@engine/net-protocol';
import { verifyZoneToken } from '@engine/net-protocol';
import { chooseTransport } from '../transport/Negotiation.js';

export interface HandshakeContext {
  secret: Uint8Array; // shared HMAC secret for zone tokens
}

export async function handleHandshake(
  hello: HandshakeHello,
  ctx: HandshakeContext
): Promise<HandshakeAccept | null> {
  if (hello.protocolVersion !== 1) return null;
  const token = hello.zoneToken;
  if (!token) return null;
  const payload = await verifyZoneToken(token, ctx.secret);
  if (!payload) return null;
  const selectedTransport = chooseTransport(hello.capabilities);
  return { kind: 'accept', selectedTransport, zoneToken: token };
}
