import type { Operation } from '../types/replication';

/**
 * Conflict resolution strategy.
 */
export enum ConflictResolutionStrategy {
  /** Last write wins (use most recent timestamp). */
  LastWriteWins = 'last-write-wins',
  /** First write wins (use oldest timestamp). */
  FirstWriteWins = 'first-write-wins',
  /** User priority (higher priority user wins). */
  UserPriority = 'user-priority',
  /** Manual resolution (requires user intervention). */
  Manual = 'manual',
}

/**
 * Conflict information.
 */
export interface Conflict {
  /** Conflicting operations. */
  operations: Operation[];
  /** Entity ID affected by conflict. */
  entityId: string;
  /** Conflict type. */
  type: 'transform' | 'component' | 'entity-lifecycle';
  /** Timestamp of conflict detection. */
  timestamp: number;
}

/**
 * Conflict resolution result.
 */
export interface ConflictResolutionResult {
  /** Winning operation. */
  winningOperation: Operation;
  /** Losing operations. */
  losingOperations: Operation[];
  /** Whether conflict was resolved automatically. */
  resolved: boolean;
}

/**
 * Configuration for ConflictResolver.
 */
export interface ConflictResolverConfig {
  /** Conflict resolution strategy. */
  strategy?: ConflictResolutionStrategy; // Default: LastWriteWins
  /** User priority map (for UserPriority strategy). */
  userPriority?: Map<string, number>; // userId -> priority (higher = wins)
  /** Enable conflict logging. */
  enableLogging?: boolean; // Default: true
}

/**
 * Callback types for conflict events.
 */
export type OnConflictDetectedCallback = (conflict: Conflict) => void;
export type OnConflictResolvedCallback = (result: ConflictResolutionResult) => void;

/**
 * Resolves conflicts when simultaneous changes occur.
 * Handles:
 * - Detecting conflicts between operations
 * - Applying conflict resolution strategies
 * - Last-write-wins strategy (default)
 * - User priority strategy
 * - Conflict logging and reporting
 */
export class ConflictResolver {
  private readonly config: Required<ConflictResolverConfig>;
  private conflicts: Conflict[] = [];
  private conflictCount = 0;

  // Event handlers
  private onConflictDetectedHandlers: OnConflictDetectedCallback[] = [];
  private onConflictResolvedHandlers: OnConflictResolvedCallback[] = [];

