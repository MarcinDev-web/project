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

let RTCPeerConnectionImpl: typeof RTCPeerConnection | undefined;
let RTCSessionDescriptionImpl: typeof RTCSessionDescription | undefined;
let RTCIceCandidateImpl: typeof RTCIceCandidate | undefined;

function loadWebRTCImplementations(): void {
  if (RTCPeerConnectionImpl) {
    return; // Already loaded
  }

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
}

export interface WebRTCTransportServerOptions {
  signalingPort: number;
  iceServers?: RTCIceServer[];
  logger?: TransportLogger;
  onDataChannelMessage?: (
    clientId: string,
    channelLabel: string,
    data: ArrayBuffer
  ) => void;
  onConnectionClosed?: (clientId: string) => void;
}

interface PeerState {
  pc: RTCPeerConnection;
  dataChannels: Map<string, RTCDataChannel>;
  clientId: string;
  connectionTimeout: ReturnType<typeof setTimeout> | null;
}

export class WebRTCTransportServer implements TransportServer {
  public readonly kind: TransportKind = 'webrtc';
  private wss: WebSocketServer | null = null;
  private readonly peers = new Map<string, PeerState>();
  private readonly signalingSockets = new Map<string, WebSocket>();
  private readonly defaultIceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  private readonly logger: ReturnType<typeof createTransportLogger>;
  private readonly onDataChannelMessage: ((
    clientId: string,
    channelLabel: string,
    data: ArrayBuffer
  ) => void) | undefined;
  private readonly onConnectionClosed: ((clientId: string) => void) | undefined;

  constructor(private readonly options: WebRTCTransportServerOptions) {
    loadWebRTCImplementations();
    this.logger = createTransportLogger(options.logger);
    this.onDataChannelMessage = options.onDataChannelMessage ?? undefined;
    this.onConnectionClosed = options.onConnectionClosed ?? undefined;
  }

  start(): Promise<void> {
    if (this.wss) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.options.signalingPort });

        // Handle server errors (Problem 1)
        this.wss.on('error', (err: Error) => {
          this.logger.error('WebSocketServer error:', err);
          reject(err);
        });

        this.wss.on('listening', () => {
          this.logger.info(`WebRTC signaling server listening on port ${this.options.signalingPort}`);
          resolve();
        });

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
          this.cleanupPeer(clientId, peer);
        }
      });

      ws.on('error', (err: Error) => {
        this.logger.error('WebSocket error for client', clientId, err);
      });
      });
    } catch (err) {
      reject(err as Error);
    }
    });
  }

  stop(): Promise<void> {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    for (const [clientId, peer] of this.peers.entries()) {
      this.cleanupPeer(clientId, peer);
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
          await peer.pc.addIceCandidate(new (RTCIceCandidateImpl!)(msg.candidate));
        } catch (err) {
          this.logger.error('Error adding ICE candidate:', err);
        }
      }
    }
  }

  private async handleOffer(clientId: string, offer: WebRTCOffer): Promise<void> {
    // Validate offer (Problem 5)
    if (!offer.offer || !offer.offer.type || offer.offer.type !== 'offer') {
      this.logger.error(`Invalid offer from client ${clientId}`);
      return;
    }

    // Close existing peer connection if present (Problem 6)
    const existingPeer = this.peers.get(clientId);
    if (existingPeer) {
      this.logger.debug(`Closing existing peer connection for client ${clientId}`);
      this.cleanupPeer(clientId, existingPeer);
    }

    const iceServers = this.options.iceServers ?? this.defaultIceServers;
    const pc = new (RTCPeerConnectionImpl!)({ iceServers });

    // Setup timeout for peer connection (Problem 2)
    const connectionTimeout = setTimeout(() => {
      const peer = this.peers.get(clientId);
      if (peer && peer.pc === pc) {
        this.logger.error(`Peer connection timeout for client ${clientId}`);
        this.cleanupPeer(clientId, peer);
      }
    }, 30000);

    const peerState: PeerState = {
      pc,
      dataChannels: new Map(),
      clientId,
      connectionTimeout,
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

      dc.onmessage = (event: MessageEvent) => {
        this.logger.debug(`Data channel "${channelLabel}" message from client ${clientId}`);
        // Pass data to callback (Problem 4)
        if (this.onDataChannelMessage && event.data) {
          try {
            const data = event.data instanceof ArrayBuffer
              ? event.data
              : event.data instanceof Blob
              ? event.data.arrayBuffer()
              : new TextEncoder().encode(String(event.data)).buffer;
            
            // Use setTimeout to avoid blocking
            Promise.resolve(data).then((buffer) => {
              this.onDataChannelMessage!(clientId, channelLabel, buffer);
            }).catch((err) => {
              this.logger.error(`Error processing data channel message: ${err}`);
            });
          } catch (err) {
            this.logger.error(`Error handling data channel message: ${err}`);
          }
        }
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
        const peer = this.peers.get(clientId);
        if (peer) {
          this.cleanupPeer(clientId, peer);
        }
      }
    };

    // Add ICE connection state change handler (Problem 3)
    pc.oniceconnectionstatechange = () => {
      this.logger.debug(`Client ${clientId} ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        const peer = this.peers.get(clientId);
        if (peer) {
          this.logger.warn(`ICE connection failed for client ${clientId}: ${pc.iceConnectionState}`);
          this.cleanupPeer(clientId, peer);
        }
      }
    };

    try {
      await pc.setRemoteDescription(new (RTCSessionDescriptionImpl!)(offer.offer));
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
      const peer = this.peers.get(clientId);
      if (peer) {
        this.cleanupPeer(clientId, peer);
      }
      // Cleanup signaling socket on error (Problem 7)
      const ws = this.signalingSockets.get(clientId);
      if (ws) {
        ws.close();
        this.signalingSockets.delete(clientId);
      }
    }
  }

  private cleanupPeer(clientId: string, peer: PeerState): void {
    // Clear timeout
    if (peer.connectionTimeout) {
      clearTimeout(peer.connectionTimeout);
    }
    
    // Close peer connection
    peer.pc.close();
    
    // Close all data channels
    for (const dc of peer.dataChannels.values()) {
      dc.close();
    }
    
    // Remove from peers map
    this.peers.delete(clientId);
    
    // Notify about connection closure
    if (this.onConnectionClosed) {
      this.onConnectionClosed(clientId);
    }
  }
}
