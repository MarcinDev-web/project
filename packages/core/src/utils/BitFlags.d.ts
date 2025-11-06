/**
 * Bit flags utility for efficient flag management.
 */
export declare class BitFlags {
    private _value;
    constructor(initial?: number);
    /**
     * Set a flag bit.
     */
    set(flag: number): void;
    /**
     * Unset a flag bit.
     */
    unset(flag: number): void;
    /**
     * Toggle a flag bit.
     */
    toggle(flag: number): void;
    /**
     * Check if a flag bit is set.
     */
    has(flag: number): boolean;
    /**
     * Get the current value.
     */
    value(): number;
    /**
     * Set the value directly.
     */
    setValue(value: number): void;
    /**
     * Clear all flags.
     */
    clear(): void;
}
//# sourceMappingURL=BitFlags.d.ts.map