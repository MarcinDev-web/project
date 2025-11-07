/**
 * Simple logger utility.
 * Logger is the centralized console output - console usage is intentional
 */
export declare class Logger {
    static info(message: string, ...args: unknown[]): void;
    static warn(message: string, ...args: unknown[]): void;
    static error(message: string, error?: Error): void;
    static debug(message: string, ...args: unknown[]): void;
}
