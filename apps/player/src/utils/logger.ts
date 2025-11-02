/**
 * Simple logger for player app
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class LoggerImpl {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[Player] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[Player] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[Player] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error | unknown): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[Player] ${message}`, error);
    }
  }
}

export const Logger = new LoggerImpl();

