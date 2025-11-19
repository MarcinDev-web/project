import { describe, it, expect, vi } from 'vitest';
import { PvPScoreboard } from './PvPScoreboard';

describe('PvPScoreboard', () => {
  it('should register players', () => {
    const scoreboard = new PvPScoreboard();
    scoreboard.registerPlayer('p1', 'Player 1');
    scoreboard.registerPlayer('p2', 'Player 2');

    const stats = scoreboard.getAllStats();
    expect(stats).toHaveLength(2);
    expect(stats.find(s => s.id === 'p1')).toBeDefined();
    expect(stats.find(s => s.id === 'p2')).toBeDefined();
  });

  it('should record kills and deaths', () => {
    const scoreboard = new PvPScoreboard();
    scoreboard.registerPlayer('p1', 'Player 1');
    scoreboard.registerPlayer('p2', 'Player 2');

    scoreboard.recordKill('p1', 'p2');

    const p1Stats = scoreboard.getStats('p1');
    const p2Stats = scoreboard.getStats('p2');

    expect(p1Stats?.kills).toBe(1);
    expect(p1Stats?.score).toBe(100);
    expect(p2Stats?.deaths).toBe(1);
  });

  it('should record damage', () => {
    const scoreboard = new PvPScoreboard();
    scoreboard.registerPlayer('p1', 'Player 1');

    scoreboard.recordDamage('p1', 50);
    
    const p1Stats = scoreboard.getStats('p1');
    expect(p1Stats?.damageDealt).toBe(50);
  });

  it('should notify listeners on updates', () => {
    const scoreboard = new PvPScoreboard();
    scoreboard.registerPlayer('p1', 'Player 1');
    
    const listener = vi.fn();
    scoreboard.subscribe(listener);

    // Initial call
    expect(listener).toHaveBeenCalledTimes(1);

    scoreboard.recordDamage('p1', 10);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('should sort players by score', () => {
    const scoreboard = new PvPScoreboard();
    scoreboard.registerPlayer('p1', 'Player 1');
    scoreboard.registerPlayer('p2', 'Player 2');

    scoreboard.recordKill('p2', 'p1'); // p2 gets 100 score

    const stats = scoreboard.getAllStats();
    expect(stats[0].id).toBe('p2');
    expect(stats[1].id).toBe('p1');
  });
});

