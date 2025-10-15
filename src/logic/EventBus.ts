import type { Entity, EntityId } from '../scene/Entity';

export interface ScriptEvent<T = unknown> {
  /** Event type identifier */
  type: string;
  /** Event payload */
  payload?: T;
  /** Optional sender entity */
  sender?: Entity | null;
  /** Optional target entity (for directed messages) */
  target?: Entity | EntityId | null;
}

type EventHandler = (event: ScriptEvent) => void;

interface Subscription {
  handler: EventHandler;
  /** Optional filter by entity id */
  entityId?: EntityId | null;
}

/**
 * Lightweight scene-wide message bus for entity scripts.
 * Subscriptions are per event type with optional entity filter.
 */
export class EventBus {
  private readonly subscribers = new Map<string, Set<Subscription>>();
  

  /** Removes all subscriptions. */
  clear(): void {
    this.subscribers.clear();
  }

  /**
   * Subscribes to events of a given type. Returns an unsubscribe function.
   */
  subscribe(type: string, handler: EventHandler, options?: { entityId?: EntityId | null }): () => void {
    const sub: Subscription = { handler, entityId: options?.entityId ?? null };
    let set = this.subscribers.get(type);
    if (!set) {
      set = new Set<Subscription>();
      this.subscribers.set(type, set);
    }
    set.add(sub);
    return () => {
      set?.delete(sub);
      if (set && set.size === 0) this.subscribers.delete(type);
    };
  }

  /** Publishes an event to all matching subscribers. */
  publish(event: ScriptEvent): void {
    const set = this.subscribers.get(event.type);
    if (!set || set.size === 0) return;
    const targetId = this.resolveTargetId(event.target);
    for (const sub of set) {
      if (targetId && sub.entityId && sub.entityId !== targetId) continue;
      try {
        sub.handler(event);
      } catch {
        // Ignore handler errors to avoid breaking the bus
      }
    }
  }

  /** Convenience: publish a directed event to a specific entity. */
  publishTo(target: Entity | EntityId, type: string, payload?: unknown, sender?: Entity | null): void {
    const event: ScriptEvent = {
      type,
      target,
      ...(payload !== undefined ? { payload } : {}),
      ...(sender !== undefined ? { sender } : {}),
    };
    this.publish(event);
  }

  private resolveTargetId(target: ScriptEvent['target']): EntityId | null {
    if (!target) return null;
    if (typeof target === 'string') return target;
    const entity = target as Entity;
    return entity?.id ?? null;
  }
}


