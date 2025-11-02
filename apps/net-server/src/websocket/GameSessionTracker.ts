/**
 * Game Session Tracker - tracks active players in games
 */

export interface GameSession {
  gameId: string; // marketplace item ID
  players: Set<string>; // Set of userIds
  createdAt: number;
}

/**
 * Tracks active game sessions (players currently playing games).
 */
export class GameSessionTracker {
  private gameSessions = new Map<string, GameSession>(); // gameId -> GameSession
  private playerGames = new Map<string, string>(); // userId -> gameId

  /**
   * Join a game session (player starts playing).
   */
  joinGame(gameId: string, userId: string): void {
    let session = this.gameSessions.get(gameId);
    
    if (!session) {
      session = {
        gameId,
        players: new Set(),
        createdAt: Date.now(),
      };
      this.gameSessions.set(gameId, session);
    }

    session.players.add(userId);
    this.playerGames.set(userId, gameId);
  }

  /**
   * Leave a game session (player stops playing).
   */
  leaveGame(gameId: string, userId: string): void {
    const session = this.gameSessions.get(gameId);
    if (!session) {
      return;
    }

    session.players.delete(userId);
    this.playerGames.delete(userId);

    // Clean up empty sessions
    if (session.players.size === 0) {
      this.gameSessions.delete(gameId);
    }
  }

  /**
   * Leave game for a user (by userId, not gameId).
   */
  leaveGameByUser(userId: string): void {
    const gameId = this.playerGames.get(userId);
    if (gameId) {
      this.leaveGame(gameId, userId);
    }
  }

  /**
   * Get number of active players in a game.
   */
  getPlayerCount(gameId: string): number {
    const session = this.gameSessions.get(gameId);
    return session?.players.size ?? 0;
  }

  /**
   * Get list of player IDs in a game.
   */
  getPlayers(gameId: string): string[] {
    const session = this.gameSessions.get(gameId);
    return session ? Array.from(session.players) : [];
  }

  /**
   * Check if a user is playing a game.
   */
  isUserPlaying(userId: string): boolean {
    return this.playerGames.has(userId);
  }

  /**
   * Get game ID for a user.
   */
  getUserGame(userId: string): string | null {
    return this.playerGames.get(userId) ?? null;
  }

  /**
   * Get all game sessions with player counts.
   */
  getAllSessions(): Array<{ gameId: string; playerCount: number }> {
    return Array.from(this.gameSessions.entries()).map(([gameId, session]) => ({
      gameId,
      playerCount: session.players.size,
    }));
  }
}

