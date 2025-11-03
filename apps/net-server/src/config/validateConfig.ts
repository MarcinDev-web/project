/**
 * Configuration validation module.
 * Validates all environment variables and configuration on startup.
 */

const isProduction = process.env.NODE_ENV === 'production';

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate JWT_SECRET meets security requirements.
 */
function validateJwtSecret(secret: string | undefined): { valid: boolean; error?: string } {
  if (!secret) {
    return { valid: false, error: 'JWT_SECRET is required' };
  }

  if (secret === 'change-me-in-production') {
    return { valid: false, error: 'JWT_SECRET must be changed from default value' };
  }

  // JWT secrets should be at least 32 characters for HS256
  if (secret.length < 32) {
    return { valid: false, error: 'JWT_SECRET must be at least 32 characters long' };
  }

  // Check for sufficient entropy (at least 8 unique characters)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 8) {
    return {
      valid: false,
      error: 'JWT_SECRET must have sufficient entropy (at least 8 unique characters)',
    };
  }

  return { valid: true };
}

/**
 * Validate DATABASE_URL uses SSL in production.
 */
function validateDatabaseUrl(url: string | undefined): { valid: boolean; warning?: string } {
  if (!url) {
    // Database is optional (JSON fallback)
    return { valid: true };
  }

  // In production, require SSL
  if (isProduction && !url.includes('sslmode=require') && !url.includes('ssl=true')) {
    return {
      valid: true,
      warning:
        'DATABASE_URL should use SSL (sslmode=require) in production for encrypted connections',
    };
  }

  return { valid: true };
}

/**
 * Validate CORS origins configuration.
 */
function validateCorsOrigins(origin: string | undefined): { valid: boolean; warning?: string } {
  if (!origin) {
    return { valid: true };
  }

  // Warn if using wildcard in production
  if (isProduction && (origin === '*' || origin.includes('*'))) {
    return {
      valid: true,
      warning: 'CORS origin should not use wildcards in production - specify exact origins',
    };
  }

  return { valid: true };
}

/**
 * Validate rate limit configuration.
 */
function validateRateLimits(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check if rate limits are configured (values exist)
  // These are validated by express-rate-limit, but we can warn about loose limits
  const authLimiterMax = process.env.AUTH_RATE_LIMIT_MAX;
  if (authLimiterMax && parseInt(authLimiterMax, 10) > 10) {
    warnings.push(
      'AUTH_RATE_LIMIT_MAX seems high - consider stricter limits for authentication endpoints'
    );
  }

  return { valid: true, warnings };
}

/**
 * Validate all configuration.
 */
export function validateConfig(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  const jwtSecretValidation = validateJwtSecret(jwtSecret);
  if (!jwtSecretValidation.valid) {
    errors.push(jwtSecretValidation.error!);
  }

  // Validate JWT_REFRESH_SECRET (optional, defaults to JWT_SECRET + '-refresh')
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (jwtRefreshSecret) {
    const refreshSecretValidation = validateJwtSecret(jwtRefreshSecret);
    if (!refreshSecretValidation.valid) {
      errors.push(`JWT_REFRESH_SECRET: ${refreshSecretValidation.error!}`);
    }
  }

  // Validate DATABASE_URL
  const dbUrlValidation = validateDatabaseUrl(process.env.DATABASE_URL);
  if (dbUrlValidation.warning) {
    warnings.push(dbUrlValidation.warning);
  }

  // Validate CORS
  const corsValidation = validateCorsOrigins(process.env.FRONTEND_URL);
  if (corsValidation.warning) {
    warnings.push(corsValidation.warning);
  }

  // Validate rate limits
  const rateLimitValidation = validateRateLimits();
  warnings.push(...rateLimitValidation.warnings);

  // Additional production checks
  if (isProduction) {
    if (!process.env.FRONTEND_URL) {
      warnings.push('FRONTEND_URL should be explicitly set in production');
    }

    if (process.env.NODE_ENV !== 'production') {
      warnings.push('NODE_ENV should be set to "production" in production environment');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Assert configuration is valid, throw if invalid.
 */
export function assertConfigValid(): void {
  const result = validateConfig();

  if (result.warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    for (const warning of result.warnings) {
      console.warn(`   - ${warning}`);
    }
  }

  if (!result.valid) {
    console.error('❌ Configuration validation failed:');
    for (const error of result.errors) {
      console.error(`   - ${error}`);
    }
    throw new Error('Invalid configuration - please fix the errors above');
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('✅ Configuration validation passed');
  }
}
