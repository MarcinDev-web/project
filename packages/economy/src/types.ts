/**
 * Platform currency identifier - single currency for simplicity
 */
export const PLATFORM_CURRENCY = 'coin' as const;

/**
 * Currency type identifier (e.g., "coin", "gems", "credits").
 * Platform uses single currency "coin" for simplicity.
 */
export type Currency = string;

/**
 * Fiat currency codes (ISO 4217)
 */
export type FiatCurrency = 'USD' | 'EUR' | 'PLN' | 'GBP';

/**
 * Exchange rate configuration for Coin ↔ Fiat
 */
export interface ExchangeRate {
  /** Fiat currency code */
  fiatCurrency: FiatCurrency;
  /** How many Coins per 1 unit of fiat (e.g., 100 Coin = 1 USD) */
  coinsPerFiat: number;
  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Represents a currency amount with its type.
 */
export interface CurrencyAmount {
  /** Currency type */
  currency: Currency;
  /** Amount value (must be non-negative and finite) */
  amount: number;
}

/**
 * Balance for a specific currency.
 */
export interface CurrencyBalance {
  /** Currency type */
  currency: Currency;
  /** Current balance */
  balance: number;
}

/**
 * Transaction status.
 */
export enum TransactionStatus {
  /** Transaction is pending execution */
  PENDING = 'pending',
  /** Transaction completed successfully */
  COMPLETED = 'completed',
  /** Transaction failed */
  FAILED = 'failed',
  /** Transaction was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Transaction type.
 */
export enum TransactionType {
  /** Deposit currency into wallet */
  DEPOSIT = 'deposit',
  /** Withdraw currency from wallet */
  WITHDRAWAL = 'withdrawal',
  /** Transfer currency between wallets */
  TRANSFER = 'transfer',
  /** Exchange one currency for another */
  EXCHANGE = 'exchange',
  /** Purchase in-game item */
  PURCHASE = 'purchase',
  /** Marketplace transaction */
  MARKETPLACE = 'marketplace',
  /** Platform fee/burn */
  FEE = 'fee',
  /** Creator payout */
  PAYOUT = 'payout',
}

/**
 * Player/wallet identifier.
 */
export type WalletId = string;

/**
 * Game/creator identifier
 */
export type GameId = string;
export type CreatorId = string;

/**
 * Item category for anti-P2W compliance
 */
export enum ItemCategory {
  /** Cosmetic only - always allowed */
  COSMETIC = 'cosmetic',
  /** Progression boost - only in Casual games */
  PROGRESSION_BOOST = 'progression_boost',
  /** Competitive advantage - FORBIDDEN */
  COMPETITIVE_ADVANTAGE = 'competitive_advantage',
}

/**
 * Game mode classification for P2W compliance
 */
export enum GameMode {
  /** Casual - progression boosts allowed */
  CASUAL = 'casual',
  /** Competitive - only cosmetics allowed */
  COMPETITIVE = 'competitive',
}
