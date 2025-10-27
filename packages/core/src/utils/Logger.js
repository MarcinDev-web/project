/**
 * Simple logger utility.
 */
export class Logger {
    static info(message, ...args) {
        console.log(`[INFO] ${message}`, ...args);
    }
    static warn(message, ...args) {
        console.warn(`[WARN] ${message}`, ...args);
    }
    static error(message, error) {
        if (error) {
            console.error(`[ERROR] ${message}`, error);
        }
        else {
            console.error(`[ERROR] ${message}`);
        }
    }
    static debug(message, ...args) {
        console.debug(`[DEBUG] ${message}`, ...args);
    }
}
//# sourceMappingURL=Logger.js.map