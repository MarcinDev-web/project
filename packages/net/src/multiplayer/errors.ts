/**
 * Error severity levels for multiplayer errors.
 */
export enum ErrorSeverity {
  /** Fatal error - requires session termination */
  Fatal = 'fatal',
  /** Error - requires attention but can continue */
  Error = 'error',
  /** Warning - informational, doesn't block operation */
  Warning = 'warning',
  /** Info - debug/informational */
  Info = 'info',
}

/**
 * Error categories for multiplayer errors.
 */
export enum ErrorCategory {
  /** Network-related errors (connection, transmission) */
  Network = 'network',
  /** Validation errors (invalid input, malformed data) */
  Validation = 'validation',
  /** State errors (invalid state, state transitions) */
  State = 'state',
  /** Synchronization errors (sync failures, desync) */
  Sync = 'sync',
}

/**
 * Base error class for all multiplayer errors.
 * Provides structured error information with severity, category, and context.
 */
export class MultiplayerError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly retryable: boolean;
  public readonly timestamp: number;
  public readonly errorId: string;

  constructor(
    message: string,
    options: {
      severity: ErrorSeverity;
      category: ErrorCategory;
      code: string;
      context?: Record<string, unknown>;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = 'MultiplayerError';
    this.severity = options.severity;
    this.category = options.category;
    this.code = options.code;
    this.context = options.context;
    this.retryable = options.retryable ?? false;
    this.timestamp = Date.now();
    this.errorId = this.generateErrorId();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MultiplayerError);
    }
  }

  /**
   * Generate unique error ID for tracking.
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert error to JSON for logging/reporting.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      severity: this.severity,
      category: this.category,
      code: this.code,
      context: this.context,
      retryable: this.retryable,
      timestamp: this.timestamp,
      errorId: this.errorId,
      stack: this.stack,
      cause: this.cause,
    };
  }
}

/**
 * Network-related error (connection, transmission failures).
 * Usually retryable with exponential backoff.
 */
export class NetworkError extends MultiplayerError {
  constructor(
    message: string,
    options: {
      code: string;
      context?: Record<string, unknown>;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message, {
      severity: ErrorSeverity.Error,
      category: ErrorCategory.Network,
      code: options.code,
      context: options.context,
      retryable: options.retryable ?? true,
      cause: options.cause,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Validation error (invalid input, malformed data).
 * Non-retryable - requires fixing the input.
 */
export class ValidationError extends MultiplayerError {
  constructor(
    message: string,
    options: {
      code: string;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, {
      severity: ErrorSeverity.Error,
      category: ErrorCategory.Validation,
      code: options.code,
      context: options.context,
      retryable: false,
      cause: options.cause,
    });
    this.name = 'ValidationError';
  }
}

/**
 * State error (invalid state, state transitions).
 * Usually recoverable with state restoration.
 */
export class StateError extends MultiplayerError {
  constructor(
    message: string,
    options: {
      code: string;
      context?: Record<string, unknown>;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message, {
      severity: ErrorSeverity.Error,
      category: ErrorCategory.State,
      code: options.code,
      context: options.context,
      retryable: options.retryable ?? true,
      cause: options.cause,
    });
    this.name = 'StateError';
  }
}

/**
 * Synchronization error (sync failures, desync).
 * Usually recoverable with resync.
 */
export class SyncError extends MultiplayerError {
  constructor(
    message: string,
    options: {
      code: string;
      context?: Record<string, unknown>;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message, {
      severity: ErrorSeverity.Warning,
      category: ErrorCategory.Sync,
      code: options.code,
      context: options.context,
      retryable: options.retryable ?? true,
      cause: options.cause,
    });
    this.name = 'SyncError';
  }
}

/**
 * Error factory functions for common error scenarios.
 */
export const ErrorFactory = {
  /**
   * Create network connection error.
   */
  networkConnection(message: string, context?: Record<string, unknown>): NetworkError {
    return new NetworkError(message, {
      code: 'NETWORK_CONNECTION',
      context,
      retryable: true,
    });
  },

  /**
   * Create network send error.
   */
  networkSend(message: string, context?: Record<string, unknown>): NetworkError {
    return new NetworkError(message, {
      code: 'NETWORK_SEND',
      context,
      retryable: true,
    });
  },

  /**
   * Create validation error for invalid input.
   */
  invalidInput(field: string, value: unknown, reason?: string): ValidationError {
    return new ValidationError(`Invalid input: ${field}`, {
      code: 'VALIDATION_INVALID_INPUT',
      context: {
        field,
        value,
        reason,
      },
    });
  },

  /**
   * Create validation error for missing required field.
   */
  missingField(field: string, context?: Record<string, unknown>): ValidationError {
    return new ValidationError(`Missing required field: ${field}`, {
      code: 'VALIDATION_MISSING_FIELD',
      context: {
        field,
        ...context,
      },
    });
  },

  /**
   * Create state error for invalid state.
   */
  invalidState(currentState: string, expectedState?: string, context?: Record<string, unknown>): StateError {
    return new StateError(`Invalid state: ${currentState}${expectedState ? `, expected: ${expectedState}` : ''}`, {
      code: 'STATE_INVALID',
      context: {
        currentState,
        expectedState,
        ...context,
      },
      retryable: false,
    });
  },

  /**
   * Create sync error for desync.
   */
  desync(entityId: string, reason?: string, context?: Record<string, unknown>): SyncError {
    return new SyncError(`Desync detected for entity: ${entityId}${reason ? ` - ${reason}` : ''}`, {
      code: 'SYNC_DESYNC',
      context: {
        entityId,
        reason,
        ...context,
      },
      retryable: true,
    });
  },

  /**
   * Create sync error for sync failure.
   */
  syncFailure(operation: string, reason?: string, context?: Record<string, unknown>): SyncError {
    return new SyncError(`Sync failure: ${operation}${reason ? ` - ${reason}` : ''}`, {
      code: 'SYNC_FAILURE',
      context: {
        operation,
        reason,
        ...context,
      },
      retryable: true,
    });
  },
};

