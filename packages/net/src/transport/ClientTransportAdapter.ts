import type { TransportKind } from '@engine/net-protocol';

export interface ClientTransportAdapter {
  readonly kind: TransportKind;
  open(url: string): Promise<void>;
  send(bytes: Uint8Array): void;
  close(code?: number, reason?: string): void;
  readonly isOpen: boolean;
}


