import type { BehaviorConstructor } from '../behavior/Behavior';
/**
 * Global behavior registry to allow deserialization and hot-reload.
 * Register behavior classes by a unique name.
 */
export declare class BehaviorRegistry {
    private static behaviors;
    private static version;
    static register(name: string, ctor: BehaviorConstructor): void;
    static get(name: string): BehaviorConstructor | undefined;
    static has(name: string): boolean;
    /**
     * Hot-re-register a behavior. Existing instances can be notified to migrate.
     */
    static hotRegister(name: string, ctor: BehaviorConstructor): void;
    static list(): string[];
    static getVersion(): number;
}
//# sourceMappingURL=BehaviorRegistry.d.ts.map