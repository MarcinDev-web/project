export class AnimatorController {
    states = new Map();
    transitions = [];
    _defaultState = null;
    addState(name, clip, speed = 1) {
        if (this.states.has(name))
            throw new Error(`State '${name}' already exists`);
        this.states.set(name, { name, clip, speed });
        if (!this._defaultState)
            this._defaultState = name;
        return this;
    }
    addTransition(t) {
        if (!this.states.has(t.from) || !this.states.has(t.to)) {
            throw new Error(`Transition from '${t.from}' to '${t.to}' requires existing states`);
        }
        if (!(t.duration >= 0))
            throw new RangeError('Transition duration must be >= 0');
        this.transitions.push({ ...t });
        return this;
    }
    get defaultState() {
        if (!this._defaultState)
            throw new Error('No default state configured');
        return this._defaultState;
    }
    setDefaultState(name) {
        if (!this.states.has(name))
            throw new Error(`Unknown state '${name}'`);
        this._defaultState = name;
        return this;
    }
    getState(name) {
        const s = this.states.get(name);
        if (!s)
            throw new Error(`Unknown state '${name}'`);
        return s;
    }
    getTransitionsFrom(name) {
        return this.transitions.filter(t => t.from === name);
    }
}
//# sourceMappingURL=AnimatorController.js.map