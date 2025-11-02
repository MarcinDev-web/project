import type { InputMapping } from './InputSource';
import { DEFAULT_KEYBOARD_MAPPING } from './InputSource';

/**
 * Input mapper for key rebinding and remapping
 * 
 * Provides functionality to:
 * - Save/load input mappings
 * - Remap keys to actions
 * - Validate mappings
 * - Reset to defaults
 */
export class InputMapper {
  private mapping: InputMapping;

  constructor(mapping: InputMapping = { ...DEFAULT_KEYBOARD_MAPPING }) {
    this.mapping = this.deepCopyMapping(mapping);
  }

  /**
   * Get current mapping
   */
  getMapping(): InputMapping {
    return this.deepCopyMapping(this.mapping);
  }

  /**
   * Update mapping
   */
  setMapping(mapping: Partial<InputMapping>): void {
    if (mapping.movement) {
      this.mapping.movement = { ...this.mapping.movement, ...mapping.movement };
    }
    if (mapping.actions) {
      this.mapping.actions = { ...this.mapping.actions, ...mapping.actions };
    }
  }

  /**
   * Remap a single action
   */
  remapAction(action: keyof InputMapping['actions'], keys: string[]): void {
    this.mapping.actions[action] = [...keys];
  }

  /**
   * Remap a movement direction
   */
  remapMovement(direction: keyof InputMapping['movement'], keys: string[]): void {
    this.mapping.movement[direction] = [...keys];
  }

  /**
   * Reset mapping to defaults
   */
  resetToDefaults(): void {
    this.mapping = this.deepCopyMapping(DEFAULT_KEYBOARD_MAPPING);
  }

  /**
   * Check if a key is bound to any action
   */
  isKeyBound(key: string): boolean {
    // Check movement bindings
    for (const keys of Object.values(this.mapping.movement)) {
      if (keys.includes(key)) return true;
    }
    // Check action bindings
    for (const keys of Object.values(this.mapping.actions)) {
      if (keys.includes(key)) return true;
    }
    return false;
  }

  /**
   * Find which action(s) a key is bound to
   */
  findKeyBindings(key: string): Array<{ type: 'movement' | 'action'; name: string }> {
    const bindings: Array<{ type: 'movement' | 'action'; name: string }> = [];

    // Check movement bindings
    for (const [name, keys] of Object.entries(this.mapping.movement)) {
      if (keys.includes(key)) {
        bindings.push({ type: 'movement', name });
      }
    }

    // Check action bindings
    for (const [name, keys] of Object.entries(this.mapping.actions)) {
      if (keys.includes(key)) {
        bindings.push({ type: 'action', name });
      }
    }

    return bindings;
  }

  /**
   * Validate mapping (check for conflicts, empty bindings, etc.)
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for empty bindings
    for (const [name, keys] of Object.entries(this.mapping.movement)) {
      if (keys.length === 0) {
        errors.push(`Movement action '${name}' has no key bindings`);
      }
    }
    for (const [name, keys] of Object.entries(this.mapping.actions)) {
      if (keys.length === 0) {
        errors.push(`Action '${name}' has no key bindings`);
      }
    }

    // Check for duplicate key bindings (conflicts)
    const keyToActions = new Map<string, string[]>();
    
    for (const [name, keys] of Object.entries(this.mapping.movement)) {
      for (const key of keys) {
        const existing = keyToActions.get(key) ?? [];
        keyToActions.set(key, [...existing, `movement.${name}`]);
      }
    }
    
    for (const [name, keys] of Object.entries(this.mapping.actions)) {
      for (const key of keys) {
        const existing = keyToActions.get(key) ?? [];
        keyToActions.set(key, [...existing, `action.${name}`]);
      }
    }

    // Warn about conflicts (same key used for multiple actions)
    for (const [key, actions] of keyToActions.entries()) {
      if (actions.length > 1) {
        errors.push(`Key '${key}' is bound to multiple actions: ${actions.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize mapping to JSON
   */
  serialize(): string {
    return JSON.stringify(this.mapping, null, 2);
  }

  /**
   * Deserialize mapping from JSON
   */
  static deserialize(json: string): InputMapping {
    const parsed = JSON.parse(json) as InputMapping;
    return parsed;
  }

  /**
   * Deep copy mapping
   */
  private deepCopyMapping(mapping: InputMapping): InputMapping {
    return {
      movement: {
        forward: [...mapping.movement.forward],
        backward: [...mapping.movement.backward],
        left: [...mapping.movement.left],
        right: [...mapping.movement.right],
      },
      actions: {
        jump: [...mapping.actions.jump],
        sprint: [...mapping.actions.sprint],
        interact: [...mapping.actions.interact],
      },
    };
  }
}

