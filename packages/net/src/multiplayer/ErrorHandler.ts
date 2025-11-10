import type {
  MultiplayerError,
  NetworkError,
  ValidationError,
  StateError,
  SyncError,
} from './errors';
import { ErrorSeverity, ErrorCategory } from './errors';

/**
 * Error event callback type.
 */
export type ErrorCallback = (error: MultiplayerError) => void;

/**
 * Retry configuration for error handling.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
}

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
};

/**
 * Circuit breaker state.
 */
enum CircuitBreakerState {
  Closed = 'closed', // Normal operation
  Open = 'open', // Failing, reject requests
  HalfOpen = 'half-open', // Testing if service recovered
}

/**
 * Circuit breaker configuration.
 */
interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting half-open */
  resetTimeout: number;
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 10000, // 10 seconds
};

/**
 * Centralized error handler for multiplayer system.
 * Provides error event system, retry logic, and recovery strategies.
 */
export class ErrorHandler {
  private errorCallbacks: ErrorCallback[] = [];
  private errorHistory: MultiplayerError[] = [];
  private readonly maxHistorySize: number;
  private readonly retryConfig: RetryConfig;
  private readonly circuitBreakerConfig: CircuitBreakerConfig;
  private circuitBreakerState = CircuitBreakerState.Closed;
  private circuitBreakerFailures = 0;
  private circuitBreakerResetTimer: number | null = null;
  private errorThrottleMap = new Map<string, number>(); // error code -> last occurrence time
  private readonly throttleWindow = 1000; // 1 second throttle window

