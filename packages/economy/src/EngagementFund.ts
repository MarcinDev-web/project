import { EventBus } from '@engine/core/event';
import type { IDisposable } from '@engine/core/utils';
import { DisposableGroup } from '@engine/core/utils';
import type { CurrencyAmount, CreatorId, GameId } from './types';
import { PLATFORM_CURRENCY } from './types';
import { CurrencyManager } from './CurrencyManager';
import { CurrencyWallet } from './CurrencyWallet';
import { AntiP2WCompliance } from './AntiP2WCompliance';

/**
 * Engagement metrics for a game
 */
export interface EngagementMetrics {
  gameId: GameId;
  creatorId: CreatorId;
  /** Total play time (minutes) */
  totalPlayTime: number;
  /** Unique players */
  uniquePlayers: number;
  /** Return rate (0-1) */
  returnRate: number;
  /** Party play sessions */
  partyPlaySessions: number;
  /** Fair play score (0-1) - based on compliance */
  fairPlayScore: number;
  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Engagement fund configuration
 */
export interface EngagementFundConfig {
  /** Base reward per minute of play time */
  baseRewardPerMinute: number;
  /** Bonus multiplier for unique players */
  uniquePlayerMultiplier: number;
  /** Bonus multiplier for return rate */
  returnRateMultiplier: number;
  /** Bonus multiplier for party play */
  partyPlayMultiplier: number;
  /** Fair play bonus multiplier */
  fairPlayMultiplier: number;
  /** Minimum fair play score to qualify */
  minFairPlayScore: number;
  /** Distribution period (milliseconds) - e.g., monthly */
  distributionPeriod: number;
  /** Optional logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Fund distribution result
 */
export interface DistributionResult {
  gameId: GameId;
  creatorId: CreatorId;
  amount: CurrencyAmount;
  metrics: EngagementMetrics;
  timestamp: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EngagementFundConfig = {
  baseRewardPerMinute: 0.1, // 0.1 coins per minute
  uniquePlayerMultiplier: 1.5, // 50% bonus for unique players
  returnRateMultiplier: 2.0, // 100% bonus for high return rate
  partyPlayMultiplier: 1.3, // 30% bonus for party play
  fairPlayMultiplier: 1.2, // 20% bonus for fair play
  minFairPlayScore: 0.8, // Minimum 80% fair play score
  distributionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
};

/**
 * Engagement Fund - distributes coins to creators based on player engagement.
 * Rewards fair play, retention, and social gameplay.
 */
export class EngagementFund implements IDisposable {
  private readonly metrics = new Map<GameId, EngagementMetrics>();
  private readonly currencyManager: CurrencyManager;
  // @ts-expect-error Reserved for future use
  private readonly _compliance: AntiP2WCompliance;
  // @ts-expect-error Reserved for future use
  private readonly _eventBus: EventBus;
  private readonly disposables: DisposableGroup;
  private disposed = false;

  private readonly config: EngagementFundConfig;
  private readonly fundWallet: CurrencyWallet;
  private lastDistributionTime = Date.now();

  constructor(
    currencyManager: CurrencyManager,
    compliance: AntiP2WCompliance,
    eventBus: EventBus,
    fundWallet: CurrencyWallet,
    config: Partial<EngagementFundConfig> = {}
  ) {
    this.currencyManager = currencyManager;
    this._compliance = compliance;
    this._eventBus = eventBus;
    this.disposables = new DisposableGroup();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fundWallet = fundWallet;

    this.config.logger = this.config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
  }

  /**
   * Updates engagement metrics for a game.
   */
  updateMetrics(gameId: GameId, metrics: Partial<EngagementMetrics>): void {
    this.ensureNotDisposed();

    const existing = this.metrics.get(gameId);
    const updated: EngagementMetrics = {
      gameId,
      creatorId: metrics.creatorId ?? existing?.creatorId ?? '',
      totalPlayTime: metrics.totalPlayTime ?? existing?.totalPlayTime ?? 0,
      uniquePlayers: metrics.uniquePlayers ?? existing?.uniquePlayers ?? 0,
      returnRate: metrics.returnRate ?? existing?.returnRate ?? 0,
      partyPlaySessions: metrics.partyPlaySessions ?? existing?.partyPlaySessions ?? 0,
      fairPlayScore: metrics.fairPlayScore ?? existing?.fairPlayScore ?? 1.0,
      lastUpdated: Date.now(),
    };

    this.metrics.set(gameId, updated);
    this.config.logger?.debug(`Metrics updated for game: ${gameId}`);
  }

  /**
   * Calculates reward amount for a game based on engagement metrics.
   */
  calculateReward(gameId: GameId): CurrencyAmount | null {
    this.ensureNotDisposed();

    const metrics = this.metrics.get(gameId);
    if (!metrics) {
      return null;
    }

    // Check fair play score
    if (metrics.fairPlayScore < this.config.minFairPlayScore) {
      this.config.logger?.debug(
        `Game ${gameId} does not meet minimum fair play score: ${metrics.fairPlayScore} < ${this.config.minFairPlayScore}`
      );
      return null;
    }

    // Base reward from play time
    let reward = metrics.totalPlayTime * this.config.baseRewardPerMinute;

    // Apply multipliers
    if (metrics.uniquePlayers > 0) {
      reward *= this.config.uniquePlayerMultiplier;
    }

    if (metrics.returnRate > 0.5) {
      // High return rate bonus
      reward *= this.config.returnRateMultiplier;
    }

    if (metrics.partyPlaySessions > 0) {
      reward *= this.config.partyPlayMultiplier;
    }

    // Fair play bonus
    if (metrics.fairPlayScore >= 0.9) {
      reward *= this.config.fairPlayMultiplier;
    }

    // Penalize games that force retention through paywalls
    // (This would be detected through telemetry - simplified here)
    if (metrics.fairPlayScore < 0.85) {
      reward *= 0.5; // 50% penalty
    }

    return {
      currency: PLATFORM_CURRENCY,
      amount: Math.floor(reward),
    };
  }

