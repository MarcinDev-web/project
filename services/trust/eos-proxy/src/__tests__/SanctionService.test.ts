import { describe, expect, it } from 'vitest';
import { SanctionService } from '../SanctionService.js';

describe('SanctionService', () => {
  it('bans immediately when EOS reports lethal reason', () => {
    const service = new SanctionService();
    const decision = service.receiveEosEvent({
      ticketId: 'abc',
      playerId: 'cheater',
      severity: 'warn',
      reasons: ['speed_hack'],
    });
    expect(decision.action).toBe('ban');
  });

  it('escalates to review when input stats exceed threshold', () => {
    const service = new SanctionService({ inputRateThreshold: 100, aimVarianceFloor: 0.05 });
    const decision = service.receiveIntentStats({
      playerId: 'suspicious',
      inputsPerSecond: 200,
      aimVariance: 0.01,
    });
    expect(decision.action).toBe('review');
    expect(decision.score).toBeGreaterThan(30);
  });

  it('consumes reports and escalates after threshold', () => {
    const service = new SanctionService({ reportEscalation: 2 });
    service.fileReport({ playerId: 'griefer', reporterId: 'user1', reason: 'griefing' });
    const decision = service.fileReport({ playerId: 'griefer', reporterId: 'user2', reason: 'griefing' });
    expect(decision.action).toBe('review');
  });
});

