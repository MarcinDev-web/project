import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  getCorsConfig,
  isOriginAllowed,
  resetCorsConfigCache,
} from '@shared/config/cors';

const originalEnv = { ...process.env };

function restoreEnv(): void {
  const keys = [
    'FRONTEND_URL',
    'PRIMARY_FRONTEND_URL',
    'CORS_ALLOWED_ORIGINS',
    'ALLOWED_ORIGINS',
    'NODE_ENV',
  ] as const;

  for (const key of keys) {
    const originalValue = originalEnv[key];
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
}

describe('shared/config/cors', () => {
  beforeEach(() => {
    restoreEnv();
    delete process.env.FRONTEND_URL;
    delete process.env.PRIMARY_FRONTEND_URL;
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'test';
    resetCorsConfigCache();
  });

  afterEach(() => {
    restoreEnv();
    resetCorsConfigCache();
  });

  it('parses multiple frontend URLs and additional allowlist origins', () => {
    process.env.FRONTEND_URL = 'https://app.example.com, https://editor.example.com/';
    process.env.CORS_ALLOWED_ORIGINS = 'https://preview.example.com';
    resetCorsConfigCache();

    const config = getCorsConfig({ forceRecompute: true });

    expect(config.primaryOrigin).toBe('https://app.example.com');
    expect(config.exactOrigins).toEqual([
      'https://app.example.com',
      'https://editor.example.com',
      'https://preview.example.com',
    ]);
  });

  it('supports wildcard origins for preview environments', () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    process.env.CORS_ALLOWED_ORIGINS = 'https://*.preview.example.com';
    resetCorsConfigCache();

    const config = getCorsConfig({ forceRecompute: true });

    expect(isOriginAllowed('https://foo.preview.example.com', config)).toBe(true);
    expect(isOriginAllowed('https://bar.not-preview.example.com', config)).toBe(false);
  });

  it('throws in production when no CORS origins are configured', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'production';
    resetCorsConfigCache();

    expect(() => getCorsConfig({ forceRecompute: true })).toThrow('No CORS origins configured');
  });
});


