import type { IDisposable } from '@engine/core/utils';
import type { ExchangeRate, FiatCurrency } from './types';
import { PLATFORM_CURRENCY } from './types';

/**
 * Configuration for exchange rate system
 */
export interface ExchangeRateConfig {
  /** Default exchange rate (coins per fiat unit) */
  defaultCoinsPerFiat: number;
  /** Default fiat currency */
  defaultFiatCurrency: FiatCurrency;
  /** Optional logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Manages exchange rates between Coin and fiat currencies.
 * Provides fixed exchange rate (e.g., 100 Coin = 1 USD).
 */
export class CurrencyExchangeRate implements IDisposable {
  private readonly rates = new Map<FiatCurrency, ExchangeRate>();
  private readonly defaultRate: ExchangeRate;
  private disposed = false;

  private readonly logger: ExchangeRateConfig['logger'];

  /**
   * @param config - Exchange rate configuration
   */
  constructor(config: ExchangeRateConfig) {
    this.logger = config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };

    const now = Date.now();
    this.defaultRate = {
      fiatCurrency: config.defaultFiatCurrency,
      coinsPerFiat: config.defaultCoinsPerFiat,
      lastUpdated: now,
    };

    this.rates.set(config.defaultFiatCurrency, this.defaultRate);
  }

  /**
   * Gets exchange rate for a fiat currency (returns default if not found).
   */
  getRate(fiatCurrency: FiatCurrency): ExchangeRate {
    this.ensureNotDisposed();
    return this.rates.get(fiatCurrency) ?? this.defaultRate;
  }

  /**
   * Sets exchange rate for a fiat currency.
   */
  setRate(fiatCurrency: FiatCurrency, coinsPerFiat: number): void {
    this.ensureNotDisposed();

    if (!Number.isFinite(coinsPerFiat) || coinsPerFiat <= 0) {
      throw new Error(`Coins per fiat must be positive and finite, got: ${coinsPerFiat}`);
    }

    const rate: ExchangeRate = {
      fiatCurrency,
      coinsPerFiat,
      lastUpdated: Date.now(),
    };

    this.rates.set(fiatCurrency, rate);
    this.logger?.debug(`Updated exchange rate: ${coinsPerFiat} ${PLATFORM_CURRENCY} = 1 ${fiatCurrency}`);
  }

  /**
   * Converts fiat amount to coins.
   */
  fiatToCoins(fiatAmount: number, fiatCurrency: FiatCurrency): number {
    this.ensureNotDisposed();

    if (!Number.isFinite(fiatAmount) || fiatAmount < 0) {
      throw new Error(`Fiat amount must be non-negative and finite, got: ${fiatAmount}`);
    }

    const rate = this.getRate(fiatCurrency);
    return fiatAmount * rate.coinsPerFiat;
  }

  /**
   * Converts coins to fiat amount.
   */
  coinsToFiat(coins: number, fiatCurrency: FiatCurrency): number {
    this.ensureNotDisposed();

    if (!Number.isFinite(coins) || coins < 0) {
      throw new Error(`Coins must be non-negative and finite, got: ${coins}`);
    }

    const rate = this.getRate(fiatCurrency);
    return coins / rate.coinsPerFiat;
  }

  /**
   * Gets all supported exchange rates.
   */
  getAllRates(): ExchangeRate[] {
    this.ensureNotDisposed();
    return Array.from(this.rates.values());
  }

  /**
   * Gets default fiat currency.
   */
  getDefaultFiatCurrency(): FiatCurrency {
    this.ensureNotDisposed();
    return this.defaultRate.fiatCurrency;
  }

  /**
   * Gets default coins per fiat rate.
   */
  getDefaultCoinsPerFiat(): number {
    this.ensureNotDisposed();
    return this.defaultRate.coinsPerFiat;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.rates.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('CurrencyExchangeRate has been disposed');
    }
  }
}

