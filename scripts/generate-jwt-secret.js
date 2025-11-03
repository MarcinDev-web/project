#!/usr/bin/env node
/**
 * Generate secure JWT secrets for production use
 */

import crypto from 'crypto';

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

function validateSecret(secret) {
  if (secret.length < 32) {
    return { valid: false, error: 'Secret must be at least 32 characters' };
  }
  
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 8) {
    return { valid: false, error: 'Secret must have at least 8 unique characters' };
  }
  
  return { valid: true };
}

console.log('🔐 Generating JWT secrets for production...\n');

const jwtSecret = generateSecret(32);
const jwtRefreshSecret = generateSecret(32);

const jwtValidation = validateSecret(jwtSecret);
const refreshValidation = validateSecret(jwtRefreshSecret);

if (!jwtValidation.valid) {
  console.error('❌ JWT_SECRET validation failed:', jwtValidation.error);
  process.exit(1);
}

if (!refreshValidation.valid) {
  console.error('❌ JWT_REFRESH_SECRET validation failed:', refreshValidation.error);
  process.exit(1);
}

console.log('✅ Generated secure secrets:\n');
console.log('JWT_SECRET=' + jwtSecret);
console.log('JWT_REFRESH_SECRET=' + jwtRefreshSecret);
console.log('\n📋 Copy these values to your Render/Railway environment variables.');
console.log('⚠️  Keep these secrets secure - never commit them to git!\n');

