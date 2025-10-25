/**
 * Lightweight event bus for pub/sub messaging.
 * Simplified version without Entity dependencies.
 */
/**
 * Simple pub/sub event bus.
 */
export class EventBus {
    subscribers = new Map();
    /**
     * Subscribe to an event.
     * @param event - Event name
     * @param callback - Handler function
     * @returns Unsubscribe function
     */
    on(event, callback) {
        let set = this.subscribers.get(event);
        if (!set) {
            set = new Set();
            this.subscribers.set(event, set);
        }
        set.add(callback);
        return () => {
            set?.delete(callback);
            if (set && set.size === 0) {
                this.subscribers.delete(event);
            }
        };
    }
    /**
     * Subscribe to an event (fires once then unsubscribes).
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (data) => {
            unsubscribe();
            callback(data);
        });
        return unsubscribe;
    }
    /**
     * Unsubscribe from an event.
     */
    off(event, callback) {
        const set = this.subscribers.get(event);
        if (set) {
            set.delete(callback);
            if (set.size === 0) {
                this.subscribers.delete(event);
            }
        }
    }
    /**
     * Emit an event to all subscribers.
     */
    emit(event, data) {
        const set = this.subscribers.get(event);
        if (!set || set.size === 0)
            return;
        for (const callback of set) {
            try {
                callback(data);
            }
            catch (error) {
                // Ignore handler errors to avoid breaking the bus
                console.error(`Error in event handler for "${event}":`, error);
            }
        }
    }
    /**
     * Remove all subscriptions.
     */
    clear() {
        this.subscribers.clear();
    }
    /**
     * Check if event has subscribers.
     */
    hasSubscribers(event) {
        const set = this.subscribers.get(event);
        return set ? set.size > 0 : false;
    }
}
//# sourceMappingURL=EventBus.js.map