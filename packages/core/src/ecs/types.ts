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
 * Component constructors can have any signature
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentClass<T extends Component = Component> = new (...args: any[]) => T;

/**
 * Base interface for systems.
 */
export interface System {
  readonly requiredComponents: ComponentClass[];
  update(dt: number): void;
  fixedUpdate?(dtFixed: number): void;
}

/**
 * Generates a unique entity ID.
 */
let nextEntityId = 0;
export function generateEntityId(): EntityId {
  return `entity_${nextEntityId++}`;
}
