# Security Documentation

This document describes the comprehensive security measures implemented in the UGC 3D Platform.

## Overview

The platform implements a defense-in-depth security strategy with multiple layers of protection across authentication, authorization, network security, input validation, and monitoring.

## Security Features Implemented

### 1. Authentication & Authorization

#### Password Security
- **BCrypt Hashing**: Passwords are hashed using bcrypt with 12 rounds (configurable via `BCRYPT_ROUNDS`)
- **Password Strength Validation**: Enforces minimum 8 characters, uppercase, and digits
- **Account Lockout**: Accounts are locked for 15 minutes after 5 failed login attempts

#### Token Management
- **Short-lived Access Tokens**: Access tokens expire in 15 minutes (configurable)
- **Long-lived Refresh Tokens**: Refresh tokens expire in 7 days
- **Token Rotation**: Refresh tokens are rotated on each use (old token revoked)
- **Persistent Token Blacklist**: Revoked tokens are stored persistently (database or file) across server restarts
- **Token Revocation**: Supports immediate token revocation on logout

#### Session Management
- **Automatic Timeout**: Sessions timeout after inactivity
- **Session Validation**: Tokens validated on each request
- **Concurrent Session Limits**: Implementation ready for session limits per user

### 2. Network & Transport Security

#### Security Headers
All responses include comprehensive security headers:
- **Content-Security-Policy (CSP)**: Restricts resource loading and prevents XSS
- **X-Frame-Options: DENY**: Prevents clickjacking
- **X-Content-Type-Options: nosniff**: Prevents MIME type sniffing
- **Referrer-Policy**: Limits referrer information leakage
- **Permissions-Policy**: Restricts browser feature access
- **Strict-Transport-Security (HSTS)**: Forces HTTPS in production
- **X-XSS-Protection**: Legacy XSS protection

#### HTTPS/TLS Enforcement
- Production environment automatically redirects HTTP to HTTPS
- Warnings for insecure database connections in production

#### CORS Hardening
- Whitelist-based origin validation (no wildcards)
- Restricted HTTP methods and headers
- Preflight caching (24 hours)
- Credentials support for authenticated requests

#### WebSocket Security
- **Rate Limiting**: Maximum 5 connections per IP
- **Message Size Limits**: 1MB maximum message size
- **Connection Timeouts**: 30-minute inactivity timeout
- **Message Validation**: JSON structure validation
- **IP Tracking**: Connections tracked by IP for abuse detection

### 3. Input Validation & Sanitization

#### Request Validation
- **Centralized Validation**: All inputs validated before processing
- **Type Checking**: Strict type validation for all inputs
- **Size Limits**: Request body size limits (50MB for projects)
- **Schema Validation**: JSON schema validation for structured data

#### File Upload Security
- **MIME Type Detection**: Magic bytes validation for file types
- **File Type Whitelist**: Only allowed file types accepted
- **Size Limits**: Per-file-type size limits
- **Filename Sanitization**: Prevents path traversal attacks
- **Secure Filenames**: Random secure filenames for stored files

#### XSS Prevention
- **DOMPurify**: HTML sanitization using isomorphic-dompurify
- **Content Security Policy**: Prevents inline script execution
- **Output Escaping**: All user-generated content escaped

### 4. Rate Limiting & DoS Protection

#### Rate Limiters
- **Authentication Endpoints**: 5 requests per 15 minutes
- **Economy Endpoints**: 20 requests per minute
- **Marketplace Publishing**: 5 publishes per 15 minutes
- **Configurable Limits**: All limits configurable via environment variables

#### DoS Protection
- **Request Size Limits**: Per-endpoint request size limits
- **Connection Limits**: WebSocket connection limits per IP
- **Timeout Configuration**: Configurable timeouts for long-running operations
- **Connection Cleanup**: Automatic cleanup of inactive connections

### 5. Security Logging & Monitoring

#### Security Event Types
- Authentication attempts (success/failure)
- Account lockouts
- Token revocation and refresh
- Rate limit violations
- Suspicious activity
- Sensitive operations
- Privilege escalations

#### Logging Features
- **Structured Logging**: All security events logged with context
- **IP and User Agent Tracking**: Request metadata captured
- **In-Memory Buffer**: Last 1000 events kept in memory
- **Extensible**: Ready for integration with external logging services

### 6. Secrets & Configuration Management

