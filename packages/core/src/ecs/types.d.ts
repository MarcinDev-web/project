/**
 * ECS Foundation Types
 * Base types for Entity-Component-System architecture
 */
/**
 * Unique identifier for entities.
 */
export type EntityId = string;
/**
 * Base interface for all components.
 */
export interface Component {
    readonly type: string;
}
/**
 * Component class constructor type.
 */
export type ComponentClass<T extends Component = Component> = new (...args: any[]) => T;
/**
 * Base interface for systems.
 */
export interface System {
    readonly requiredComponents: ComponentClass[];
    update(dt: number): void;
    fixedUpdate?(dtFixed: number): void;
}
export declare function generateEntityId(): EntityId;
//# sourceMappingURL=types.d.ts.map