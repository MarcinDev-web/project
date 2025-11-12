import { EventBus } from '@engine/core/event';
import type { IDisposable } from '@engine/core/utils';
import { DisposableGroup } from '@engine/core/utils';
import type { CurrencyAmount } from './types';
import { PLATFORM_CURRENCY } from './types';
import { CurrencyWallet } from './CurrencyWallet';
import { CurrencyEventNames } from './events';

/**
 * Sink configuration
 */
export interface CurrencySinksConfig {
  /** Burn percentage for fees (0-100) - portion that is permanently removed */
  burnPercent: number;
  /** Fund percentage for fees (0-100) - portion that goes to engagement fund */
  fundPercent: number;
  /** Optional logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Sink operation result
 */
export interface SinkResult {
  /** Original amount */
  original: CurrencyAmount;
  /** Amount burned (permanently removed) */
  burned: CurrencyAmount;
  /** Amount sent to engagement fund */
  toFund: CurrencyAmount;
  /** Total removed from circulation */
  totalRemoved: CurrencyAmount;
}

/**
 * Fee types
 */
export enum FeeType {
  /** Marketplace listing fee */
  MARKETPLACE_LISTING = 'marketplace_listing',
  /** Marketplace transaction fee */
  MARKETPLACE_TRANSACTION = 'marketplace_transaction',
  /** Platform service fee */
  PLATFORM_SERVICE = 'platform_service',
  /** Custom fee */
  CUSTOM = 'custom',
}

/**
 * Currency sinks system - controls currency supply through fees and burning.
 * Implements anti-inflation mechanisms.
 */
export class CurrencySinks implements IDisposable {
  private readonly burnWallet: CurrencyWallet;
  private readonly fundWallet: CurrencyWallet;
  private readonly eventBus: EventBus;
  private readonly disposables: DisposableGroup;
  private disposed = false;

  private readonly burnPercent: number;
  private readonly fundPercent: number;
  private readonly logger: CurrencySinksConfig['logger'];

  /** Total coins burned (tracked for statistics) */
  private totalBurned = 0;
  /** Total coins sent to fund (tracked for statistics) */
  private totalToFund = 0;

  /**
   * @param burnWallet - Wallet for burned coins (permanently removed)
   * @param fundWallet - Wallet for engagement fund (redistributed to creators)
   * @param eventBus - Event bus for currency events
   * @param config - Sink configuration
   */
  constructor(
    burnWallet: CurrencyWallet,
    fundWallet: CurrencyWallet,
    eventBus: EventBus,
    config: CurrencySinksConfig
  ) {
    this.burnWallet = burnWallet;
    this.fundWallet = fundWallet;
    this.eventBus = eventBus;
    this.disposables = new DisposableGroup();
    this.burnPercent = config.burnPercent;
    this.fundPercent = config.fundPercent;
    this.logger = config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };

    // Validate percentages
    const total = this.burnPercent + this.fundPercent;
    if (total > 100) {
      throw new Error(
        `Burn and fund percentages cannot exceed 100%, got: ${total}% (burn: ${this.burnPercent}%, fund: ${this.fundPercent}%)`
      );
    }

    this.setupEventHandlers();
  }

  /**
   * Processes a fee - burns portion and sends to fund.
   * @param amount - Fee amount
   * @param feeType - Type of fee
   * @param description - Optional description
   * @returns Sink operation result
   */
  processFee(
    amount: CurrencyAmount,
    feeType: FeeType,
    description?: string
  ): SinkResult {
    this.ensureNotDisposed();

    if (amount.currency !== PLATFORM_CURRENCY && amount.currency !== 'coin') {
      throw new Error(`Only coin currency supported for sinks`);
    }

    const burnAmount = Math.floor((amount.amount * this.burnPercent) / 100);
    const fundAmount = Math.floor((amount.amount * this.fundPercent) / 100);
    const remaining = amount.amount - burnAmount - fundAmount;

    // Burn coins (deposit to burn wallet - permanently removed)
    if (burnAmount > 0) {
      this.burnWallet.deposit(
        { currency: 'coin', amount: burnAmount },
        `Burned: ${feeType}${description ? ` - ${description}` : ''}`
      );
      this.totalBurned += burnAmount;
    }

    // Send to engagement fund
    if (fundAmount > 0) {
      this.fundWallet.deposit(
        { currency: 'coin', amount: fundAmount },
        `Engagement fund: ${feeType}${description ? ` - ${description}` : ''}`
      );
      this.totalToFund += fundAmount;
    }

    // Remaining amount stays in platform wallet (if any)
    if (remaining > 0) {
      this.logger?.debug(`Fee processing: ${remaining} coins remain in platform wallet`);
    }

    const result: SinkResult = {
      original: { ...amount },
      burned: { currency: 'coin', amount: burnAmount },
      toFund: { currency: 'coin', amount: fundAmount },
      totalRemoved: {
        currency: 'coin',
        amount: burnAmount + fundAmount,
      },
    };

    this.logger?.debug(
      `Fee processed: ${burnAmount} burned, ${fundAmount} to fund (${feeType})`
    );

    return result;
  }

  /**
   * Gets total coins burned (statistics).
   */
  getTotalBurned(): number {
    this.ensureNotDisposed();
    return this.totalBurned;
  }

  /**
   * Gets total coins sent to engagement fund (statistics).
   */
  getTotalToFund(): number {
    this.ensureNotDisposed();
    return this.totalToFund;
  }

  /**
   * Gets current engagement fund balance.
   */
  getFundBalance(): number {
    this.ensureNotDisposed();
    return this.fundWallet.balance('coin');
  }

  /**
   * Gets current burn wallet balance (should be high - coins are permanently removed).
   */
  getBurnBalance(): number {
    this.ensureNotDisposed();
    return this.burnWallet.balance('coin');
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.disposables.dispose();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('CurrencySinks has been disposed');
    }
  }

  private setupEventHandlers(): void {
    // Track burned coins
    const unsubscribeBurned = this.eventBus.on(
      CurrencyEventNames.DEPOSITED,
      (data) => {
        if (
          data &&
          typeof data === 'object' &&
          'walletId' in data &&
          data.walletId === this.burnWallet.id
        ) {
          // Track burn operations
          this.logger?.debug('Coins burned', data);
        }
      }
    );

    this.disposables.add(unsubscribeBurned);
  }
}

