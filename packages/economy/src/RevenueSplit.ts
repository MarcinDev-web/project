import type { IDisposable } from '@engine/core/utils';
import type { CurrencyAmount, CreatorId } from './types';
import { PLATFORM_CURRENCY } from './types';

/**
 * Revenue split configuration
 */
export interface RevenueSplitConfig {
  /** Creator percentage (0-100) */
  creatorPercent: number;
  /** Platform percentage (0-100) */
  platformPercent: number;
  /** Processing/reserve percentage (0-100) */
  processingPercent: number;
  /** Optional logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Marketplace revenue split (UGC assets)
 */
export interface MarketplaceSplitConfig {
  /** Asset creator percentage (0-100) */
  assetCreatorPercent: number;
  /** Game creator percentage (0-100) - for using asset in game */
  gameCreatorPercent: number;
  /** Platform percentage (0-100) */
  platformPercent: number;
}

/**
 * Result of revenue split calculation
 */
export interface RevenueSplitResult {
  /** Original amount */
  original: CurrencyAmount;
  /** Creator share */
  creator: CurrencyAmount;
  /** Platform share */
  platform: CurrencyAmount;
  /** Processing/reserve share */
  processing: CurrencyAmount;
  /** Total (should equal original) */
  total: CurrencyAmount;
}

/**
 * Marketplace revenue split result
 */
export interface MarketplaceSplitResult {
  /** Original amount */
  original: CurrencyAmount;
  /** Asset creator share */
  assetCreator: CurrencyAmount;
  /** Game creator share */
  gameCreator: CurrencyAmount;
  /** Platform share */
  platform: CurrencyAmount;
  /** Total (should equal original) */
  total: CurrencyAmount;
}

/**
 * Default revenue splits
 */
const DEFAULT_IN_GAME_SPLIT: RevenueSplitConfig = {
  creatorPercent: 70,
  platformPercent: 25,
  processingPercent: 5,
};

const DEFAULT_MARKETPLACE_SPLIT: MarketplaceSplitConfig = {
  assetCreatorPercent: 60,
  gameCreatorPercent: 20,
  platformPercent: 20,
};

/**
 * Revenue split calculator for creator monetization.
 * Handles in-game purchases and marketplace transactions.
 */
export class RevenueSplit implements IDisposable {
  private readonly inGameSplit: RevenueSplitConfig;
  private readonly marketplaceSplit: MarketplaceSplitConfig;
  private disposed = false;

  private readonly logger: RevenueSplitConfig['logger'];

  constructor(
    inGameSplit: Partial<RevenueSplitConfig> = {},
    marketplaceSplit: Partial<MarketplaceSplitConfig> = {}
  ) {
    this.inGameSplit = { ...DEFAULT_IN_GAME_SPLIT, ...inGameSplit };
    this.marketplaceSplit = { ...DEFAULT_MARKETPLACE_SPLIT, ...marketplaceSplit };
    this.logger = inGameSplit.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };

    // Validate percentages sum to 100
    this.validateSplit(this.inGameSplit);
    this.validateMarketplaceSplit(this.marketplaceSplit);
  }

  /**
   * Calculates revenue split for in-game purchase.
   */
  calculateInGameSplit(amount: CurrencyAmount, creatorId: CreatorId): RevenueSplitResult {
    this.ensureNotDisposed();

    if (amount.currency !== PLATFORM_CURRENCY) {
      throw new Error(`Only ${PLATFORM_CURRENCY} currency supported for revenue split`);
    }

    const creatorAmount = Math.floor((amount.amount * this.inGameSplit.creatorPercent) / 100);
    const platformAmount = Math.floor((amount.amount * this.inGameSplit.platformPercent) / 100);
    const processingAmount = amount.amount - creatorAmount - platformAmount; // Remainder

    const result: RevenueSplitResult = {
      original: { ...amount },
      creator: { currency: PLATFORM_CURRENCY, amount: creatorAmount },
      platform: { currency: PLATFORM_CURRENCY, amount: platformAmount },
      processing: { currency: PLATFORM_CURRENCY, amount: processingAmount },
      total: {
        currency: PLATFORM_CURRENCY,
        amount: creatorAmount + platformAmount + processingAmount,
      },
    };

    this.logger?.debug(
      `In-game split for ${creatorId}: ${creatorAmount} creator, ${platformAmount} platform, ${processingAmount} processing`
    );

    return result;
  }

