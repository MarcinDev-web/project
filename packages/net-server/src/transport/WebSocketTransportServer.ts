import type { TransportServer, ClientConnection } from './TransportServer.js';
import type { TransportKind } from '@engine/net-protocol';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

export interface WebSocketTransportServerOptions {
  port: number;
  host?: string;
}

export class WebSocketTransportServer implements TransportServer {
  public readonly kind: TransportKind = 'websocket';
  private wss: WebSocketServer | null = null;
  private readonly connections = new Map<string, WebSocket>();

  constructor(private readonly options: WebSocketTransportServerOptions) {}

  async start(): Promise<void> {
    this.wss = new WebSocketServer({
      port: this.options.port,
      host: this.options.host || '0.0.0.0',
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = this.extractClientId(req.url ?? '') || this.generateClientId();
      this.connections.set(clientId, ws);

      console.log(`WebSocket client connected: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        // Messages handled by external handler
        this.onMessage?.(clientId, data);
      });

      ws.on('error', (err: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, err);
      });

      ws.on('close', () => {
        console.log(`WebSocket client disconnected: ${clientId}`);
        this.connections.delete(clientId);
        this.onClose?.(clientId);
      });

      // Send connection confirmation
      ws.send(JSON.stringify({ type: 'connected', clientId }));
    });

    console.log(`WebSocket server listening on ${this.options.host || '0.0.0.0'}:${this.options.port}`);
  }

  async stop(): Promise<void> {
    if (this.wss) {
      // Close all connections
      for (const ws of this.connections.values()) {
        ws.close(1000, 'Server shutdown');
      }
      this.connections.clear();

      // Close server
      this.wss.close();
      this.wss = null;
      console.log('WebSocket server stopped');
    }
  }

  getConnection(clientId: string): ClientConnection | null {
    const ws = this.connections.get(clientId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return null;

    return {
      id: clientId,
      kind: 'websocket',
      send: (bytes: Uint8Array) => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(bytes);
          } catch (err) {
            console.error(`Error sending to client ${clientId}:`, err);
          }
        }
      },
      close: (code?: number, reason?: string) => {
        ws.close(code || 1000, reason);
        this.connections.delete(clientId);
      },
    };
  }

  getAllConnections(): ClientConnection[] {
    const connections: ClientConnection[] = [];
    for (const clientId of this.connections.keys()) {
      const conn = this.getConnection(clientId);
      if (conn) connections.push(conn);
    }
    return connections;
  }

  private extractClientId(url: string): string | null {
    try {
      const urlObj = new URL(url, 'ws://dummy');
      return urlObj.searchParams.get('clientId');
    } catch {
      return null;
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Callbacks for external handlers
  onMessage?: (clientId: string, data: Buffer) => void;
  onClose?: (clientId: string) => void;
}
