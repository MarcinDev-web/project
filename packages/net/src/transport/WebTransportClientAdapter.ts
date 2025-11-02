import type { ClientTransportAdapter } from './ClientTransportAdapter.js';

/**
 * Feature flag to enable WebTransport (experimental)
 */
export const WEBTRANSPORT_ENABLED = typeof process !== 'undefined' 
  ? process.env.ENABLE_WEBTRANSPORT === 'true'
  : false;

/**
 * Check if WebTransport is available in the environment
 */
export function isWebTransportSupported(): boolean {
  if (!WEBTRANSPORT_ENABLED) return false;
  
  // Check for WebTransport API
  if (typeof globalThis !== 'undefined') {
    return 'WebTransport' in globalThis;
  }
  return false;
}

// Use browser's WebTransport type if available, otherwise define minimal interface
type WebTransportInstance = {
  readonly ready: Promise<void>;
  readonly closed: Promise<void>;
  readonly datagrams: {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
  };
  close(): void;
};

type WebTransportConstructorType = {
  new (url: string | URL, options?: unknown): WebTransportInstance;
} | undefined;

export class WebTransportClientAdapter implements ClientTransportAdapter {
  public readonly kind = 'webtransport' as const;
  private transport: WebTransportInstance | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  get isOpen(): boolean {
    return this.transport !== null;
  }

  async open(url: string): Promise<void> {
    if (!isWebTransportSupported()) {
      throw new Error('WebTransport not supported or disabled (set ENABLE_WEBTRANSPORT=true)');
    }

    // @ts-expect-error - WebTransport is a browser API that may not be in type definitions
    const WebTransportConstructor = globalThis.WebTransport as WebTransportConstructorType;
    
    if (!WebTransportConstructor) {
      throw new Error('WebTransport API not available');
    }

    // Ensure HTTPS/WSS
    const httpsUrl = url.replace(/^http:/, 'https:').replace(/^ws:/, 'https:').replace(/^wss:/, 'https:');
    
    this.transport = new WebTransportConstructor(httpsUrl);
    
    await this.transport.ready;
    
    // Use datagrams for game data (unreliable, unordered)
    this.writer = this.transport.datagrams.writable.getWriter();
  }

  send(bytes: Uint8Array): void {
    if (this.writer) {
      this.writer.write(bytes).catch((err) => {
        console.error('WebTransport send error:', err);
      });
    }
  }

  close(_code?: number, _reason?: string): void {
    if (this.writer) {
      this.writer.close().catch(console.error);
      this.writer = null;
    }
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
  }
}
