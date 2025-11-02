export declare const protocolVersion: 1;
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
export declare const Channels: {
    readonly control: 0;
    readonly state: 1;
    readonly chat: 2;
};
export type ChannelId = typeof Channels[keyof typeof Channels];
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
export * from './encoding/ControlCodec.js';
export * from './snapshot/SnapshotCodec.js';
export * from './auth/ZoneToken.js';
export * from './auth/PoP.js';
export * from './bitstream/BitWriter.js';
export * from './bitstream/BitReader.js';
export * from './bitstream/VarInt.js';
//# sourceMappingURL=index.d.ts.map