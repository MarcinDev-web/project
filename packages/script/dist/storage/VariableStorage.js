/**
 * VariableStorage - Scene-wide storage for logic cube variables.
 * Supports string, number, and boolean types.
 */
/**
 * Manages variables for logic cubes within a scene.
 */
export class VariableStorage {
    variables = new Map();
    /**
     * Sets a variable value
     */
    set(name, value) {
        this.variables.set(name, value);
    }
    /**
     * Gets a variable value
     */
    get(name) {
        return this.variables.get(name);
    }
    /**
     * Gets a variable with a default value if not found
     */
    getOrDefault(name, defaultValue) {
        const value = this.variables.get(name);
        return value !== undefined ? value : defaultValue;
    }
    /**
     * Checks if a variable exists
     */
    has(name) {
        return this.variables.has(name);
    }
    /**
     * Deletes a variable
     */
    delete(name) {
        return this.variables.delete(name);
    }
    /**
     * Clears all variables
     */
    clear() {
        this.variables.clear();
    }
    /**
     * Gets all variable names
     */
    getVariableNames() {
        return Array.from(this.variables.keys());
    }
    /**
     * Gets all variables as data objects
     */
    getAllVariables() {
        const result = [];
        for (const [name, value] of this.variables.entries()) {
            result.push({
                name,
                value,
                type: typeof value,
            });
        }
        return result;
    }
    /**
     * Serializes variables to JSON
     */
    toJSON() {
        return Object.fromEntries(this.variables.entries());
    }
    /**
     * Restores variables from JSON
     */
    fromJSON(data) {
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
    increment(name, amount = 1) {
        const current = this.variables.get(name);
        const newValue = (typeof current === 'number' ? current : 0) + amount;
        this.variables.set(name, newValue);
        return newValue;
    }
    /**
     * Decrements a numeric variable (creates it as 0 if it doesn't exist)
     */
    decrement(name, amount = 1) {
        return this.increment(name, -amount);
    }
    /**
     * Toggles a boolean variable (creates it as false if it doesn't exist)
     */
    toggle(name) {
        const current = this.variables.get(name);
        const newValue = typeof current === 'boolean' ? !current : true;
        this.variables.set(name, newValue);
        return newValue;
    }
}
//# sourceMappingURL=VariableStorage.js.map