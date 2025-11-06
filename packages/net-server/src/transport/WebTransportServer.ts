import {
  createTransportLogger,
  type ClientConnection,
  type TransportLogger,
  type TransportServer,
} from './TransportServer.js';
import type { TransportKind } from '@engine/net-protocol';

// WebTransport requires HTTP/3 (QUIC) which needs special server setup
// Note: Node.js WebTransport server support is still experimental
// This is a placeholder implementation that should be completed with:
// - HTTP/3 server library (e.g., h3, or native Node.js --experimental-http3)
// - WebTransport session handling

export interface WebTransportServerOptions {
  port: number;
  cert: string; // Path to certificate file (PEM format)
  key: string; // Path to private key file (PEM format)
  logger?: TransportLogger;
}

interface WebTransportSession {
  id: string;
  datagramsWritable: WritableStream<Uint8Array>;
  datagramsReadable: ReadableStream<Uint8Array>;
  close(): void;
}

interface HttpServer {
  close(): Promise<void> | void;
}

export class WebTransportServer implements TransportServer {
  public readonly kind: TransportKind = 'webtransport';
  private server: HttpServer | null = null;
  private readonly connections = new Map<string, WebTransportSession>();
  private readonly logger: ReturnType<typeof createTransportLogger>;

  constructor(private readonly options: WebTransportServerOptions) {
    // WebTransport requires HTTPS/WSS with valid certificate
    // Options stored for future implementation when HTTP/3 server is added
    this.logger = createTransportLogger(this.options.logger);
  }

  start(): Promise<void> {
    // WebTransport server implementation placeholder
    // Requires HTTP/3 (QUIC) server implementation
    //
    // Options:
    // 1. Use Node.js --experimental-http3 flag (Node.js 18.3+)
    // 2. Use h3 or other HTTP/3 library
    // 3. Use CDN/proxy service that supports WebTransport
    //
    // Example structure (requires actual HTTP/3 library):
    // - Create HTTP/3 server with TLS
    // - Handle WebTransport upgrade requests
    // - Manage WebTransport sessions with datagrams and streams

    this.logger.warn(
      'WebTransport server is not fully implemented. ' +
        'WebTransport requires HTTP/3 (QUIC) support. ' +
        'Use Node.js --experimental-http3 or an HTTP/3 library.'
    );

    // Placeholder: In real implementation, initialize HTTP/3 server here
    // For now, create a mock server object with close method
    this.server = {
      close: async () => {
        // Placeholder implementation
      },
    };
    return Promise.resolve();
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
    for (const session of this.connections.values()) {
      try {
        session.close();
      } catch (err) {
        this.logger.error('Error closing WebTransport session:', err);
      }
    }
    this.connections.clear();
  }

  getConnection(clientId: string): ClientConnection | null {
    const session = this.connections.get(clientId);
    if (!session) return null;

    return {
      id: clientId,
      kind: 'webtransport',
      send: (bytes: Uint8Array) => {
        const writer = session.datagramsWritable.getWriter();
        void writer
          .write(bytes)
          .catch((err) => {
            this.logger.error('Error sending datagram:', err);
          })
          .finally(() => {
            writer.releaseLock();
          });
      },
      close: () => {
        session.close();
        this.connections.delete(clientId);
      },
    };
  }
}
