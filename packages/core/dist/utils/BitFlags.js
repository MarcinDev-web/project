/**
 * Bit flags utility for efficient flag management.
 */
export class BitFlags {
    _value;
    constructor(initial = 0) {
        this._value = initial;
    }
    /**
     * Set a flag bit.
     */
    set(flag) {
        this._value |= flag;
    }
    /**
     * Unset a flag bit.
     */
    unset(flag) {
        this._value &= ~flag;
    }
    /**
     * Toggle a flag bit.
     */
    toggle(flag) {
        this._value ^= flag;
    }
    /**
     * Check if a flag bit is set.
     */
    has(flag) {
        return (this._value & flag) === flag;
    }
    /**
     * Get the current value.
     */
    value() {
        return this._value;
    }
    /**
     * Set the value directly.
     */
    setValue(value) {
        this._value = value;
    }
    /**
     * Clear all flags.
     */
    clear() {
        this._value = 0;
    }
}
//# sourceMappingURL=BitFlags.js.map