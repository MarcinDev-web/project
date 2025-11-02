import type { ClientTransportAdapter } from './ClientTransportAdapter.js';

export class WebSocketClientAdapter implements ClientTransportAdapter {
  public readonly kind = 'websocket' as const;
  private ws: WebSocket | null = null;

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
    });
  }

  send(bytes: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(bytes);
  }

  close(code?: number, reason?: string): void {
    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }
  }
}


