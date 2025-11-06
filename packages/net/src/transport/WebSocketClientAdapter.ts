import type { ClientTransportAdapter } from './ClientTransportAdapter.js';

export class WebSocketClientAdapter implements ClientTransportAdapter {
  public readonly kind = 'websocket' as const;
  private ws: WebSocket | null = null;
  private messageHandler: ((data: Uint8Array) => void) | null = null;

  get isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async open(url: string): Promise<void> {
    const wsUrl = url.startsWith('ws') ? url : url.replace(/^http/, 'ws');
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('WebSocket connection error'));
      
      ws.onmessage = (event) => {
        if (this.messageHandler) {
          // Convert string or ArrayBuffer to Uint8Array
          let data: Uint8Array;
          if (typeof event.data === 'string') {
            data = new TextEncoder().encode(event.data);
          } else if (event.data instanceof ArrayBuffer) {
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
    });
  }

  send(bytes: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // WebSocket can send ArrayBuffer directly
    this.ws.send(bytes.buffer);
  }

  close(code?: number, reason?: string): void {
    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }
    this.messageHandler = null;
  }

  onMessage(handler: (data: Uint8Array) => void): () => void {
    this.messageHandler = handler;
    return () => {
      this.messageHandler = null;
    };
  }
}


