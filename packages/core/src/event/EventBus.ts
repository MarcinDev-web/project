/**
 * Lightweight event bus for pub/sub messaging.
 * Simplified version without Entity dependencies.
 */

export type EventCallback<T = unknown> = (data?: T) => void;
export type Unsubscribe = () => void;

/**
 * Simple pub/sub event bus.
 */
export class EventBus {
  private readonly subscribers = new Map<string, Set<EventCallback>>();

  /**
   * Subscribe to an event.
   * @param event - Event name
   * @param callback - Handler function
   * @returns Unsubscribe function
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): Unsubscribe {
    let set = this.subscribers.get(event);
    if (!set) {
      set = new Set<EventCallback>();
      this.subscribers.set(event, set);
    }
    set.add(callback as EventCallback);
    
    return () => {
      set?.delete(callback as EventCallback);
      if (set && set.size === 0) {
        this.subscribers.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event (fires once then unsubscribes).
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): Unsubscribe {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      callback(data as T);
    });
    return unsubscribe;
  }

  /**
   * Unsubscribe from an event.
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const set = this.subscribers.get(event);
    if (set) {
      set.delete(callback as EventCallback);
      if (set.size === 0) {
        this.subscribers.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers.
   */
  emit(event: string, data?: unknown): void {
    const set = this.subscribers.get(event);
    if (!set || set.size === 0) return;
    
    for (const callback of set) {
      try {
        callback(data);
      } catch (error) {
        // Ignore handler errors to avoid breaking the bus
        console.error(`Error in event handler for "${event}":`, error);
      }
    }
  }

  /**
   * Remove all subscriptions.
   */
  clear(): void {
    this.subscribers.clear();
  }

  /**
   * Check if event has subscribers.
   */
  hasSubscribers(event: string): boolean {
    const set = this.subscribers.get(event);
    return set ? set.size > 0 : false;
  }

  /**
   * Alias for emit (compatibility with old EventBus API).
   */
  publish(event: { type: string; payload?: unknown; sender?: unknown; target?: unknown }): void {
    this.emit(event.type, event);
  }
}

