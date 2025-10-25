/**
 * Base class for all ECS components.
 */
export class Component {
    _entity = null;
    /** Entity this component is attached to (null if detached). */
    get entity() {
        return this._entity;
    }
    /**
     * Serializes component state into a plain JSON-compatible payload.
     * Subclasses should override when they have custom data to persist.
     */
    toJSON() {
        return {};
    }
    /** Lifecycle hook invoked when component is attached to an entity. */
    onAttach() { }
    /** Lifecycle hook invoked when component is detached from an entity. */
    onDetach() { }
    /** @internal */
    _attach(entity) {
        this._entity = entity;
        this.onAttach();
    }
    /** @internal */
    _detach() {
        this.onDetach();
        this._entity = null;
    }
}
//# sourceMappingURL=Component.js.map