import { pack, unpack } from 'msgpackr';
import type { HandshakeMessage } from '../index.js';

export function encodeControlMessage(msg: HandshakeMessage): Uint8Array {
  return pack(msg);
}

export function decodeControlMessage(bytes: Uint8Array): HandshakeMessage {
  return unpack(bytes) as HandshakeMessage;
}


