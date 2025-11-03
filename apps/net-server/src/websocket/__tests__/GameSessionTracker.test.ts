/**
 * Tests for GameSessionTracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameSessionTracker } from '../GameSessionTracker';

describe('GameSessionTracker', () => {
  let tracker: GameSessionTracker;

  beforeEach(() => {
    tracker = new GameSessionTracker();
  });

  describe('joinGame', () => {
    it('adds player to game session', () => {
      tracker.joinGame('game1', 'user1');
      const count = tracker.getPlayerCount('game1');
      expect(count).toBe(1);
    });

    it('creates new session if it does not exist', () => {
      tracker.joinGame('game1', 'user1');
      const players = tracker.getPlayers('game1');
      expect(players).toContain('user1');
    });

    it('adds multiple players to same game', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user2');
      tracker.joinGame('game1', 'user3');

      const count = tracker.getPlayerCount('game1');
      expect(count).toBe(3);

      const players = tracker.getPlayers('game1');
      expect(players).toContain('user1');
      expect(players).toContain('user2');
      expect(players).toContain('user3');
    });

    it('handles same player joining multiple times', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user1');

      const count = tracker.getPlayerCount('game1');
      expect(count).toBe(1); // Set prevents duplicates
    });

    it('tracks different games separately', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user2');
      tracker.joinGame('game2', 'user3'); // Different user, not user1
      tracker.joinGame('game2', 'user4');

      expect(tracker.getPlayerCount('game1')).toBe(2);
      expect(tracker.getPlayerCount('game2')).toBe(2);
    });
  });

  describe('leaveGame', () => {
    it('removes player from game session', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user2');

      tracker.leaveGame('game1', 'user1');

      const count = tracker.getPlayerCount('game1');
      expect(count).toBe(1);

      const players = tracker.getPlayers('game1');
      expect(players).not.toContain('user1');
      expect(players).toContain('user2');
    });

    it('does nothing if game does not exist', () => {
      expect(() => {
        tracker.leaveGame('nonexistent', 'user1');
      }).not.toThrow();
    });

    it('does nothing if player not in game', () => {
      tracker.joinGame('game1', 'user1');
      tracker.leaveGame('game1', 'user2'); // user2 not in game

      expect(tracker.getPlayerCount('game1')).toBe(1);
    });

    it('cleans up empty sessions', () => {
      tracker.joinGame('game1', 'user1');
      tracker.leaveGame('game1', 'user1');

      const count = tracker.getPlayerCount('game1');
      expect(count).toBe(0);

      const players = tracker.getPlayers('game1');
      expect(players).toEqual([]);
    });
  });

  describe('leaveGameByUser', () => {
    it('removes user from their game', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user2');
      tracker.joinGame('game2', 'user1');

      tracker.leaveGameByUser('user1');

      expect(tracker.getPlayerCount('game1')).toBe(1);
      expect(tracker.getPlayerCount('game2')).toBe(0);
      expect(tracker.isUserPlaying('user1')).toBe(false);
    });

    it('does nothing if user not playing', () => {
      expect(() => {
        tracker.leaveGameByUser('nonexistent');
      }).not.toThrow();
    });
  });

  describe('getPlayerCount', () => {
    it('returns 0 for non-existent game', () => {
      const count = tracker.getPlayerCount('nonexistent');
      expect(count).toBe(0);
    });

    it('returns correct count for game with players', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user2');
      tracker.joinGame('game1', 'user3');

      expect(tracker.getPlayerCount('game1')).toBe(3);
    });

    it('returns 0 after all players leave', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user2');
      tracker.leaveGame('game1', 'user1');
      tracker.leaveGame('game1', 'user2');

      expect(tracker.getPlayerCount('game1')).toBe(0);
    });
  });

  describe('getPlayers', () => {
    it('returns empty array for non-existent game', () => {
      const players = tracker.getPlayers('nonexistent');
      expect(players).toEqual([]);
    });

    it('returns list of player IDs', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user2');
      tracker.joinGame('game1', 'user3');

      const players = tracker.getPlayers('game1');
      expect(players).toHaveLength(3);
      expect(players).toContain('user1');
      expect(players).toContain('user2');
      expect(players).toContain('user3');
    });

    it('returns empty array after cleanup', () => {
      tracker.joinGame('game1', 'user1');
      tracker.leaveGame('game1', 'user1');

      const players = tracker.getPlayers('game1');
      expect(players).toEqual([]);
    });
  });

  describe('isUserPlaying', () => {
    it('returns true if user is playing', () => {
      tracker.joinGame('game1', 'user1');
      expect(tracker.isUserPlaying('user1')).toBe(true);
    });

    it('returns false if user is not playing', () => {
      expect(tracker.isUserPlaying('user1')).toBe(false);
    });

    it('returns false after user leaves', () => {
      tracker.joinGame('game1', 'user1');
      tracker.leaveGame('game1', 'user1');
      expect(tracker.isUserPlaying('user1')).toBe(false);
    });
  });

  describe('getUserGame', () => {
    it('returns game ID if user is playing', () => {
      tracker.joinGame('game1', 'user1');
      expect(tracker.getUserGame('user1')).toBe('game1');
    });

    it('returns null if user is not playing', () => {
      expect(tracker.getUserGame('user1')).toBeNull();
    });

    it('returns null after user leaves', () => {
      tracker.joinGame('game1', 'user1');
      tracker.leaveGame('game1', 'user1');
      expect(tracker.getUserGame('user1')).toBeNull();
    });
  });

  describe('getAllSessions', () => {
    it('returns empty array when no sessions', () => {
      const sessions = tracker.getAllSessions();
      expect(sessions).toEqual([]);
    });

    it('returns all game sessions with player counts', () => {
      tracker.joinGame('game1', 'user1');
      tracker.joinGame('game1', 'user2');
      tracker.joinGame('game2', 'user3');
      tracker.joinGame('game3', 'user4');
      tracker.joinGame('game3', 'user5');
      tracker.joinGame('game3', 'user6');

      const sessions = tracker.getAllSessions();
      expect(sessions.length).toBe(3);

      const game1 = sessions.find(s => s.gameId === 'game1');
      const game2 = sessions.find(s => s.gameId === 'game2');
      const game3 = sessions.find(s => s.gameId === 'game3');

      expect(game1?.playerCount).toBe(2);
      expect(game2?.playerCount).toBe(1);
      expect(game3?.playerCount).toBe(3);
    });

    it('does not include empty sessions', () => {
      tracker.joinGame('game1', 'user1');
      tracker.leaveGame('game1', 'user1');

      const sessions = tracker.getAllSessions();
      expect(sessions.length).toBe(0);
    });
  });
});
