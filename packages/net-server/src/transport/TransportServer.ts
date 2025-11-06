import type { TransportKind } from '@engine/net-protocol';

export interface ClientConnection {
  readonly id: string;
  readonly kind: TransportKind;
  send(bytes: Uint8Array): void;
  close(code?: number, reason?: string): void;
}

export interface TransportLogger {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

export function createTransportLogger(
  logger?: TransportLogger
): Required<Pick<TransportLogger, 'debug' | 'info' | 'warn' | 'error'>> {
  return {
    debug: (...args: unknown[]) => {
      logger?.debug?.(...args);
    },
    info: (...args: unknown[]) => {
      logger?.info?.(...args);
    },
    warn: (...args: unknown[]) => {
      if (logger?.warn) {
        logger.warn(...args);
      } else {
        console.warn(...args);
      }
    },
    error: (...args: unknown[]) => {
      if (logger?.error) {
        logger.error(...args);
      } else {
        console.error(...args);
      }
    },
  };
}

export interface TransportServer {
  readonly kind: TransportKind;
  start(): Promise<void>;
  stop(): Promise<void>;
}
