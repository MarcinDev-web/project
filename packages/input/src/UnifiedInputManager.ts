import type { InputSource } from './InputSource';
import type { CharacterInput } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

/**
 * Strategy for combining multiple input sources
 */
export enum InputCombinationStrategy {
  /** Use first available input source (by priority) */
  FIRST_AVAILABLE = 'first',
  /** Combine all enabled inputs (for multi-input support) */
  COMBINE_ALL = 'combine',
  /** Use highest priority input source */
  HIGHEST_PRIORITY = 'priority',
}

/**
 * Unified input manager that aggregates multiple input sources
 * 
 * Responsibilities:
 * - Manage multiple input sources (keyboard, gamepad, touch, etc.)
 * - Combine inputs according to strategy
 * - Provide unified input state
 * - Handle source priority and enable/disable
 */
export class UnifiedInputManager {
  private sources: InputSource[] = [];
  private combinationStrategy: InputCombinationStrategy = InputCombinationStrategy.HIGHEST_PRIORITY;

  /**
   * Get current combination strategy
   */
  getCombinationStrategy(): InputCombinationStrategy {
    return this.combinationStrategy;
  }

  /**
   * Set combination strategy
   */
  setCombinationStrategy(strategy: InputCombinationStrategy): void {
    this.combinationStrategy = strategy;
  }

  /**
   * Add an input source
   * Sources are automatically sorted by priority (higher first)
   */
  addSource(source: InputSource): void {
    // Remove if already exists (by id)
    this.removeSource(source.id);
    
    this.sources.push(source);
    this.sortSourcesByPriority();
  }

  /**
   * Remove an input source by id
   */
  removeSource(id: string): boolean {
    const index = this.sources.findIndex(s => s.id === id);
    if (index >= 0) {
      this.sources.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get an input source by id
   */
  getSource(id: string): InputSource | null {
    return this.sources.find(s => s.id === id) ?? null;
  }

  /**
   * Get all registered input sources
   */
  getSources(): readonly InputSource[] {
    return [...this.sources];
  }

  /**
   * Get enabled input sources
   */
  getEnabledSources(): InputSource[] {
    return this.sources.filter(s => s.enabled && s.connected);
  }

  /**
   * Sort sources by priority (higher priority first)
   */
  private sortSourcesByPriority(): void {
    this.sources.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get unified input state from all sources
   * 
   * Combination strategy determines how inputs are merged:
   * - FIRST_AVAILABLE: Returns first enabled source's input
   * - COMBINE_ALL: Combines all enabled sources (OR logic for booleans, normalized vectors)
   * - HIGHEST_PRIORITY: Returns highest priority enabled source's input
   */
  getInput(): CharacterInput | null {
    const enabledSources = this.getEnabledSources();
    
    if (enabledSources.length === 0) {
      return null;
    }

    switch (this.combinationStrategy) {
      case InputCombinationStrategy.FIRST_AVAILABLE:
        return enabledSources[0]?.getInput() ?? null;

      case InputCombinationStrategy.HIGHEST_PRIORITY:
        // Already sorted by priority, so first is highest
        return enabledSources[0]?.getInput() ?? null;

      case InputCombinationStrategy.COMBINE_ALL:
        return this.combineInputs(enabledSources);

      default:
        return enabledSources[0]?.getInput() ?? null;
    }
  }

  /**
   * Combine inputs from multiple sources
   * 
   * Combines boolean actions with OR logic (if any source says jump, jump)
   * Combines movement vectors by adding and normalizing
   */
  private combineInputs(sources: InputSource[]): CharacterInput | null {
    if (sources.length === 0) return null;

    const inputs = sources
      .map(s => s.getInput())
      .filter((input): input is CharacterInput => input !== null);

    if (inputs.length === 0) return null;

    // Combine movement directions
    let moveX = 0;
    let moveZ = 0;
    let sprint = false;
    let jump = false;
    let cameraForward: Vec3 | undefined;
    let cameraRight: Vec3 | undefined;

    for (const input of inputs) {
      moveX += input.moveDirection[0];
      moveZ += input.moveDirection[2];
      sprint = sprint || input.sprint;
      jump = jump || input.jump;
      
      // Use camera directions from first source that has them
      if (!cameraForward && input.cameraForward) {
        cameraForward = input.cameraForward;
        cameraRight = input.cameraRight;
      }
    }

    // Normalize combined movement vector
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (length > 1) {
      moveX /= length;
      moveZ /= length;
    }

    const result: CharacterInput = {
      moveDirection: [moveX, 0, moveZ],
      sprint,
      jump,
    };

    if (cameraForward) {
      result.cameraForward = cameraForward;
    }
    if (cameraRight) {
      result.cameraRight = cameraRight;
    }

    return result;
  }

  /**
   * Set camera directions for all input sources
   */
  setCameraDirections(forward: Vec3, right: Vec3): void {
    for (const source of this.sources) {
      source.setCameraDirections(forward, right);
    }
  }

  /**
   * Enable an input source by id
   */
  enableSource(id: string): boolean {
    const source = this.getSource(id);
    if (source) {
      source.enable();
      return true;
    }
    return false;
  }

  /**
   * Disable an input source by id
   */
  disableSource(id: string): boolean {
    const source = this.getSource(id);
    if (source) {
      source.disable();
      return true;
    }
    return false;
  }

  /**
   * Enable all input sources
   */
  enableAll(): void {
    for (const source of this.sources) {
      source.enable();
    }
  }

  /**
   * Disable all input sources
   */
  disableAll(): void {
    for (const source of this.sources) {
      source.disable();
    }
  }

  /**
   * Clear all input sources and dispose them
   */
  clear(): void {
    for (const source of this.sources) {
      source.dispose();
    }
    this.sources = [];
  }

  /**
   * Dispose of the input manager
   */
  dispose(): void {
    this.clear();
  }
}

