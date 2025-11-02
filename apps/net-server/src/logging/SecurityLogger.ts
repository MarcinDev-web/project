/**
 * Security event logging service.
 * Logs all security-related events for monitoring and auditing.
 */

export enum SecurityEventType {
  AUTH_SUCCESS = 'auth:success',
  AUTH_FAILURE = 'auth:failure',
  AUTH_LOCKOUT = 'auth:lockout',
  TOKEN_REVOKED = 'token:revoked',
  TOKEN_REFRESH = 'token:refresh',
  ROLE_CHANGE = 'role:change',
  RATE_LIMIT_VIOLATION = 'rate_limit:violation',
  SUSPICIOUS_ACTIVITY = 'suspicious:activity',
  SENSITIVE_OPERATION = 'sensitive:operation',
  PRIVILEGE_ESCALATION = 'privilege:escalation',
}

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

/**
 * Security event logger.
 * Logs security events to console (and could integrate with external logging services).
 */
export class SecurityLogger {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 1000; // Keep last 1000 events in memory

  /**
   * Log a security event.
   */
  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Add to memory buffer
    this.events.push(fullEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift(); // Remove oldest
    }

    // Log to console with appropriate level
    const logLevel = this.getLogLevel(event.type);
    const message = this.formatEvent(fullEvent);

    switch (logLevel) {
      case 'error':
        console.error(`[SECURITY ERROR] ${message}`);
        break;
      case 'warn':
        console.warn(`[SECURITY WARN] ${message}`);
        break;
      case 'info':
      default:
        console.log(`[SECURITY INFO] ${message}`);
        break;
    }

    // TODO: Integrate with external logging service (CloudWatch, Datadog, etc.)
    // this.sendToExternalService(fullEvent);
  }

  /**
   * Log authentication success.
   */
  logAuthSuccess(userId: string, email: string, ip?: string, userAgent?: string): void {
    const event: Omit<SecurityEvent, 'timestamp'> = {
      type: SecurityEventType.AUTH_SUCCESS,
      userId,
      email,
    };
    if (ip !== undefined) event.ip = ip;
    if (userAgent !== undefined) event.userAgent = userAgent;
    this.logEvent(event);
  }

  /**
   * Log authentication failure.
   */
  logAuthFailure(email: string, reason: string, ip?: string, userAgent?: string): void {
    const event: Omit<SecurityEvent, 'timestamp'> = {
      type: SecurityEventType.AUTH_FAILURE,
      email,
      details: { reason },
    };
    if (ip !== undefined) event.ip = ip;
    if (userAgent !== undefined) event.userAgent = userAgent;
    this.logEvent(event);
  }

  /**
   * Log account lockout.
   */
  logAuthLockout(email: string, ip?: string, userAgent?: string): void {
    const event: Omit<SecurityEvent, 'timestamp'> = {
      type: SecurityEventType.AUTH_LOCKOUT,
      email,
    };
    if (ip !== undefined) event.ip = ip;
    if (userAgent !== undefined) event.userAgent = userAgent;
    this.logEvent(event);
  }

  /**
   * Log token revocation.
   */
  logTokenRevoked(userId: string, jti: string, reason?: string): void {
    this.logEvent({
      type: SecurityEventType.TOKEN_REVOKED,
      userId,
      details: { jti, reason },
    });
  }

  /**
   * Log token refresh.
   */
  logTokenRefresh(userId: string): void {
    this.logEvent({
      type: SecurityEventType.TOKEN_REFRESH,
      userId,
    });
  }

  /**
   * Log role change.
   */
  logRoleChange(userId: string, oldRole: string, newRole: string, changedBy: string): void {
    this.logEvent({
      type: SecurityEventType.ROLE_CHANGE,
      userId,
      details: { oldRole, newRole, changedBy },
    });
  }

  /**
   * Log rate limit violation.
   */
  logRateLimitViolation(ip: string, endpoint: string, limit: number): void {
    this.logEvent({
      type: SecurityEventType.RATE_LIMIT_VIOLATION,
      ip,
      details: { endpoint, limit },
    });
  }

  /**
   * Log suspicious activity.
   */
  logSuspiciousActivity(
    userId: string | undefined,
    description: string,
    ip?: string,
    userAgent?: string
  ): void {
    const event: Omit<SecurityEvent, 'timestamp'> = {
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      details: { description },
    };
    if (userId !== undefined) event.userId = userId;
    if (ip !== undefined) event.ip = ip;
    if (userAgent !== undefined) event.userAgent = userAgent;
    this.logEvent(event);
  }

  /**
   * Log sensitive operation.
   */
  logSensitiveOperation(
    userId: string,
    operation: string,
    details?: Record<string, unknown>
  ): void {
    this.logEvent({
      type: SecurityEventType.SENSITIVE_OPERATION,
      userId,
      details: { operation, ...details },
    });
  }

  /**
   * Log file upload failure.
   */
  logFileUploadFailure(
    userId: string | undefined,
    filename: string,
    reason: string,
    ip?: string
  ): void {
    const event: Omit<SecurityEvent, 'timestamp'> = {
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      details: { filename, reason, operation: 'file_upload_failure' },
    };
    if (userId !== undefined) event.userId = userId;
    if (ip !== undefined) event.ip = ip;
    this.logEvent(event);
  }

  /**
   * Get recent events (for monitoring/auditing).
   */
  getRecentEvents(count = 100): SecurityEvent[] {
    return this.events.slice(-count).reverse();
  }

  /**
   * Get events by type.
   */
  getEventsByType(type: SecurityEventType, count = 100): SecurityEvent[] {
    return this.events.filter(e => e.type === type).slice(-count).reverse();
  }

  /**
   * Get log level for event type.
   */
  private getLogLevel(type: SecurityEventType): 'error' | 'warn' | 'info' {
    switch (type) {
      case SecurityEventType.AUTH_FAILURE:
      case SecurityEventType.AUTH_LOCKOUT:
      case SecurityEventType.RATE_LIMIT_VIOLATION:
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
      case SecurityEventType.PRIVILEGE_ESCALATION:
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Format event for logging.
   */
  private formatEvent(event: SecurityEvent): string {
    const parts: string[] = [
      `[${event.type}]`,
      event.userId ? `user=${event.userId}` : '',
      event.email ? `email=${event.email}` : '',
      event.ip ? `ip=${event.ip}` : '',
      event.details ? `details=${JSON.stringify(event.details)}` : '',
    ];

    return parts.filter(Boolean).join(' ');
  }
}

// Singleton instance
export const securityLogger = new SecurityLogger();