  constructor(options?: {
    maxHistorySize?: number;
    retryConfig?: Partial<RetryConfig>;
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  }) {
    this.maxHistorySize = options?.maxHistorySize ?? 100;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retryConfig };
    this.circuitBreakerConfig = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...options?.circuitBreakerConfig,
    };
  }

  /**
   * Subscribe to error events.
   * Returns unsubscribe function.
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index >= 0) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Handle an error.
   * Emits error event, logs error, and attempts recovery if applicable.
   */
  handleError(error: MultiplayerError, options?: { skipThrottle?: boolean }): void {
    // Throttle duplicate errors
    if (!options?.skipThrottle && this.isThrottled(error.code)) {
      return;
    }

    // Add to history
    this.addToHistory(error);

    // Update circuit breaker
    this.updateCircuitBreaker(error);

    // Emit error event
    this.emitError(error);

    // Log error based on severity
    this.logError(error);

    // Attempt automatic recovery for recoverable errors
    if (error.retryable && error.severity !== ErrorSeverity.Fatal) {
      // Recovery is handled by retry logic, not here
      // This is just for logging/notification
    }
  }

  /**
   * Execute operation with retry logic.
   * Automatically retries on retryable errors with exponential backoff.
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: {
      retryConfig?: Partial<RetryConfig>;
      onRetry?: (attempt: number, error: MultiplayerError) => void;
    }
  ): Promise<T> {
    const config = { ...this.retryConfig, ...options?.retryConfig };
    let lastError: MultiplayerError | null = null;

    for (let attempt = 0; attempt <= config.maxAttempts; attempt++) {
      try {
        // Check circuit breaker
        if (this.circuitBreakerState === CircuitBreakerState.Open) {
          throw new NetworkError('Circuit breaker is open', {
            code: 'CIRCUIT_BREAKER_OPEN',
            retryable: false,
          });
        }

        const result = await operation();
        
        // Success - reset circuit breaker if half-open
        if (this.circuitBreakerState === CircuitBreakerState.HalfOpen) {
          this.resetCircuitBreaker();
        }

        return result;
      } catch (error) {
        const multiplayerError = this.normalizeError(error);
        lastError = multiplayerError;

        // Don't retry non-retryable errors
        if (!multiplayerError.retryable) {
          this.handleError(multiplayerError);
          throw multiplayerError;
        }

        // Last attempt - throw error
        if (attempt >= config.maxAttempts) {
          this.handleError(multiplayerError);
          throw multiplayerError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );

        // Notify retry callback
        if (options?.onRetry) {
          options.onRetry(attempt + 1, multiplayerError);
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs it
    if (lastError) {
      throw lastError;
    }
    throw new Error('Unexpected error in executeWithRetry');
  }

  /**
   * Execute operation with graceful degradation.
   * Returns fallback value on error instead of throwing.
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallback: T,
    options?: {
      onError?: (error: MultiplayerError) => void;
    }
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const multiplayerError = this.normalizeError(error);
      this.handleError(multiplayerError);
      
      if (options?.onError) {
        options.onError(multiplayerError);
      }

      return fallback;
    }
  }

  /**
   * Get error history.
   */
  getErrorHistory(): readonly MultiplayerError[] {
    return this.errorHistory;
  }

  /**
   * Get errors by severity.
   */
  getErrorsBySeverity(severity: ErrorSeverity): MultiplayerError[] {
    return this.errorHistory.filter((e) => e.severity === severity);
  }

  /**
   * Get errors by category.
   */
  getErrorsByCategory(category: ErrorCategory): MultiplayerError[] {
    return this.errorHistory.filter((e) => e.category === category);
  }

  /**
   * Clear error history.
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get circuit breaker state.
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreakerState;
  }

  /**
   * Reset circuit breaker manually.
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = CircuitBreakerState.Closed;
    this.circuitBreakerFailures = 0;
    if (this.circuitBreakerResetTimer !== null) {
      clearTimeout(this.circuitBreakerResetTimer);
      this.circuitBreakerResetTimer = null;
    }
  }

  /**
   * Dispose error handler.
   */
  dispose(): void {
    this.errorCallbacks = [];
    this.errorHistory = [];
    this.errorThrottleMap.clear();
    if (this.circuitBreakerResetTimer !== null) {
      clearTimeout(this.circuitBreakerResetTimer);
      this.circuitBreakerResetTimer = null;
    }
  }

  /**
   * Emit error to all subscribers.
   */
  private emitError(error: MultiplayerError): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (err) {
        // Don't let error callbacks break error handling
        console.error('Error in error callback:', err);
      }
    }
  }

  /**
   * Add error to history.
   */
  private addToHistory(error: MultiplayerError): void {
    this.errorHistory.push(error);
    
    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * Log error based on severity.
   */
  private logError(error: MultiplayerError): void {
    const logData = {
      errorId: error.errorId,
      severity: error.severity,
      category: error.category,
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp,
    };

    switch (error.severity) {
      case ErrorSeverity.Fatal:
        console.error('[FATAL]', logData, error);
        break;
      case ErrorSeverity.Error:
        console.error('[ERROR]', logData, error);
        break;
      case ErrorSeverity.Warning:
        console.warn('[WARNING]', logData);
        break;
      case ErrorSeverity.Info:
        console.info('[INFO]', logData);
        break;
    }
  }

  /**
   * Check if error is throttled (duplicate within throttle window).
   */
  private isThrottled(errorCode: string): boolean {
    const now = Date.now();
    const lastOccurrence = this.errorThrottleMap.get(errorCode);
    
    if (lastOccurrence && now - lastOccurrence < this.throttleWindow) {
      return true;
    }

    this.errorThrottleMap.set(errorCode, now);
    return false;
  }

  /**
   * Update circuit breaker state based on error.
   */
  private updateCircuitBreaker(error: MultiplayerError): void {
    // Only network errors affect circuit breaker
    if (error.category !== ErrorCategory.Network) {
      return;
    }

    if (error.retryable) {
      this.circuitBreakerFailures++;
      
      if (
        this.circuitBreakerState === CircuitBreakerState.Closed &&
        this.circuitBreakerFailures >= this.circuitBreakerConfig.failureThreshold
      ) {
        // Open circuit breaker
        this.circuitBreakerState = CircuitBreakerState.Open;
        this.circuitBreakerFailures = 0;

        // Schedule reset attempt
        this.circuitBreakerResetTimer = window.setTimeout(() => {
          this.circuitBreakerState = CircuitBreakerState.HalfOpen;
          this.circuitBreakerResetTimer = null;
        }, this.circuitBreakerConfig.resetTimeout);
      }
    } else if (this.circuitBreakerState === CircuitBreakerState.HalfOpen) {
      // Success in half-open state - reset circuit breaker
      this.resetCircuitBreaker();
    }
  }

  /**
   * Normalize error to MultiplayerError.
   */
  private normalizeError(error: unknown): MultiplayerError {
    if (error instanceof MultiplayerError) {
      return error;
    }

    if (error instanceof Error) {
      return new NetworkError(error.message, {
        code: 'UNKNOWN_ERROR',
        context: {
          originalError: error.name,
          stack: error.stack,
        },
        cause: error,
        retryable: false,
      });
    }

    return new NetworkError(String(error), {
      code: 'UNKNOWN_ERROR',
      context: {
        originalError: typeof error,
      },
      retryable: false,
    });
  }
}

