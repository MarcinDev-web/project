/**
 * Bit flags utility for efficient flag management.
 */

export class BitFlags {
  private _value: number;

  constructor(initial = 0) {
    this._value = initial;
  }

  /**
   * Set a flag bit.
   */
  set(flag: number): void {
    this._value |= flag;
  }

  /**
   * Unset a flag bit.
   */
  unset(flag: number): void {
    this._value &= ~flag;
  }

  /**
   * Toggle a flag bit.
   */
  toggle(flag: number): void {
    this._value ^= flag;
  }

  /**
   * Check if a flag bit is set.
   */
  has(flag: number): boolean {
    return (this._value & flag) === flag;
  }

  /**
   * Get the current value.
   */
  value(): number {
    return this._value;
  }

  /**
   * Set the value directly.
   */
  setValue(value: number): void {
    this._value = value;
  }

  /**
   * Clear all flags.
   */
  clear(): void {
    this._value = 0;
  }
}

