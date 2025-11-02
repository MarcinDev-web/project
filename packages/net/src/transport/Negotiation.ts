import type { ClientCapabilities, TransportKind } from '@engine/net-protocol';

export function preferredOrder(): TransportKind[] {
  return ['webtransport', 'webrtc', 'websocket'];
}

export function chooseFromCapabilities(cap: ClientCapabilities): TransportKind {
  for (const kind of preferredOrder()) {
    if (cap.transports.includes(kind)) return kind;
  }
  return 'websocket';
}