  constructor(config: ConflictResolverConfig = {}) {
    this.config = {
      strategy: config.strategy ?? ConflictResolutionStrategy.LastWriteWins,
      userPriority: config.userPriority ?? new Map(),
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * Detect conflicts between operations.
   * Returns array of conflicts found.
   */
  detectConflicts(operations: Operation[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const operationMap = new Map<string, Operation[]>();

    // Group operations by entity ID
    for (const operation of operations) {
      if (!operation.entityId) continue;

      const entityId = operation.entityId;
      if (!operationMap.has(entityId)) {
        operationMap.set(entityId, []);
      }
      operationMap.get(entityId)!.push(operation);
    }

    // Check for conflicts in each entity
    for (const [entityId, entityOperations] of operationMap.entries()) {
      if (entityOperations.length <= 1) continue;

      // Check for conflicts based on operation type
      const conflictsForEntity = this.checkEntityConflicts(entityId, entityOperations);
      conflicts.push(...conflictsForEntity);
    }

    return conflicts;
  }

  /**
   * Check for conflicts in operations for a specific entity.
   */
  private checkEntityConflicts(entityId: string, operations: Operation[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Group by operation type
    const transformOps = operations.filter((op) => op.type === 'transform-update');
    const componentOps = operations.filter((op) => op.type === 'component-update');
    const lifecycleOps = operations.filter(
      (op) => op.type === 'entity-create' || op.type === 'entity-delete'
    );

    // Check transform conflicts
    if (transformOps.length > 1) {
      conflicts.push({
        operations: transformOps,
        entityId,
        type: 'transform',
        timestamp: Date.now(),
      });
    }

    // Check component conflicts
    if (componentOps.length > 1) {
      conflicts.push({
        operations: componentOps,
        entityId,
        type: 'component',
        timestamp: Date.now(),
      });
    }

    // Check lifecycle conflicts (create/delete)
    if (lifecycleOps.length > 1) {
      conflicts.push({
        operations: lifecycleOps,
        entityId,
        type: 'entity-lifecycle',
        timestamp: Date.now(),
      });
    }

    return conflicts;
  }

  /**
   * Resolve a conflict using configured strategy.
   */
  resolveConflict(conflict: Conflict): ConflictResolutionResult {
    this.conflictCount++;
    conflict.operations.sort((a, b) => a.timestamp - b.timestamp);

    if (this.config.enableLogging) {
      console.log(`Resolving conflict #${this.conflictCount} for entity ${conflict.entityId}:`, conflict);
    }

    // Notify handlers
    this.onConflictDetectedHandlers.forEach((cb) => cb(conflict));

    let result: ConflictResolutionResult;

    switch (this.config.strategy) {
      case ConflictResolutionStrategy.LastWriteWins:
        result = this.resolveLastWriteWins(conflict);
        break;
      case ConflictResolutionStrategy.FirstWriteWins:
        result = this.resolveFirstWriteWins(conflict);
        break;
      case ConflictResolutionStrategy.UserPriority:
        result = this.resolveUserPriority(conflict);
        break;
      case ConflictResolutionStrategy.Manual:
        result = this.resolveManual(conflict);
        break;
      default:
        // Default to last-write-wins
        result = this.resolveLastWriteWins(conflict);
    }

    // Notify handlers
    this.onConflictResolvedHandlers.forEach((cb) => cb(result));

    return result;
  }

  /**
   * Resolve conflict using last-write-wins strategy.
   */
  private resolveLastWriteWins(conflict: Conflict): ConflictResolutionResult {
    // Sort by timestamp (newest first)
    const sorted = [...conflict.operations].sort((a, b) => b.timestamp - a.timestamp);
    const winningOperation = sorted[0]!;
    const losingOperations = sorted.slice(1);

    return {
      winningOperation,
      losingOperations,
      resolved: true,
    };
  }

  /**
   * Resolve conflict using first-write-wins strategy.
   */
  private resolveFirstWriteWins(conflict: Conflict): ConflictResolutionResult {
    // Sort by timestamp (oldest first)
    const sorted = [...conflict.operations].sort((a, b) => a.timestamp - b.timestamp);
    const winningOperation = sorted[0]!;
    const losingOperations = sorted.slice(1);

    return {
      winningOperation,
      losingOperations,
      resolved: true,
    };
  }

  /**
   * Resolve conflict using user priority strategy.
   */
  private resolveUserPriority(conflict: Conflict): ConflictResolutionResult {
    // Sort by user priority (highest first), then by timestamp
    const sorted = [...conflict.operations].sort((a, b) => {
      const priorityA = this.config.userPriority!.get(a.userId) ?? 0;
      const priorityB = this.config.userPriority!.get(b.userId) ?? 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority wins
      }

      // If priorities are equal, use last-write-wins
      return b.timestamp - a.timestamp;
    });

    const winningOperation = sorted[0]!;
    const losingOperations = sorted.slice(1);

    return {
      winningOperation,
      losingOperations,
      resolved: true,
    };
  }

  /**
   * Manual resolution (requires user intervention).
   */
  private resolveManual(conflict: Conflict): ConflictResolutionResult {
    // For manual resolution, we return the first operation as winning
    // but mark as unresolved so UI can handle it
    const winningOperation = conflict.operations[0]!;
    const losingOperations = conflict.operations.slice(1);

    return {
      winningOperation,
      losingOperations,
      resolved: false, // Not automatically resolved
    };
  }

  /**
   * Resolve multiple conflicts.
   */
  resolveConflicts(conflicts: Conflict[]): ConflictResolutionResult[] {
    return conflicts.map((conflict) => this.resolveConflict(conflict));
  }

  /**
   * Set user priority for user priority strategy.
   */
  setUserPriority(userId: string, priority: number): void {
    this.config.userPriority.set(userId, priority);
  }

  /**
   * Get user priority.
   */
  getUserPriority(userId: string): number {
    return this.config.userPriority.get(userId) ?? 0;
  }

  /**
   * Change conflict resolution strategy.
   */
  setStrategy(strategy: ConflictResolutionStrategy): void {
    (this.config as { strategy: ConflictResolutionStrategy }).strategy = strategy;
  }

  /**
   * Get current strategy.
   */
  getStrategy(): ConflictResolutionStrategy {
    return this.config.strategy;
  }

  /**
   * Get conflict statistics.
   */
  getStats(): { totalConflicts: number; unresolvedConflicts: number } {
    return {
      totalConflicts: this.conflictCount,
      unresolvedConflicts: this.conflicts.filter((c) => !c).length,
    };
  }

  /**
   * Register event handlers.
   */
  onConflictDetected(callback: OnConflictDetectedCallback): () => void {
    this.onConflictDetectedHandlers.push(callback);
    return () => {
      const index = this.onConflictDetectedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onConflictDetectedHandlers.splice(index, 1);
      }
    };
  }

  onConflictResolved(callback: OnConflictResolvedCallback): () => void {
    this.onConflictResolvedHandlers.push(callback);
    return () => {
      const index = this.onConflictResolvedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onConflictResolvedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Cleanup - call when conflict resolver is no longer needed.
   */
  dispose(): void {
    this.conflicts = [];
    this.onConflictDetectedHandlers = [];
    this.onConflictResolvedHandlers = [];
  }
}

