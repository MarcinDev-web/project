import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { app, authManager } from '../../server';

describe('Auth API', () => {
  const email = `auth_test_${Date.now()}@example.com`;
  const password = 'StrongPass1';

  beforeAll(async () => {
    // Ensure auth subsystems are initialized
    await authManager.initialize();
  });

  it('registers, logs in, returns current user, refreshes, and logs out (revokes tokens)', async () => {
    // Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);

    expect(registerRes.body.user.email).toBe(email.toLowerCase());
    expect(typeof registerRes.body.session.token).toBe('string');
    expect(typeof registerRes.body.session.refreshToken).toBe('string');

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const token1: string = loginRes.body.session.token;
    const refresh1: string = loginRes.body.session.refreshToken;
    expect(token1).toBeTruthy();
    expect(refresh1).toBeTruthy();

    // Get current user
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(meRes.body?.id).toBe(registerRes.body.user.id);
    expect(meRes.body?.email).toBe(registerRes.body.user.email);

    // Refresh token (rotation should occur)
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh1 })
      .expect(200);

    const token2: string = refreshRes.body.session.token;
    const refresh2: string = refreshRes.body.session.refreshToken;
    expect(token2).toBeTruthy();
    expect(refresh2).toBeTruthy();
    expect(token2).not.toBe(token1);

    // Old refresh token should be revoked after rotation
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh1 })
      .expect(401);

    // Logout should revoke both access and refresh tokens
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token2}`)
      .send({ refreshToken: refresh2 })
      .expect(200);

    // Access with revoked access token should now fail
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token2}`)
      .expect(401);
  });

  it('enforces admin-only access and respects role changes', async () => {
    // Register a fresh user
    const email2 = `auth_admin_${Date.now()}@example.com`;
    const password2 = 'StrongPass2';
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: email2, password: password2 })
      .expect(201);

    const tokenUser: string = reg.body.session.token;
    const userId: string = reg.body.user.id;

    // Non-admin should be forbidden
    await request(app)
      .get('/api/admin/admin/users')
      .set('Authorization', `Bearer ${tokenUser}`)
      .expect(403);

    // Promote to admin directly via storage
    await (authManager as unknown as { userStorage: { updateUserById: Function } }).userStorage.updateUserById(
      userId,
      { role: 'admin' }
    );

    // Same token should now have admin privileges (role checked from storage)
    await request(app)
      .get('/api/admin/admin/users')
      .set('Authorization', `Bearer ${tokenUser}`)
      .expect(200);
  });
  it('rejects weak passwords on registration', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: `weak_${Date.now()}@example.com`, password: 'weakpass' })
      .expect(400);
  });
});


