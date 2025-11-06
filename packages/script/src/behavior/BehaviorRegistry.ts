import type { BehaviorConstructor } from '../behavior/Behavior.js';

/**
 * Global behavior registry to allow deserialization and hot-reload.
 * Register behavior classes by a unique name.
 */
export class BehaviorRegistry {
  private static behaviors = new Map<string, BehaviorConstructor>();
  private static version = 0;

  static register(name: string, ctor: BehaviorConstructor): void {
    const prev = BehaviorRegistry.behaviors.get(name);
    if (prev === ctor) return; // no-op for duplicate registration
    BehaviorRegistry.behaviors.set(name, ctor);
    BehaviorRegistry.version++;
  }

  static get(name: string): BehaviorConstructor | undefined {
    return BehaviorRegistry.behaviors.get(name);
  }

  static has(name: string): boolean {
    return BehaviorRegistry.behaviors.has(name);
  }

  /**
   * Hot-re-register a behavior. Existing instances can be notified to migrate.
   */
  static hotRegister(name: string, ctor: BehaviorConstructor): void {
    const prev = BehaviorRegistry.behaviors.get(name);
    if (prev === ctor) return; // avoid unnecessary rebuild on identical ctor
    BehaviorRegistry.behaviors.set(name, ctor);
    BehaviorRegistry.version++;
  }

  static list(): string[] {
    return Array.from(BehaviorRegistry.behaviors.keys());
  }

  static getVersion(): number {
    return BehaviorRegistry.version;
  }
}
