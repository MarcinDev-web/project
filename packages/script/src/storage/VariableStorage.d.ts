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
export declare class VariableStorage {
    private variables;
    /**
     * Sets a variable value
     */
    set(name: string, value: VariableValue): void;
    /**
     * Gets a variable value
     */
    get(name: string): VariableValue | undefined;
    /**
     * Gets a variable with a default value if not found
     */
    getOrDefault(name: string, defaultValue: VariableValue): VariableValue;
    /**
     * Checks if a variable exists
     */
    has(name: string): boolean;
    /**
     * Deletes a variable
     */
    delete(name: string): boolean;
    /**
     * Clears all variables
     */
    clear(): void;
    /**
     * Gets all variable names
     */
    getVariableNames(): string[];
    /**
     * Gets all variables as data objects
     */
    getAllVariables(): VariableData[];
    /**
     * Serializes variables to JSON
     */
    toJSON(): Record<string, VariableValue>;
    /**
     * Restores variables from JSON
     */
    fromJSON(data: Record<string, VariableValue>): void;
    /**
     * Increments a numeric variable (creates it as 0 if it doesn't exist)
     */
    increment(name: string, amount?: number): number;
    /**
     * Decrements a numeric variable (creates it as 0 if it doesn't exist)
     */
    decrement(name: string, amount?: number): number;
    /**
     * Toggles a boolean variable (creates it as false if it doesn't exist)
     */
    toggle(name: string): boolean;
}
//# sourceMappingURL=VariableStorage.d.ts.map