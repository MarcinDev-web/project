// Note: Fastify inject is built-in, no need to import light-my-request
import { describe, it, expect, beforeAll } from 'vitest';
import { app, authManager } from '../../server.js';

describe('Auth API', () => {
  const email = `auth_test_${Date.now()}@example.com`;
  const password = 'StrongPass1';

  beforeAll(async () => {
    // Ensure auth subsystems are initialized
    await authManager.initialize();
    // Ensure app is ready
    await app.ready();
  });

  it('registers, logs in, returns current user, refreshes, and logs out (revokes tokens)', async () => {
    // Register
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password },
    });
    expect(registerRes.statusCode).toBe(201);

    const registerBody = JSON.parse(registerRes.body);
    expect(registerBody.user.email).toBe(email.toLowerCase());
    expect(typeof registerBody.session.token).toBe('string');
    expect(typeof registerBody.session.refreshToken).toBe('string');

    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);

    const loginBody = JSON.parse(loginRes.body);
    const token1: string = loginBody.session.token;
    const refresh1: string = loginBody.session.refreshToken;
    expect(token1).toBeTruthy();
    expect(refresh1).toBeTruthy();

    // Get current user
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${token1}` },
    });
    expect(meRes.statusCode).toBe(200);

    const meBody = JSON.parse(meRes.body);
    expect(meBody?.id).toBe(registerBody.user.id);
    expect(meBody?.email).toBe(registerBody.user.email);

    // Refresh token (rotation should occur)
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: refresh1 },
    });
    expect(refreshRes.statusCode).toBe(200);

    const refreshBody = JSON.parse(refreshRes.body);
    const token2: string = refreshBody.session.token;
    const refresh2: string = refreshBody.session.refreshToken;
    expect(token2).toBeTruthy();
    expect(refresh2).toBeTruthy();
    expect(token2).not.toBe(token1);

    // Old refresh token should be revoked after rotation
    const oldRefreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: refresh1 },
    });
    expect(oldRefreshRes.statusCode).toBe(401);

    // Logout should revoke both access and refresh tokens
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { Authorization: `Bearer ${token2}` },
      payload: { refreshToken: refresh2 },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Access with revoked access token should now fail
    const revokedRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(revokedRes.statusCode).toBe(401);
  });

  it('enforces admin-only access and respects role changes', async () => {
    // Register a fresh user
    const email2 = `auth_admin_${Date.now()}@example.com`;
    const password2 = 'StrongPass2';
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: email2, password: password2 },
    });
    expect(reg.statusCode).toBe(201);

    const regBody = JSON.parse(reg.body);
    const tokenUser: string = regBody.session.token;
    const userId: string = regBody.user.id;

    // Non-admin should be forbidden
    const forbiddenRes = await app.inject({
      method: 'GET',
      url: '/api/admin/admin/users',
      headers: { Authorization: `Bearer ${tokenUser}` },
    });
    expect(forbiddenRes.statusCode).toBe(403);

    // Promote to admin directly via storage
    await (authManager as unknown as { userStorage: { updateUserById: Function } }).userStorage.updateUserById(
      userId,
      { role: 'admin' }
    );

    // Same token should now have admin privileges (role checked from storage)
    const adminRes = await app.inject({
      method: 'GET',
      url: '/api/admin/admin/users',
      headers: { Authorization: `Bearer ${tokenUser}` },
    });
    expect(adminRes.statusCode).toBe(200);
  });
  it('rejects weak passwords on registration', async () => {
    const weakRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `weak_${Date.now()}@example.com`, password: 'weakpass' },
    });
    expect(weakRes.statusCode).toBe(400);
  });
});



