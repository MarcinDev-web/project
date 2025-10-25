/**
 * VariableStorage - Scene-wide storage for logic cube variables.
 * Supports string, number, and boolean types.
 */

export type VariableValue = string | number | boolean;

export interface VariableData {
  name: string;
  value: VariableValue;
  type: 'string' | 'number' | 'boolean';
}

/**
 * Manages variables for logic cubes within a scene.
 */
export class VariableStorage {
  private variables = new Map<string, VariableValue>();

  /**
   * Sets a variable value
   */
  set(name: string, value: VariableValue): void {
    this.variables.set(name, value);
  }

  /**
   * Gets a variable value
   */
  get(name: string): VariableValue | undefined {
    return this.variables.get(name);
  }

  /**
   * Gets a variable with a default value if not found
   */
  getOrDefault(name: string, defaultValue: VariableValue): VariableValue {
    const value = this.variables.get(name);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Checks if a variable exists
   */
  has(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Deletes a variable
   */
  delete(name: string): boolean {
    return this.variables.delete(name);
  }

  /**
   * Clears all variables
   */
  clear(): void {
    this.variables.clear();
  }

  /**
   * Gets all variable names
   */
  getVariableNames(): string[] {
    return Array.from(this.variables.keys());
  }

  /**
   * Gets all variables as data objects
   */
  getAllVariables(): VariableData[] {
    const result: VariableData[] = [];
    for (const [name, value] of this.variables.entries()) {
      result.push({
        name,
        value,
        type: typeof value as 'string' | 'number' | 'boolean',
      });
    }
    return result;
  }

  /**
   * Serializes variables to JSON
   */
  toJSON(): Record<string, VariableValue> {
    return Object.fromEntries(this.variables.entries());
  }

  /**
   * Restores variables from JSON
   */
  fromJSON(data: Record<string, VariableValue>): void {
    this.variables.clear();
    if (data && typeof data === 'object') {
      for (const [name, value] of Object.entries(data)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          this.variables.set(name, value);
        }
      }
    }
  }

  /**
   * Increments a numeric variable (creates it as 0 if it doesn't exist)
   */
  increment(name: string, amount = 1): number {
    const current = this.variables.get(name);
    const newValue = (typeof current === 'number' ? current : 0) + amount;
    this.variables.set(name, newValue);
    return newValue;
  }

  /**
   * Decrements a numeric variable (creates it as 0 if it doesn't exist)
   */
  decrement(name: string, amount = 1): number {
    return this.increment(name, -amount);
  }

  /**
   * Toggles a boolean variable (creates it as false if it doesn't exist)
   */
  toggle(name: string): boolean {
    const current = this.variables.get(name);
    const newValue = typeof current === 'boolean' ? !current : true;
    this.variables.set(name, newValue);
    return newValue;
  }
}