#### Environment Variables
- **Validation on Startup**: All configuration validated before server starts
- **Secure Defaults**: Production environment requires explicit secrets
- **No Hardcoded Secrets**: All secrets come from environment variables
- **Configuration Warnings**: Warnings for insecure configurations

#### Database Security
- **Connection Pooling**: Limited pool size (max 20 connections)
- **Connection Timeouts**: 5-second connection timeout
- **SSL/TLS**: Warnings for non-SSL database connections in production
- **Parameterized Queries**: All queries use parameterized statements

### 7. CSRF Protection

CSRF middleware implemented (ready for integration):
- **Double Submit Cookie Pattern**: CSRF token in both cookie and header
- **Token Validation**: Tokens validated for state-changing operations
- **Secure Cookies**: HttpOnly and SameSite attributes

## Security Configuration

### Environment Variables

#### Required (Production)
- `JWT_SECRET`: Minimum 32 characters, high entropy
- `JWT_REFRESH_SECRET`: Separate secret for refresh tokens
- `DATABASE_URL`: Must include `sslmode=require` for production

#### Optional (with secure defaults)
- `BCRYPT_ROUNDS`: Default 12 (recommended 12-14)
- `JWT_EXPIRES_IN`: Default '15m' (access tokens)
- `JWT_REFRESH_EXPIRES_IN`: Default '7d' (refresh tokens)
- `AUTH_RATE_LIMIT_MAX`: Default 5
- `ECONOMY_RATE_LIMIT_MAX`: Default 20

### Configuration Validation

On server startup, configuration is validated:
- JWT secret strength
- Database URL SSL requirement (production)
- CORS origin configuration
- Rate limit settings

## Security Best Practices

### For Developers

1. **Never commit secrets**: Use environment variables or secret management services
2. **Validate all inputs**: Use validation schemas for all user inputs
3. **Log security events**: Use `securityLogger` for all security-related operations
4. **Use parameterized queries**: Never concatenate user input into SQL queries
5. **Sanitize file uploads**: Always validate file type and content
6. **Follow principle of least privilege**: Grant minimum necessary permissions

### For Operations

1. **Use strong secrets**: Generate secrets with `openssl rand -base64 32`
2. **Enable HTTPS**: Use reverse proxy (Nginx, Cloudflare) with SSL certificates
3. **Monitor security logs**: Set up alerts for suspicious activities
4. **Regular updates**: Keep dependencies updated
5. **Database backups**: Encrypted backups with regular rotation
6. **Network segmentation**: Isolate database from public network

## Security Testing

### Manual Testing Checklist

- [ ] Attempt brute force login (should lockout after 5 attempts)
- [ ] Test token revocation (logout should invalidate tokens)
- [ ] Verify HTTPS redirect in production
- [ ] Test CORS with unauthorized origin (should reject)
- [ ] Upload malicious file (should reject)
- [ ] Test rate limiting (should reject after limit)
- [ ] Verify security headers in response
- [ ] Test WebSocket connection limits

### Automated Testing

Security features are tested in:
- Authentication tests (`apps/net-server/src/__tests__/`)
- WebSocket security tests
- Validation tests

## Incident Response

### Security Event Alerts

Monitor these security events:
1. Multiple failed login attempts from same IP
2. Account lockouts
3. Rate limit violations
4. Suspicious WebSocket activity
5. Token revocation spikes

### Response Procedures

1. **Brute Force Attack**: IP-based rate limiting will automatically block
2. **Account Compromise**: Revoke all user tokens
3. **Data Breach**: Immediately rotate all secrets, notify users
4. **DoS Attack**: Review rate limits, consider DDoS protection service

## Compliance

### GDPR Compliance
- User data deletion endpoints (to be implemented)
- Data export endpoints (to be implemented)
- Privacy policy endpoints (to be implemented)

### Data Protection
- Passwords never logged
- Sensitive data encrypted at rest (when database encryption enabled)
- User data anonymized in logs

## Future Security Enhancements

### Planned Features
- [ ] Two-Factor Authentication (2FA/MFA)
- [ ] Password history (prevent reuse)
- [ ] Session timeout configuration
- [ ] Advanced threat detection
- [ ] Security dashboard
- [ ] Automated security scanning
- [ ] Penetration testing automation

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated**: 2025-01-XX  
**Maintained By**: Security Team

