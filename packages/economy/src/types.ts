/**
 * Currency type identifier (e.g., "coins", "gems", "credits").
 */
export type Currency = string;

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
}

/**
 * Player/wallet identifier.
 */
export type WalletId = string;
