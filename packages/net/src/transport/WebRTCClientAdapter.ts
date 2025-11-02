import type { ClientTransportAdapter } from './ClientTransportAdapter.js';
import type { WebRTCSignalingMessage, WebRTCAnswer, WebRTCIceCandidate } from '@engine/net-protocol';

export interface SignalingChannel {
  send(message: WebRTCSignalingMessage): void;
  onMessage(handler: (msg: WebRTCSignalingMessage) => void): () => void;
}

export class WebRTCClientAdapter implements ClientTransportAdapter {
  public readonly kind = 'webrtc' as const;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private signalingChannel: SignalingChannel | null = null;
  private clientId: string;
  private openResolve: (() => void) | null = null;
  private openReject: ((err: Error) => void) | null = null;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  get isOpen(): boolean {
    return this.dc !== null && this.dc.readyState === 'open';
  }

  async open(url: string): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC not supported');
    }

    // Create signaling WebSocket first
    const wsUrl = url.replace(/^https?:/, 'wss:');
    const ws = new WebSocket(wsUrl);
    
    // Create peer connection
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Setup signaling
    this.setupSignaling(ws);

    // Create data channel (client initiates)
    this.dc = this.pc.createDataChannel('game', {
      ordered: false, // Allow out-of-order for state channel
      maxRetransmits: 3, // Partial reliability
    });

    this.dc.onopen = () => {
      if (this.openResolve) {
        this.openResolve();
        this.openResolve = null;
      }
    };

    this.dc.onerror = (err) => {
      if (this.openReject) {
        this.openReject(new Error(`DataChannel error: ${err}`));
        this.openReject = null;
      }
    };

    // Create offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    
    // Send offer via signaling
    ws.send(JSON.stringify({
      type: 'webrtc:offer',
      offer: this.pc.localDescription?.toJSON(),
      clientId: this.clientId,
    }));

    // Wait for connection
    return new Promise<void>((resolve, reject) => {
      this.openResolve = resolve;
      this.openReject = reject;
      
      // Timeout after 10s
      setTimeout(() => {
        if (this.openReject) {
          this.openReject(new Error('WebRTC connection timeout'));
          this.openReject = null;
        }
      }, 10000);
    });
  }

  private setupSignaling(ws: WebSocket): void {
    const pc = this.pc;
    if (!pc) return;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WebRTCSignalingMessage;
        
        if (!this.pc) return;

        switch (msg.type) {
          case 'webrtc:answer': {
            const answer = msg as WebRTCAnswer;
            this.pc.setRemoteDescription(new RTCSessionDescription(answer.answer)).catch(console.error);
            break;
          }
          case 'webrtc:ice': {
            const ice = msg as WebRTCIceCandidate;
            if (ice.candidate) {
              this.pc.addIceCandidate(new RTCIceCandidate(ice.candidate)).catch(console.error);
            }
            break;
          }
        }
      } catch (err) {
        console.error('Signaling message error:', err);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate !== null && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'webrtc:ice',
          candidate: event.candidate.toJSON(),
          clientId: this.clientId,
        }));
      }
    };
  }

  send(bytes: Uint8Array): void {
    if (this.dc && this.dc.readyState === 'open') {
      // @ts-expect-error - RTCDataChannel.send accepts ArrayBuffer | Blob | ArrayBufferView
      this.dc.send(bytes);
    }
  }

  close(_code?: number, _reason?: string): void {
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.signalingChannel) {
      this.signalingChannel = null;
    }
  }
}
