/**
 * Integration tests for Studio progress & monetization endpoints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { AuthManager } from '../../auth/AuthManager';
import { createTestUser } from '../helpers/testHelpers';

describe('Studio Progress & Monetization API', () => {
  let authManager: AuthManager;
  let user: { userId: string; email: string; token: string };

  beforeEach(async () => {
    // Reuse helper similar to other tests
    // AuthManager uses temp data dir by default if not provided in server
    authManager = new AuthManager();
    await authManager.initialize();

    user = await createTestUser(authManager);
  });

  it('GET /api/studio/settings returns defaults for new user', async () => {
    const res = await request(app)
      .get('/api/studio/settings')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.userId).toBe(user.userId);
    expect(['games', 'assets', 'balanced']).toContain(res.body.focus);
    expect(typeof res.body.cadenceTarget).toBe('number');
  });

  it('PUT /api/studio/settings updates focus and goals', async () => {
    const res = await request(app)
      .put('/api/studio/settings')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ focus: 'assets', goals: { monthlyRevenueTarget: 100 }, cadenceTarget: 3 })
      .expect(200);

    expect(res.body.focus).toBe('assets');
    expect(res.body.goals?.monthlyRevenueTarget).toBe(100);
    expect(res.body.cadenceTarget).toBe(3);
  });

  it('GET /api/studio/revenue requires auth', async () => {
    await request(app).get('/api/studio/revenue').expect(401);
  });

  it('GET /api/studio/revenue returns aggregates', async () => {
    const res = await request(app)
      .get('/api/studio/revenue?period=month')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body).toHaveProperty('gross');
    expect(res.body).toHaveProperty('platformFee');
    expect(res.body).toHaveProperty('net');
    expect(Array.isArray(res.body.topItems)).toBe(true);
    expect(Array.isArray(res.body.trend)).toBe(true);
  });

  it('GET /api/studio/score returns score and breakdown', async () => {
    const res = await request(app)
      .get('/api/studio/score')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(typeof res.body.score).toBe('number');
    expect(res.body.breakdown).toBeDefined();
  });

  it('GET /api/studio/insights returns an array', async () => {
    const res = await request(app)
      .get('/api/studio/insights')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(Array.isArray(res.body.insights)).toBe(true);
  });
});


