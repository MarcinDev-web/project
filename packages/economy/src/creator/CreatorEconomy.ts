/**
 * Creator Economy - Rewards for creators based on player engagement
 */

import { CurrencyManager, CurrencyWallet } from '../index';
import type { TelemetryCollector, TelemetryGameEvent } from '@engine/world-server';

/**
 * Creator reward configuration
 */
export interface CreatorRewardConfig {
  /** Base XP per player session (minutes) */
  xpPerSessionMinute: number;
  /** Bonus XP for time trial completions */
  xpPerTrialCompletion: number;
  /** Bonus XP for checkpoint activations */
  xpPerCheckpoint: number;
  /** Daily cap for XP (anti-farming) */
  dailyXpCap: number;
  /** Minimum unique players required for rewards */
  minUniquePlayers: number;
}

const DEFAULT_CONFIG: CreatorRewardConfig = {
  xpPerSessionMinute: 10,
  xpPerTrialCompletion: 50,
  xpPerCheckpoint: 5,
  dailyXpCap: 1000,
  minUniquePlayers: 3,
};

/**
 * Player session tracking
 */
interface PlayerSession {
  playerId: string;
  startTime: number;
  lastActivity: number;
  checkpoints: number;
  trialCompletions: number;
}

/**
 * Creator economy manager - calculates and distributes creator rewards
 */
export class CreatorEconomy {
  // currencyManager is used indirectly via creatorWallet
  private readonly config: CreatorRewardConfig;
  private readonly telemetry: TelemetryCollector;
  private readonly creatorWallet: CurrencyWallet;
  private readonly zoneId: string;
  // creatorId stored for potential future use in telemetry/logging
  // @ts-expect-error Reserved for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly _creatorId: string;

  /** Active player sessions */
  private readonly sessions = new Map<string, PlayerSession>();
  /** Today's XP earned */
  private dailyXpEarned = 0;
  /** Unique players today */
  private readonly uniquePlayersToday = new Set<string>();
  /** Last day tracked */
  private lastDay = new Date().getDate();

  constructor(
    currencyManager: CurrencyManager,
    creatorId: string,
    zoneId: string,
    telemetry: TelemetryCollector,
    config?: Partial<CreatorRewardConfig>
  ) {
    // Store currencyManager reference for potential future use
    void currencyManager;
    this._creatorId = creatorId;
    this.zoneId = zoneId;
    this.telemetry = telemetry;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create/get wallet for creator
    this.creatorWallet = currencyManager.createWallet(`creator_${creatorId}`);

    // Subscribe to telemetry events
    this.telemetry.on((event: TelemetryGameEvent) => this.handleTelemetryEvent(event));
  }

  /**
   * Handle telemetry events and calculate rewards
   */
  private handleTelemetryEvent(event: TelemetryGameEvent): void {
    // Reset daily tracking if new day
    const today = new Date().getDate();
    if (today !== this.lastDay) {
      this.dailyXpEarned = 0;
      this.uniquePlayersToday.clear();
      this.lastDay = today;
    }

    // Track unique players
    this.uniquePlayersToday.add(event.userId);

    switch (event.type) {
      case 'session:start':
        this.handleSessionStart(event.userId);
        break;
      case 'session:stop':
        this.handleSessionStop(event.userId, event.duration ?? 0);
        break;
      case 'checkpoint:activate':
        this.handleCheckpoint(event.userId);
        break;
      case 'trial:complete':
        this.handleTrialComplete(event.userId);
        break;
    }
  }

  private handleSessionStart(userId: string): void {
    if (this.sessions.has(userId)) return; // Already tracking

    this.sessions.set(userId, {
      playerId: userId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      checkpoints: 0,
      trialCompletions: 0,
    });
  }

  private handleSessionStop(userId: string, duration: number): void {
    const session = this.sessions.get(userId);
    if (!session) return;

    // Calculate XP from session time
    const minutes = Math.floor(duration / 60000);
    const sessionXp = minutes * this.config.xpPerSessionMinute;

    // Award XP if minimum players requirement met
    if (this.uniquePlayersToday.size >= this.config.minUniquePlayers) {
      this.awardXp(sessionXp);
    }

    this.sessions.delete(userId);
  }

  private handleCheckpoint(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.checkpoints++;
      session.lastActivity = Date.now();

      // Award checkpoint bonus
      if (this.uniquePlayersToday.size >= this.config.minUniquePlayers) {
        this.awardXp(this.config.xpPerCheckpoint);
      }
    }
  }

  private handleTrialComplete(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.trialCompletions++;
      session.lastActivity = Date.now();

      // Award trial completion bonus
      if (this.uniquePlayersToday.size >= this.config.minUniquePlayers) {
        this.awardXp(this.config.xpPerTrialCompletion);
      }
    }
  }

  /**
   * Award XP (respecting daily cap and anti-farming)
   */
  private awardXp(amount: number): void {
    // Check daily cap
    if (this.dailyXpEarned >= this.config.dailyXpCap) {
      return; // Cap reached
    }

    const remaining = this.config.dailyXpCap - this.dailyXpEarned;
    const toAward = Math.min(amount, remaining);

    // Award to creator wallet
    this.creatorWallet.deposit(
      { currency: 'xp', amount: toAward },
      `Creator reward: ${this.zoneId}`
    );

    this.dailyXpEarned += toAward;
  }

  /**
   * Get creator's current XP balance
   */
  getCreatorXp(): number {
    return this.creatorWallet.balance('xp');
  }

  /**
   * Get today's statistics
   */
  getTodayStats(): {
    uniquePlayers: number;
    xpEarned: number;
    activeSessions: number;
  } {
    return {
      uniquePlayers: this.uniquePlayersToday.size,
      xpEarned: this.dailyXpEarned,
      activeSessions: this.sessions.size,
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.sessions.clear();
    this.uniquePlayersToday.clear();
  }
}

