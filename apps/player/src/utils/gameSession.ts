import { Logger } from '../utils/logger';

/**
 * Game session data
 */
export interface GameSessionData {
  buildId: string;
  sessionId: string;
  playerCount: number;
  startedAt: number;
}

/**
 * GameSession manages session tracking and API integration
 */
export class GameSession {
  private buildId: string | null = null;
  private sessionId: string | null = null;
  private isActive = false;

  /**
   * Join game session
   */
  async join(buildId: string): Promise<void> {
    if (this.isActive) {
      Logger.warn('[GameSession] Already in a session');
      return;
    }

    try {
      const response = await fetch(`/api/marketplace/${buildId}/join`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to join game: ${response.statusText}`);
      }

      const data = (await response.json()) as { success?: boolean; playersOnline?: number };
      
      this.buildId = buildId;
      this.isActive = true;
      
      Logger.info(`[GameSession] Joined game session for build ${buildId}`);
    } catch (error) {
      Logger.error('[GameSession] Failed to join session:', error as unknown as Error);
      throw error;
    }
  }

  /**
   * Leave game session
   */
  async leave(): Promise<void> {
    if (!this.isActive || !this.buildId) {
      return;
    }

    try {
      await fetch(`/api/marketplace/${this.buildId}/leave`, {
        method: 'POST',
        credentials: 'include',
      });

      Logger.info(`[GameSession] Left game session for build ${this.buildId}`);
    } catch (error) {
      Logger.warn('[GameSession] Failed to leave session:', error as unknown as Error);
    } finally {
      this.buildId = null;
      this.sessionId = null;
      this.isActive = false;
    }
  }

  /**
   * Get current session data
   */
  async getSessionData(): Promise<GameSessionData | null> {
    if (!this.buildId) {
      return null;
    }

    try {
      const response = await fetch(`/api/marketplace/${this.buildId}/session`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as GameSessionData;
      this.sessionId = data.sessionId;
      return data;
    } catch (error) {
      Logger.warn('[GameSession] Failed to get session data:', error as unknown as Error);
      return null;
    }
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current build ID
   */
  getBuildId(): string | null {
    return this.buildId;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.isActive) {
      void this.leave();
    }
  }
}

