import type { Entity } from '../core/Entity.js';

export type ComponentJSON = unknown;

export interface ComponentClass<T extends Component = Component> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
  /** Unique string identifier for the component type. */
  readonly type?: string;
  /** Runtime class name (constructor name). */
  readonly name: string;
  /** Optional factory that restores a component instance from serialized data. */
  fromJSON?(data: ComponentJSON): T;
}

/**
 * Base class for all ECS components.
 */
export abstract class Component {
  private _entity: Entity | null = null;

  /** Entity this component is attached to (null if detached). */
  get entity(): Entity | null {
    return this._entity;
  }

  /** Unique string identifier for this component instance. */
  abstract getType(): string;

  /**
   * Serializes component state into a plain JSON-compatible payload.
   * Subclasses should override when they have custom data to persist.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  toJSON(): ComponentJSON | null {
    return {};
  }

  /** Creates a deep clone of this component. */
  abstract clone(): Component;

  /** Lifecycle hook invoked when component is attached to an entity. */

  protected onAttach(): void {}

  /** Lifecycle hook invoked when component is detached from an entity. */

  protected onDetach(): void {}

  /** @internal */
  _attach(entity: Entity): void {
    this._entity = entity;
    this.onAttach();
  }

  /** @internal */
  _detach(): void {
    this.onDetach();
    this._entity = null;
  }
}
