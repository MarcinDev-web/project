import type { ClientTransportAdapter } from './ClientTransportAdapter.js';
import type { WebRTCSignalingMessage, WebRTCAnswer, WebRTCIceCandidate } from '@engine/net-protocol';

export interface SignalingChannel {
  send(message: WebRTCSignalingMessage): void;
  onMessage(handler: (msg: WebRTCSignalingMessage) => void): () => void;
}

export interface WebRTCClientAdapterOptions {
  iceServers?: RTCIceServer[];
}

export class WebRTCClientAdapter implements ClientTransportAdapter {
  public readonly kind = 'webrtc' as const;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private ws: WebSocket | null = null;
  private clientId: string;
  private openResolve: (() => void) | null = null;
  private openReject: ((err: Error) => void) | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly defaultIceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  private readonly iceServers: RTCIceServer[];
  private messageHandler: ((data: Uint8Array) => void) | null = null;

  constructor(clientId: string, options?: WebRTCClientAdapterOptions) {
    this.clientId = clientId;
    this.iceServers = options?.iceServers ?? this.defaultIceServers;
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
    
    // Await WebSocket connection before proceeding (Problem 8)
    const ws = await new Promise<WebSocket>((resolve, reject) => {
      const websocket = new WebSocket(wsUrl);
      this.ws = websocket;
      
      websocket.onopen = () => resolve(websocket);
      websocket.onerror = (err) => {
        reject(new Error(`WebSocket connection error: ${err}`));
      };
      websocket.onclose = () => {
        // Cleanup on unexpected close
        if (this.openReject) {
          this.openReject(new Error('WebSocket closed unexpectedly'));
          this.openReject = null;
        }
        this.ws = null;
      };
    });

    // Create peer connection with configured ICE servers (Problem 12)
    this.pc = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    // Setup signaling
    this.setupSignaling(ws);

    // Create data channel (client initiates)
    this.dc = this.pc.createDataChannel('game', {
      ordered: false, // Allow out-of-order for state channel
      maxRetransmits: 3, // Partial reliability
    });

    // Wait for connection
    return new Promise<void>((resolve, reject) => {
      this.openResolve = resolve;
      this.openReject = reject;
      
      // Timeout after 10s (Problem 2)
      this.connectionTimeout = setTimeout(() => {
        if (this.openReject) {
          this.openReject(new Error('WebRTC connection timeout'));
          this.openReject = null;
          this.cleanup();
        }
      }, 10000);

      this.dc!.onopen = () => {
        // Clear timeout on success (Problem 9)
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        if (this.openResolve) {
          this.openResolve();
          this.openResolve = null;
        }
      };

      // Setup message handler for data channel
      this.dc!.onmessage = (event: MessageEvent) => {
        if (this.messageHandler && event.data) {
          let data: Uint8Array;
          if (event.data instanceof ArrayBuffer) {
            data = new Uint8Array(event.data);
          } else if (event.data instanceof Blob) {
            // Handle Blob asynchronously
            event.data.arrayBuffer().then((buffer) => {
              if (this.messageHandler) {
                this.messageHandler(new Uint8Array(buffer));
              }
            });
            return;
          } else {
            // Fallback: try to convert to string then encode
            data = new TextEncoder().encode(String(event.data));
          }
          this.messageHandler(data);
        }
      };

      this.dc!.onerror = (err) => {
        if (this.openReject) {
          this.openReject(new Error(`DataChannel error: ${err}`));
          this.openReject = null;
          this.cleanup();
        }
      };

      // Create offer and send
      this.pc!.createOffer()
        .then((offer) => this.pc!.setLocalDescription(offer))
        .then(() => {
          // Send offer via signaling (now WebSocket is guaranteed to be open)
          if (ws.readyState === WebSocket.OPEN && this.pc?.localDescription) {
            ws.send(JSON.stringify({
              type: 'webrtc:offer',
              offer: this.pc.localDescription.toJSON(),
              clientId: this.clientId,
            }));
          } else {
            reject(new Error('WebSocket not ready or local description not set'));
          }
        })
        .catch((err) => {
          if (this.openReject) {
            this.openReject(new Error(`Failed to create offer: ${err}`));
            this.openReject = null;
            this.cleanup();
          }
        });
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
            this.pc.setRemoteDescription(new RTCSessionDescription(answer.answer)).catch((err) => {
              // Proper error handling (Problem 15)
              if (this.openReject) {
                this.openReject(new Error(`Failed to set remote description: ${err}`));
                this.openReject = null;
                this.cleanup();
              }
            });
            break;
          }
          case 'webrtc:ice': {
            const ice = msg as WebRTCIceCandidate;
            if (ice.candidate) {
              this.pc.addIceCandidate(new RTCIceCandidate(ice.candidate)).catch((err) => {
                // Proper error handling (Problem 15)
                if (this.openReject) {
                  this.openReject(new Error(`Failed to add ICE candidate: ${err}`));
                  this.openReject = null;
                  this.cleanup();
                }
              });
            }
            break;
          }
        }
      } catch (err) {
        // Proper error handling (Problem 15)
        if (this.openReject) {
          this.openReject(new Error(`Signaling message error: ${err}`));
          this.openReject = null;
          this.cleanup();
        }
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

    // Add ICE connection state change handler (Problem 11)
    pc.oniceconnectionstatechange = () => {
      if (!pc) return;
      
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        if (this.openReject) {
          this.openReject(new Error(`ICE connection failed: ${pc.iceConnectionState}`));
          this.openReject = null;
          this.cleanup();
        }
      }
    };
  }

  private cleanup(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(bytes: Uint8Array): void {
    if (this.dc && this.dc.readyState === 'open') {
      // @ts-expect-error - RTCDataChannel.send accepts ArrayBuffer | Blob | ArrayBufferView
      this.dc.send(bytes);
    }
  }

  close(_code?: number, _reason?: string): void {
    this.cleanup();
  }

  onMessage(handler: (data: Uint8Array) => void): () => void {
    this.messageHandler = handler;
    return () => {
      this.messageHandler = null;
    };
  }
}
