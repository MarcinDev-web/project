import type { ClientCapabilities, TransportKind } from '@engine/net-protocol';

export interface CapabilityFlags {
  webTransport?: boolean;
  webRTC?: boolean;
  webSocket?: boolean;
}

export function detectClientCapabilities(flags: CapabilityFlags = {}): ClientCapabilities {
  const transports: TransportKind[] = [];
  const hasWT = typeof (globalThis as any).WebTransport !== 'undefined' && flags.webTransport !== false;
  const hasRTC = typeof (globalThis as any).RTCPeerConnection !== 'undefined' && flags.webRTC !== false;
  const hasWS = typeof (globalThis as any).WebSocket !== 'undefined' && flags.webSocket !== false;

  if (hasWT) transports.push('webtransport');
  if (hasRTC) transports.push('webrtc');
  if (hasWS) transports.push('websocket');

  return {
    transports,
    partialReliability: hasRTC || hasWT,
    unordered: hasRTC || hasWT,
  };
}


