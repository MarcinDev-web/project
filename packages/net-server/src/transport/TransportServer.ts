import type { TransportKind } from '@engine/net-protocol';

export interface ClientConnection {
  readonly id: string;
  readonly kind: TransportKind;
  send(bytes: Uint8Array): void;
  close(code?: number, reason?: string): void;
}

export interface TransportServer {
  readonly kind: TransportKind;
  start(): Promise<void>;
  stop(): Promise<void>;
}