  /**
   * Distributes engagement fund to all qualifying games.
   * Should be called periodically (e.g., monthly).
   */
  distributeFund(): DistributionResult[] {
    this.ensureNotDisposed();

    const now = Date.now();
    const timeSinceLastDistribution = now - this.lastDistributionTime;

    if (timeSinceLastDistribution < this.config.distributionPeriod) {
      this.config.logger?.warn(
        `Distribution period not reached. Time since last: ${timeSinceLastDistribution}ms, required: ${this.config.distributionPeriod}ms`
      );
      return [];
    }

    const results: DistributionResult[] = [];
    const fundBalance = this.fundWallet.balance(PLATFORM_CURRENCY);

    if (fundBalance <= 0) {
      this.config.logger?.warn('Engagement fund is empty');
      return results;
    }

    // Calculate rewards for all games
    const rewards = new Map<GameId, CurrencyAmount>();
    let totalRewards = 0;

    for (const [gameId] of this.metrics.entries()) {
      const reward = this.calculateReward(gameId);
      if (reward && reward.amount > 0) {
        rewards.set(gameId, reward);
        totalRewards += reward.amount;
      }
    }

    if (totalRewards === 0) {
      this.config.logger?.debug('No qualifying games for engagement fund distribution');
      this.lastDistributionTime = now;
      return results;
    }

    // Scale rewards if total exceeds fund balance
    let scaleFactor = 1.0;
    if (totalRewards > fundBalance) {
      scaleFactor = fundBalance / totalRewards;
      this.config.logger?.warn(
        `Rewards exceed fund balance. Scaling by ${scaleFactor.toFixed(2)}`
      );
    }

    // Distribute rewards
    for (const [gameId, reward] of rewards.entries()) {
      const metrics = this.metrics.get(gameId)!;
      const scaledAmount = Math.floor(reward.amount * scaleFactor);

      if (scaledAmount <= 0) {
        continue;
      }

      // Check fund balance
      const currentBalance = this.fundWallet.balance(PLATFORM_CURRENCY);
      if (currentBalance < scaledAmount) {
        this.config.logger?.warn(
          `Insufficient fund balance for game ${gameId}. Need ${scaledAmount}, have ${currentBalance}`
        );
        break;
      }

      // Withdraw from fund wallet
      try {
        this.fundWallet.withdraw(
          { currency: PLATFORM_CURRENCY, amount: scaledAmount },
          `Engagement fund distribution: ${gameId}`
        );
      } catch (error) {
        this.config.logger?.error(
          `Failed to withdraw from fund for game ${gameId}`,
          error instanceof Error ? error : undefined
        );
        continue;
      }

      // Pay creator
      const creatorWalletId = `creator_${metrics.creatorId}`;
      let creatorWallet = this.currencyManager.getWallet(creatorWalletId);
      if (!creatorWallet) {
        creatorWallet = this.currencyManager.createWallet(creatorWalletId);
      }

      creatorWallet.deposit(
        { currency: PLATFORM_CURRENCY, amount: scaledAmount },
        `Engagement fund reward: ${gameId}`
      );

      const result: DistributionResult = {
        gameId,
        creatorId: metrics.creatorId,
        amount: { currency: PLATFORM_CURRENCY, amount: scaledAmount },
        metrics: { ...metrics },
        timestamp: now,
      };

      results.push(result);
      this.config.logger?.debug(
        `Distributed ${scaledAmount} coins to creator ${metrics.creatorId} for game ${gameId}`
      );
    }

    // Reset metrics after distribution
    this.resetMetrics();

    this.lastDistributionTime = now;
    this.config.logger?.debug(`Engagement fund distributed to ${results.length} creators`);

    return results;
  }

  /**
   * Gets engagement metrics for a game.
   */
  getMetrics(gameId: GameId): EngagementMetrics | null {
    this.ensureNotDisposed();
    return this.metrics.get(gameId) ?? null;
  }

  /**
   * Gets all engagement metrics.
   */
  getAllMetrics(): EngagementMetrics[] {
    this.ensureNotDisposed();
    return Array.from(this.metrics.values());
  }

  /**
   * Gets current fund balance.
   */
  getFundBalance(): number {
    this.ensureNotDisposed();
    return this.fundWallet.balance(PLATFORM_CURRENCY);
  }

  /**
   * Resets metrics (called after distribution).
   */
  private resetMetrics(): void {
    for (const metrics of this.metrics.values()) {
      metrics.totalPlayTime = 0;
      metrics.uniquePlayers = 0;
      metrics.returnRate = 0;
      metrics.partyPlaySessions = 0;
      // Keep fair play score and creator ID
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.disposables.dispose();
    this.metrics.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('EngagementFund has been disposed');
    }
  }
}