  /**
   * Calculates revenue split for marketplace transaction (UGC asset).
   */
  calculateMarketplaceSplit(
    amount: CurrencyAmount,
    _assetCreatorId: CreatorId,
    _gameCreatorId: CreatorId
  ): MarketplaceSplitResult {
    this.ensureNotDisposed();

    if (amount.currency !== PLATFORM_CURRENCY) {
      throw new Error(`Only ${PLATFORM_CURRENCY} currency supported for revenue split`);
    }

    const assetCreatorAmount = Math.floor(
      (amount.amount * this.marketplaceSplit.assetCreatorPercent) / 100
    );
    const gameCreatorAmount = Math.floor(
      (amount.amount * this.marketplaceSplit.gameCreatorPercent) / 100
    );
    const platformAmount = amount.amount - assetCreatorAmount - gameCreatorAmount; // Remainder

    const result: MarketplaceSplitResult = {
      original: { ...amount },
      assetCreator: { currency: PLATFORM_CURRENCY, amount: assetCreatorAmount },
      gameCreator: { currency: PLATFORM_CURRENCY, amount: gameCreatorAmount },
      platform: { currency: PLATFORM_CURRENCY, amount: platformAmount },
      total: {
        currency: PLATFORM_CURRENCY,
        amount: assetCreatorAmount + gameCreatorAmount + platformAmount,
      },
    };

    this.logger?.debug(
      `Marketplace split: ${assetCreatorAmount} asset creator, ${gameCreatorAmount} game creator, ${platformAmount} platform`
    );

    return result;
  }

  /**
   * Gets current in-game split configuration.
   */
  getInGameSplit(): RevenueSplitConfig {
    this.ensureNotDisposed();
    return { ...this.inGameSplit };
  }

  /**
   * Gets current marketplace split configuration.
   */
  getMarketplaceSplit(): MarketplaceSplitConfig {
    this.ensureNotDisposed();
    return { ...this.marketplaceSplit };
  }

  /**
   * Updates in-game split configuration.
   */
  updateInGameSplit(config: Partial<RevenueSplitConfig>): void {
    this.ensureNotDisposed();

    const newConfig = { ...this.inGameSplit, ...config };
    this.validateSplit(newConfig);

    Object.assign(this.inGameSplit, newConfig);
    this.logger?.debug('Updated in-game revenue split configuration');
  }

  /**
   * Updates marketplace split configuration.
   */
  updateMarketplaceSplit(config: Partial<MarketplaceSplitConfig>): void {
    this.ensureNotDisposed();

    const newConfig = { ...this.marketplaceSplit, ...config };
    this.validateMarketplaceSplit(newConfig);

    Object.assign(this.marketplaceSplit, newConfig);
    this.logger?.debug('Updated marketplace revenue split configuration');
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('RevenueSplit has been disposed');
    }
  }

  private validateSplit(config: RevenueSplitConfig): void {
    const total = config.creatorPercent + config.platformPercent + config.processingPercent;
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(
        `Revenue split percentages must sum to 100, got: ${total}% (creator: ${config.creatorPercent}%, platform: ${config.platformPercent}%, processing: ${config.processingPercent}%)`
      );
    }

    if (
      config.creatorPercent < 0 ||
      config.platformPercent < 0 ||
      config.processingPercent < 0
    ) {
      throw new Error('Revenue split percentages must be non-negative');
    }
  }

  private validateMarketplaceSplit(config: MarketplaceSplitConfig): void {
    const total =
      config.assetCreatorPercent + config.gameCreatorPercent + config.platformPercent;
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(
        `Marketplace split percentages must sum to 100, got: ${total}% (asset: ${config.assetCreatorPercent}%, game: ${config.gameCreatorPercent}%, platform: ${config.platformPercent}%)`
      );
    }

    if (
      config.assetCreatorPercent < 0 ||
      config.gameCreatorPercent < 0 ||
      config.platformPercent < 0
    ) {
      throw new Error('Marketplace split percentages must be non-negative');
    }
  }
}

