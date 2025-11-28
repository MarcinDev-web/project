/**
 * Result-based API for economy operations.
 * 
 * These utilities provide explicit error handling for financial operations
 * using the Result<T, E> pattern instead of throwing exceptions.
 * 
 * @example
 * ```typescript
 * import { CurrencyWallet } from '@engine/economy';
 * import { withdrawResult, transferResult } from '@engine/economy/result';
 * import { Result } from '@engine/core';
 * 
 * const wallet = new CurrencyWallet('user-1', eventBus);
 * 
 * // Withdraw with explicit error handling
 * const result = withdrawResult(wallet, { currency: 'coin', amount: 100 });
 * 
 * Result.match(result, {
 *   ok: (tx) => console.log('Withdrawn:', tx.id),
 *   err: (error) => {
 *     if (error.code === 'INSUFFICIENT_BALANCE') {
 *       showInsufficientFundsDialog(error.context.available);
 *     } else {
 *       showGenericError(error.message);
 *     }
 *   },
 * });
 * ```
 */

import { Result } from '@engine/core';
import type { CurrencyWallet } from './CurrencyWallet.js';
import type { Transaction } from './Transaction.js';
import type { CurrencyAmount, Currency } from './types.js';
import { EconomyError } from './errors.js';

// ==================== Type Aliases ====================

export type EconomyResult<T> = Result<T, EconomyError>;
export type TransactionResult = EconomyResult<Transaction>;

// ==================== Wallet Operations ====================

/**
 * Deposit currency with Result return type.
 */
export function depositResult(
  wallet: CurrencyWallet,
  amount: CurrencyAmount,
  description?: string
): TransactionResult {
  try {
    if (wallet.isDisposed()) {
      return Result.err(EconomyError.walletDisposed(wallet.id));
    }
    
    const validationError = validateAmount(amount);
    if (validationError) {
      return Result.err(validationError);
    }

    const transaction = wallet.deposit(amount, description);
    return Result.ok(transaction);
  } catch (error) {
    return Result.err(mapToEconomyError(error, wallet.id));
  }
}

/**
 * Withdraw currency with Result return type.
 */
export function withdrawResult(
  wallet: CurrencyWallet,
  amount: CurrencyAmount,
  description?: string
): TransactionResult {
  try {
    if (wallet.isDisposed()) {
      return Result.err(EconomyError.walletDisposed(wallet.id));
    }

    const validationError = validateAmount(amount);
    if (validationError) {
      return Result.err(validationError);
    }

    // Pre-check balance to provide better error
    const currentBalance = wallet.balance(amount.currency);
    if (currentBalance < amount.amount) {
      return Result.err(
        EconomyError.insufficientBalance(
          wallet.id,
          amount.currency,
          amount.amount,
          currentBalance
        )
      );
    }

    const transaction = wallet.withdraw(amount, description);
    return Result.ok(transaction);
  } catch (error) {
    return Result.err(mapToEconomyError(error, wallet.id));
  }
}

/**
 * Transfer currency between wallets with Result return type.
 */
export function transferResult(
  from: CurrencyWallet,
  to: CurrencyWallet,
  amount: CurrencyAmount,
  description?: string
): TransactionResult {
  try {
    if (from.isDisposed()) {
      return Result.err(EconomyError.walletDisposed(from.id));
    }
    if (to.isDisposed()) {
      return Result.err(EconomyError.walletDisposed(to.id));
    }

    const validationError = validateAmount(amount);
    if (validationError) {
      return Result.err(validationError);
    }

    // Pre-check balance
    const currentBalance = from.balance(amount.currency);
    if (currentBalance < amount.amount) {
      return Result.err(
        EconomyError.insufficientBalance(
          from.id,
          amount.currency,
          amount.amount,
          currentBalance
        )
      );
    }

    const transaction = from.transfer(to, amount, description);
    return Result.ok(transaction);
  } catch (error) {
    return Result.err(mapToEconomyError(error, from.id));
  }
}

/**
 * Exchange currency with Result return type.
 */
