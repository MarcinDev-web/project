export const protocolVersion = 1 as const;

export type TransportKind = 'webtransport' | 'webrtc' | 'websocket';

export interface ClientCapabilities {
  transports: TransportKind[];
  partialReliability: boolean;
  unordered: boolean;
}

export interface HandshakeHello {
  kind: 'hello';
  protocolVersion: number;
  capabilities: ClientCapabilities;
  zoneToken: string;
  clientNonce?: string;
  pop?: string;
}

export interface HandshakeAccept {
  kind: 'accept';
  selectedTransport: TransportKind;
  zoneToken?: string;
}

export interface HandshakeReject {
  kind: 'reject';
  reason: string;
}

export type HandshakeMessage = HandshakeHello | HandshakeAccept | HandshakeReject;

export interface InputFrame {
  seq: number;
  ts: number;
  payload: Uint8Array;
}

export interface SnapshotHeader {
  seq: number;
  ackInputSeq: number;
  baselineSeq?: number;
  byteLength: number;
}

export interface SnapshotMessage {
  header: SnapshotHeader;
  payload: Uint8Array;
}

export const Channels = {
  control: 0,
  state: 1,
  chat: 2,
} as const;

export type ChannelId = (typeof Channels)[keyof typeof Channels];

// WebRTC signaling messages
export interface WebRTCOffer {
  type: 'webrtc:offer';
  offer: RTCSessionDescriptionInit;
  clientId?: string;
}

export interface WebRTCAnswer {
  type: 'webrtc:answer';
  answer: RTCSessionDescriptionInit;
  clientId?: string;
}

export interface WebRTCIceCandidate {
  type: 'webrtc:ice';
  candidate: RTCIceCandidateInit;
  clientId?: string;
}

export type WebRTCSignalingMessage = WebRTCOffer | WebRTCAnswer | WebRTCIceCandidate;

// Codecs
export * from './encoding/ControlCodec.js';
export * from './snapshot/SnapshotCodec.js';
export * from './auth/ZoneToken.js';
export * from './auth/PoP.js';

// Bitstream utilities
export * from './bitstream/BitWriter.js';
export * from './bitstream/BitReader.js';
export * from './bitstream/VarInt.js';
