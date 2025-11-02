import type { HandshakeHello } from '@engine/net-protocol';
import { protocolVersion } from '@engine/net-protocol';
import { detectClientCapabilities, type CapabilityFlags } from './capabilities.js';

export function createHandshakeHello(zoneToken: string, flags?: CapabilityFlags): HandshakeHello {
  const capabilities = detectClientCapabilities(flags);
  return {
    kind: 'hello',
    protocolVersion,
    capabilities,
    zoneToken,
  };
}