export function exchangeResult(
  wallet: CurrencyWallet,
  fromCurrency: Currency,
  toCurrency: Currency,
  fromAmount: number,
  exchangeRate: number,
  description?: string
): TransactionResult {
  try {
    if (wallet.isDisposed()) {
      return Result.err(EconomyError.walletDisposed(wallet.id));
    }

    // Validate inputs
    if (!Number.isFinite(fromAmount) || fromAmount < 0) {
      return Result.err(
        EconomyError.invalidAmount(fromAmount, 'must be non-negative and finite')
      );
    }

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      return Result.err(EconomyError.invalidExchangeRate(exchangeRate));
    }

    if (fromCurrency === toCurrency) {
      return Result.err(EconomyError.sameCurrencyExchange(fromCurrency));
    }

    // Pre-check balance
    const currentBalance = wallet.balance(fromCurrency);
    if (currentBalance < fromAmount) {
      return Result.err(
        EconomyError.insufficientBalance(
          wallet.id,
          fromCurrency,
          fromAmount,
          currentBalance
        )
      );
    }

    const transaction = wallet.exchange(
      fromCurrency,
      toCurrency,
      fromAmount,
      exchangeRate,
      description
    );
    return Result.ok(transaction);
  } catch (error) {
    return Result.err(mapToEconomyError(error, wallet.id));
  }
}

// ==================== Batch Operations ====================

/**
 * Execute multiple withdrawals, returning results for each.
 * Continues even if some fail.
 */
export function batchWithdrawResult(
  wallet: CurrencyWallet,
  amounts: CurrencyAmount[],
  description?: string
): TransactionResult[] {
  return amounts.map(amount => withdrawResult(wallet, amount, description));
}

/**
 * Execute multiple transfers, returning results for each.
 * Continues even if some fail.
 */
export function batchTransferResult(
  from: CurrencyWallet,
  transfers: Array<{ to: CurrencyWallet; amount: CurrencyAmount; description?: string }>
): TransactionResult[] {
  return transfers.map(({ to, amount, description }) =>
    transferResult(from, to, amount, description)
  );
}

// ==================== Safe Balance Check ====================

/**
 * Check if wallet has sufficient balance (returns Result for consistency).
 */
export function checkBalance(
  wallet: CurrencyWallet,
  currency: Currency,
  requiredAmount: number
): EconomyResult<number> {
  if (wallet.isDisposed()) {
    return Result.err(EconomyError.walletDisposed(wallet.id));
  }

  const balance = wallet.balance(currency);
  if (balance < requiredAmount) {
    return Result.err(
      EconomyError.insufficientBalance(wallet.id, currency, requiredAmount, balance)
    );
  }

  return Result.ok(balance);
}

// ==================== Helpers ====================

/**
 * Validate currency amount.
 */
function validateAmount(amount: CurrencyAmount): EconomyError | null {
  if (!Number.isFinite(amount.amount) || amount.amount < 0) {
    return EconomyError.invalidAmount(
      amount.amount,
      'must be non-negative and finite'
    );
  }

  if (!amount.currency || typeof amount.currency !== 'string') {
    return EconomyError.invalidCurrency(String(amount.currency));
  }

  return null;
}

/**
 * Map unknown error to EconomyError.
 */
function mapToEconomyError(error: unknown, walletId?: string): EconomyError {
  if (error instanceof EconomyError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Try to categorize common errors
  if (message.includes('Insufficient balance')) {
    // Parse the error message to extract values
    const match = message.match(/have (\d+(?:\.\d+)?), need (\d+(?:\.\d+)?)/);
    if (match) {
      return EconomyError.insufficientBalance(
        walletId || 'unknown',
        'coin',
        parseFloat(match[2]!),
        parseFloat(match[1]!)
      );
    }
    return EconomyError.insufficientBalance(walletId || 'unknown', 'coin', 0, 0);
  }

  if (message.includes('disposed')) {
    return EconomyError.walletDisposed(walletId || 'unknown');
  }

  if (message.includes('Amount must be') || message.includes('Invalid amount')) {
    return EconomyError.invalidAmount(0, message);
  }

  if (message.includes('Currency must be')) {
    return EconomyError.invalidCurrency('unknown');
  }

  // Generic fallback
  const cause = error instanceof Error ? error : undefined;
  return new EconomyError(
    'TRANSACTION_FAILED',
    message,
    { walletId, ...(cause && { cause }) }
  );
}

