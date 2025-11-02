import type { ClientCapabilities, TransportKind } from '@engine/net-protocol';

export function chooseTransport(cap: ClientCapabilities): TransportKind {
  const order: TransportKind[] = ['webtransport', 'webrtc', 'websocket'];
  for (const kind of order) {
    if (cap.transports.includes(kind)) return kind;
  }
  return 'websocket';
}


