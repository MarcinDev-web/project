export class Logger {
  static info(message: string, ...args: unknown[]): void {
    try {
      if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log(`[Editor] ${message}`, ...args);
      }
    } catch {}
  }
  static debug(message: string, ...args: unknown[]): void {
    try {
      if (typeof console !== 'undefined' && typeof console.debug === 'function') {
        console.debug(`[Editor] ${message}`, ...args);
      } else if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log(`[Editor] ${message}`, ...args);
      }
    } catch {}
  }

  static warn(message: string, ...args: unknown[]): void {
    try {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[Editor] ${message}`, ...args);
      }
    } catch {}
  }

  static error(message: string, error?: unknown): void {
    let err: Error | undefined;
    if (error instanceof Error) {
      err = error;
    } else if (error !== undefined) {
      try {
        err = new Error(String(error));
      } catch {
        err = undefined;
      }
    }
    try {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        if (err) {
          console.error(`[Editor] ${message}`, err);
        } else {
          console.error(`[Editor] ${message}`);
        }
      }
    } catch {}
  }
}

// Backward-compatible object API
export const logger = {
  info: Logger.info.bind(Logger),
  debug: Logger.debug.bind(Logger),
  warn: Logger.warn.bind(Logger),
  error: (message: string, ...args: unknown[]) => Logger.error(message, args[0]),
};
