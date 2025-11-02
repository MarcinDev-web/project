import type { TransportServer, ClientConnection } from './TransportServer.js';
import type { TransportKind, WebRTCSignalingMessage, WebRTCOffer } from '@engine/net-protocol';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { randomUUID } from 'crypto';

// Import wrtc for Node.js WebRTC support
let RTCPeerConnectionImpl: typeof RTCPeerConnection;
let RTCSessionDescriptionImpl: typeof RTCSessionDescription;
let RTCIceCandidateImpl: typeof RTCIceCandidate;

try {
  // Try to load wrtc package
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wrtc = require('wrtc');
  RTCPeerConnectionImpl = wrtc.RTCPeerConnection;
  RTCSessionDescriptionImpl = wrtc.RTCSessionDescription;
  RTCIceCandidateImpl = wrtc.RTCIceCandidate;
} catch {
  // Fallback to browser globals if available (for testing in browser context)
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
  private readonly defaultIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  constructor(private readonly options: WebRTCTransportServerOptions) {}

  async start(): Promise<void> {
    this.wss = new WebSocketServer({ port: this.options.signalingPort });
    
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = this.extractClientId(req.url ?? '') || randomUUID();
      this.signalingSockets.set(clientId, ws);

      ws.on('message', async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as WebRTCSignalingMessage;
          await this.handleSignaling(clientId, msg);
        } catch (err) {
          console.error('WebRTC signaling error:', err);
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
        console.error('WebSocket error for client', clientId, err);
      });
    });

    console.log(`WebRTC signaling server listening on port ${this.options.signalingPort}`);
  }

  private extractClientId(url: string): string | null {
    const match = url.match(/[?&]clientId=([^&]+)/);
    return match?.[1] ?? null;
  }

  private async handleSignaling(clientId: string, msg: WebRTCSignalingMessage): Promise<void> {
    switch (msg.type) {
      case 'webrtc:offer': {
        await this.handleOffer(clientId, msg as WebRTCOffer);
        break;
      }
      case 'webrtc:ice': {
        const peer = this.peers.get(clientId);
        if (peer && msg.candidate) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidateImpl(msg.candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
        break;
      }
    }
  }

  private async handleOffer(clientId: string, offer: WebRTCOffer): Promise<void> {
    const iceServers = this.options.iceServers || this.defaultIceServers;
    const pc = new RTCPeerConnectionImpl({ iceServers });

    const peerState: PeerState = {
      pc,
      dataChannels: new Map(),
      clientId,
    };

    this.peers.set(clientId, peerState);

    // Handle incoming data channels (client creates them)
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      const channelLabel = dc.label || 'default';
      
      peerState.dataChannels.set(channelLabel, dc);

      dc.onopen = () => {
        console.log(`Data channel "${channelLabel}" opened for client ${clientId}`);
      };

      dc.onerror = (err) => {
        console.error(`Data channel "${channelLabel}" error for client ${clientId}:`, err);
      };

      dc.onclose = () => {
        console.log(`Data channel "${channelLabel}" closed for client ${clientId}`);
        peerState.dataChannels.delete(channelLabel);
      };

      dc.onmessage = (_event: MessageEvent<ArrayBuffer>) => {
        // Messages handled by connection handler
        console.debug(`Data channel "${channelLabel}" message from client ${clientId}`);
      };
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      const ws = this.signalingSockets.get(clientId);
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'webrtc:ice',
          candidate: event.candidate.toJSON(),
          clientId,
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Client ${clientId} connection state: ${pc.connectionState}`);
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
          ws.send(JSON.stringify({
            type: 'webrtc:answer',
            answer: localDesc,
            clientId,
          }));
        }
      }
    } catch (err) {
      console.error('Error handling offer:', err);
      pc.close();
      this.peers.delete(clientId);
    }
  }

  async stop(): Promise<void> {
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
            // RTCDataChannel.send accepts ArrayBufferView (which includes Uint8Array)
            // Create a copy to avoid SharedArrayBuffer issues
            const buffer = new Uint8Array(bytes);
            dc.send(buffer);
          } catch (err) {
            console.error('Error sending on data channel:', err);
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

    // Return first open data channel
    for (const dc of peer.dataChannels.values()) {
      if (dc.readyState === 'open') {
        return this.getConnection(clientId, dc.label);
      }
    }

    return null;
  }
}
