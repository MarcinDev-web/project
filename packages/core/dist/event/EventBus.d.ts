/**
 * Lightweight event bus for pub/sub messaging.
 * Simplified version without Entity dependencies.
 */
export type EventCallback<T = unknown> = (data?: T) => void;
export type Unsubscribe = () => void;
/**
 * Simple pub/sub event bus.
 */
export declare class EventBus {
    private readonly subscribers;
    /**
     * Subscribe to an event.
     * @param event - Event name
     * @param callback - Handler function
     * @returns Unsubscribe function
     */
    on<T = unknown>(event: string, callback: EventCallback<T>): Unsubscribe;
    /**
     * Subscribe to an event (fires once then unsubscribes).
     */
    once<T = unknown>(event: string, callback: EventCallback<T>): Unsubscribe;
    /**
     * Unsubscribe from an event.
     */
    off<T = unknown>(event: string, callback: EventCallback<T>): void;
    /**
     * Emit an event to all subscribers.
     */
    emit(event: string, data?: unknown): void;
    /**
     * Remove all subscriptions.
     */
    clear(): void;
    /**
     * Check if event has subscribers.
     */
    hasSubscribers(event: string): boolean;
    /**
     * Alias for emit (compatibility with old EventBus API).
     */
    publish(event: {
        type: string;
        payload?: unknown;
        sender?: unknown;
        target?: unknown;
    }): void;
}
//# sourceMappingURL=EventBus.d.ts.map