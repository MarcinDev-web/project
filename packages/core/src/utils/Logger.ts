/**
 * Simple logger utility.
 * Logger is the centralized console output - console usage is intentional
 */
/* eslint-disable no-console */
export class Logger {
  static info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  static error(message: string, error?: Error): void {
    if (error) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }

  static debug(message: string, ...args: unknown[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
}
/* eslint-enable no-console */
