import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { randomUUID } from 'crypto';
import {
  createTransportLogger,
  type ClientConnection,
  type TransportLogger,
  type TransportServer,
} from './TransportServer.js';
import type { TransportKind, WebRTCSignalingMessage, WebRTCOffer } from '@engine/net-protocol';

type WrtcModule = {
  RTCPeerConnection: typeof RTCPeerConnection;
  RTCSessionDescription: typeof RTCSessionDescription;
  RTCIceCandidate: typeof RTCIceCandidate;
};

let RTCPeerConnectionImpl: typeof RTCPeerConnection;
let RTCSessionDescriptionImpl: typeof RTCSessionDescription;
let RTCIceCandidateImpl: typeof RTCIceCandidate;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wrtc = require('wrtc') as WrtcModule;
  RTCPeerConnectionImpl = wrtc.RTCPeerConnection;
  RTCSessionDescriptionImpl = wrtc.RTCSessionDescription;
  RTCIceCandidateImpl = wrtc.RTCIceCandidate;
} catch {
  if (typeof RTCPeerConnection !== 'undefined') {
    RTCPeerConnectionImpl = RTCPeerConnection;
    RTCSessionDescriptionImpl = RTCSessionDescription;
    RTCIceCandidateImpl = RTCIceCandidate;
  } else {
    throw new Error(
      'RTCPeerConnection not available. Install "wrtc" package or run in browser context.'
    );
  }
}

export interface WebRTCTransportServerOptions {
  signalingPort: number;
  iceServers?: RTCIceServer[];
  logger?: TransportLogger;
}

interface PeerState {
  pc: RTCPeerConnection;
  dataChannels: Map<string, RTCDataChannel>;
  clientId: string;
}

export class WebRTCTransportServer implements TransportServer {
  public readonly kind: TransportKind = 'webrtc';
  private wss: WebSocketServer | null = null;
  private readonly peers = new Map<string, PeerState>();
  private readonly signalingSockets = new Map<string, WebSocket>();
  private readonly defaultIceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  private readonly logger: ReturnType<typeof createTransportLogger>;

  constructor(private readonly options: WebRTCTransportServerOptions) {
    this.logger = createTransportLogger(options.logger);
  }

  start(): Promise<void> {
    if (this.wss) {
      return Promise.resolve();
    }

    this.wss = new WebSocketServer({ port: this.options.signalingPort });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = this.extractClientId(req.url ?? '') || randomUUID();
      this.signalingSockets.set(clientId, ws);

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as WebRTCSignalingMessage;
          void this.handleSignaling(clientId, msg).catch((err) => {
            this.logger.error('WebRTC signaling error:', err);
          });
        } catch (err) {
          this.logger.error('WebRTC signaling parse error:', err);
        }
      });

      ws.on('close', () => {
        this.signalingSockets.delete(clientId);
        const peer = this.peers.get(clientId);
        if (peer) {
          peer.pc.close();
          for (const dc of peer.dataChannels.values()) {
            dc.close();
          }
          this.peers.delete(clientId);
        }
      });

      ws.on('error', (err: Error) => {
        this.logger.error('WebSocket error for client', clientId, err);
      });
    });

    this.logger.info(`WebRTC signaling server listening on port ${this.options.signalingPort}`);
    return Promise.resolve();
  }

  stop(): Promise<void> {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    for (const peer of this.peers.values()) {
      peer.pc.close();
      for (const dc of peer.dataChannels.values()) {
        dc.close();
      }
    }
    this.peers.clear();
    this.signalingSockets.clear();
    return Promise.resolve();
  }

  getConnection(clientId: string, channelLabel = 'default'): ClientConnection | null {
    const peer = this.peers.get(clientId);
    if (!peer) return null;

    const dc = peer.dataChannels.get(channelLabel);
    if (!dc || dc.readyState !== 'open') return null;

    return {
      id: clientId,
      kind: 'webrtc',
      send: (bytes: Uint8Array) => {
        if (dc.readyState === 'open') {
          try {
            const buffer = new Uint8Array(bytes);
            dc.send(buffer);
          } catch (err) {
            this.logger.error('Error sending on data channel:', err);
          }
        }
      },
      close: () => {
        dc.close();
        peer.dataChannels.delete(channelLabel);
        if (peer.dataChannels.size === 0) {
          peer.pc.close();
          this.peers.delete(clientId);
        }
      },
    };
  }

  getConnectionAnyChannel(clientId: string): ClientConnection | null {
    const peer = this.peers.get(clientId);
    if (!peer) return null;

    for (const dc of peer.dataChannels.values()) {
      if (dc.readyState === 'open') {
        return this.getConnection(clientId, dc.label);
      }
    }

    return null;
  }

  private extractClientId(url: string): string | null {
    const match = url.match(/[?&]clientId=([^&]+)/);
    return match?.[1] ?? null;
  }

  private async handleSignaling(clientId: string, msg: WebRTCSignalingMessage): Promise<void> {
    if (msg.type === 'webrtc:offer') {
      await this.handleOffer(clientId, msg);
      return;
    }

    if (msg.type === 'webrtc:ice') {
      const peer = this.peers.get(clientId);
      if (peer && msg.candidate) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidateImpl(msg.candidate));
        } catch (err) {
          this.logger.error('Error adding ICE candidate:', err);
        }
      }
    }
  }

  private async handleOffer(clientId: string, offer: WebRTCOffer): Promise<void> {
    const iceServers = this.options.iceServers ?? this.defaultIceServers;
    const pc = new RTCPeerConnectionImpl({ iceServers });

    const peerState: PeerState = {
      pc,
      dataChannels: new Map(),
      clientId,
    };

    this.peers.set(clientId, peerState);

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      const channelLabel = dc.label || 'default';

      peerState.dataChannels.set(channelLabel, dc);

      dc.onopen = () => {
        this.logger.debug(`Data channel "${channelLabel}" opened for client ${clientId}`);
      };

      dc.onerror = (err) => {
        this.logger.error(`Data channel "${channelLabel}" error for client ${clientId}:`, err);
      };

      dc.onclose = () => {
        this.logger.debug(`Data channel "${channelLabel}" closed for client ${clientId}`);
        peerState.dataChannels.delete(channelLabel);
      };

      dc.onmessage = () => {
        this.logger.debug(`Data channel "${channelLabel}" message from client ${clientId}`);
      };
    };

    pc.onicecandidate = (event) => {
      const ws = this.signalingSockets.get(clientId);
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        const payload = {
          type: 'webrtc:ice',
          candidate: event.candidate.toJSON(),
          clientId,
        };
        ws.send(JSON.stringify(payload));
      }
    };

    pc.onconnectionstatechange = () => {
      this.logger.debug(`Client ${clientId} connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.peers.delete(clientId);
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescriptionImpl(offer.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const ws = this.signalingSockets.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        const localDesc = pc.localDescription?.toJSON();
        if (localDesc) {
          const payload = {
            type: 'webrtc:answer',
            answer: localDesc,
            clientId,
          };
          ws.send(JSON.stringify(payload));
        }
      }
    } catch (err) {
      this.logger.error('Error handling offer:', err);
      pc.close();
      this.peers.delete(clientId);
    }
  }
}
