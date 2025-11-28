/**
 * Structured errors for the economy system.
 * 
 * These errors provide explicit error codes and context for financial operations.
 * All economy operations that can fail should use these error types.
 */
import { StructuredError, type ErrorContext } from '@engine/core';

/**
 * Error codes for economy operations.
 */
export type EconomyErrorCode =
  // Wallet errors
  | 'WALLET_NOT_FOUND'
  | 'WALLET_DISPOSED'
  | 'WALLET_ALREADY_EXISTS'
  // Balance errors
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY'
  // Transaction errors
  | 'TRANSACTION_FAILED'
  | 'TRANSACTION_NOT_FOUND'
  | 'INVALID_TRANSACTION'
  // Validation errors
  | 'VALIDATION_ERROR'
  | 'INVALID_EXCHANGE_RATE'
  | 'SAME_CURRENCY_EXCHANGE'
  // Game/Creator errors
  | 'GAME_NOT_REGISTERED'
  | 'GAME_ALREADY_REGISTERED'
  | 'CREATOR_NOT_FOUND'
  // Compliance errors
  | 'ITEM_NOT_COMPLIANT'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_NOT_AVAILABLE'
  | 'ITEM_OUT_OF_STOCK'
  | 'PURCHASE_LIMIT_REACHED'
  // Marketplace errors
  | 'LISTING_NOT_FOUND'
  | 'LISTING_ALREADY_SOLD'
  | 'LISTING_FEE_FAILED'
  | 'CANNOT_CANCEL_SOLD'
  // Season/Game Pass errors
  | 'PASS_NOT_FOUND'
  | 'PASS_NOT_ACTIVE'
  | 'PASS_OUTSIDE_PERIOD'
  | 'INVALID_PASS_REWARD'
  // Withdrawal errors
  | 'KYC_NOT_VERIFIED'
  | 'KYC_NOT_FOUND'
  | 'KYC_ALREADY_VERIFIED'
  | 'WITHDRAWAL_NOT_FOUND'
  | 'WITHDRAWAL_NOT_PENDING'
  | 'WITHDRAWAL_ALREADY_COMPLETED'
  | 'MIN_WITHDRAWAL_NOT_MET'
  // Configuration errors
  | 'INVALID_CONFIG'
  | 'PERCENTAGES_INVALID';

/**
 * Economy error with structured information for financial operations.
 */
export class EconomyError extends StructuredError<EconomyErrorCode> {
  constructor(
    code: EconomyErrorCode,
    message: string,
    context: ErrorContext = {}
  ) {
    super('EconomyError', code, message, { ...context, retryable: false });
  }

  // ==================== Wallet Errors ====================
  
  static walletNotFound(walletId: string): EconomyError {
    return new EconomyError(
      'WALLET_NOT_FOUND',
      `Wallet not found: ${walletId}`,
      { walletId }
    );
  }

  static walletDisposed(walletId: string): EconomyError {
    return new EconomyError(
      'WALLET_DISPOSED',
      `Wallet ${walletId} has been disposed`,
      { walletId }
    );
  }

  static walletAlreadyExists(walletId: string): EconomyError {
    return new EconomyError(
      'WALLET_ALREADY_EXISTS',
      `Wallet ${walletId} already exists`,
      { walletId }
    );
  }

  // ==================== Balance Errors ====================

  static insufficientBalance(
    walletId: string,
    currency: string,
    required: number,
    available: number
  ): EconomyError {
    return new EconomyError(
      'INSUFFICIENT_BALANCE',
      `Insufficient balance: have ${available}, need ${required} ${currency}`,
      { walletId, currency, required, available }
    );
  }

  static invalidAmount(amount: number, reason?: string): EconomyError {
    return new EconomyError(
      'INVALID_AMOUNT',
      `Invalid amount: ${amount}${reason ? ` - ${reason}` : ''}`,
      { amount, reason }
    );
  }

  static invalidCurrency(currency: string): EconomyError {
    return new EconomyError(
      'INVALID_CURRENCY',
      `Invalid or unsupported currency: ${currency}`,
      { currency }
    );
  }

  // ==================== Transaction Errors ====================

  static transactionFailed(transactionId: string, reason: string): EconomyError {
    return new EconomyError(
      'TRANSACTION_FAILED',
      `Transaction ${transactionId} failed: ${reason}`,
      { transactionId, reason }
    );
  }

  static transactionNotFound(transactionId: string): EconomyError {
    return new EconomyError(
      'TRANSACTION_NOT_FOUND',
      `Transaction not found: ${transactionId}`,
      { transactionId }
    );
  }

  static invalidTransaction(reason: string, context?: ErrorContext): EconomyError {
    return new EconomyError(
      'INVALID_TRANSACTION',
      `Invalid transaction: ${reason}`,
      context
    );
  }

  // ==================== Validation Errors ====================

  static validationError(message: string, context?: ErrorContext): EconomyError {
    return new EconomyError('VALIDATION_ERROR', message, context);
  }

  static invalidExchangeRate(rate: number): EconomyError {
    return new EconomyError(
      'INVALID_EXCHANGE_RATE',
      `Exchange rate must be positive and finite, got: ${rate}`,
      { rate }
    );
  }

  static sameCurrencyExchange(currency: string): EconomyError {
    return new EconomyError(
      'SAME_CURRENCY_EXCHANGE',
      `Cannot exchange currency to itself: ${currency}`,
      { currency }
    );
  }

  // ==================== Game/Creator Errors ====================

  static gameNotRegistered(gameId: string): EconomyError {
    return new EconomyError(
      'GAME_NOT_REGISTERED',
      `Game ${gameId} is not registered`,
      { gameId }
    );
  }

  static gameAlreadyRegistered(gameId: string): EconomyError {
    return new EconomyError(
      'GAME_ALREADY_REGISTERED',
      `Game ${gameId} is already registered`,
      { gameId }
    );
  }

  static creatorNotFound(creatorId: string): EconomyError {
    return new EconomyError(
      'CREATOR_NOT_FOUND',
      `Creator not found: ${creatorId}`,
      { creatorId }
    );
  }

  // ==================== Compliance Errors ====================

  static itemNotCompliant(itemId: string, reason: string): EconomyError {
    return new EconomyError(
      'ITEM_NOT_COMPLIANT',
      `Item not compliant: ${reason}`,
      { itemId, reason }
    );
  }

  static itemNotFound(itemId: string): EconomyError {
    return new EconomyError(
      'ITEM_NOT_FOUND',
      `Item not found: ${itemId}`,
      { itemId }
    );
  }

  static itemNotAvailable(itemId: string): EconomyError {
    return new EconomyError(
      'ITEM_NOT_AVAILABLE',
      `Item not available: ${itemId}`,
      { itemId }
    );
  }

  static itemOutOfStock(itemId: string): EconomyError {
    return new EconomyError(
      'ITEM_OUT_OF_STOCK',
      `Item out of stock: ${itemId}`,
      { itemId }
    );
  }

  static purchaseLimitReached(itemId: string, limit: number): EconomyError {
    return new EconomyError(
      'PURCHASE_LIMIT_REACHED',
      `Purchase limit (${limit}) reached for item: ${itemId}`,
      { itemId, limit }
    );
  }

  // ==================== Marketplace Errors ====================

  static listingNotFound(listingId: string): EconomyError {
    return new EconomyError(
      'LISTING_NOT_FOUND',
      `Listing not found: ${listingId}`,
      { listingId }
    );
  }

  static listingAlreadySold(listingId: string): EconomyError {
    return new EconomyError(
      'LISTING_ALREADY_SOLD',
      `Listing already sold: ${listingId}`,
      { listingId }
    );
  }

  static listingFeeFailed(amount: number): EconomyError {
    return new EconomyError(
      'LISTING_FEE_FAILED',
      `Insufficient balance for listing fee: ${amount}`,
      { amount }
    );
  }

  static cannotCancelSoldListing(listingId: string): EconomyError {
    return new EconomyError(
      'CANNOT_CANCEL_SOLD',
      `Cannot cancel sold listing: ${listingId}`,
      { listingId }
    );
  }

  // ==================== Pass Errors ====================

  static passNotFound(passId: string, passType: 'season' | 'game'): EconomyError {
    return new EconomyError(
      'PASS_NOT_FOUND',
      `${passType === 'season' ? 'Season' : 'Game'} pass not found: ${passId}`,
      { passId, passType }
    );
  }

  static passNotActive(passId: string): EconomyError {
    return new EconomyError(
      'PASS_NOT_ACTIVE',
      `Pass not active: ${passId}`,
      { passId }
    );
  }

  static passOutsidePeriod(passId: string): EconomyError {
    return new EconomyError(
      'PASS_OUTSIDE_PERIOD',
      `Pass not available: outside season period`,
      { passId }
    );
  }

  static invalidPassReward(passId: string, tier: number, reason: string): EconomyError {
    return new EconomyError(
      'INVALID_PASS_REWARD',
      `Invalid reward in tier ${tier}: ${reason}`,
      { passId, tier, reason }
    );
  }

  // ==================== Withdrawal/KYC Errors ====================

  static kycNotVerified(creatorId: string, status?: string): EconomyError {
    return new EconomyError(
      'KYC_NOT_VERIFIED',
      `Creator ${creatorId} is not verified${status ? `. KYC status: ${status}` : ''}`,
      { creatorId, status }
    );
  }

  static kycNotFound(creatorId: string): EconomyError {
    return new EconomyError(
      'KYC_NOT_FOUND',
      `KYC not found for creator: ${creatorId}`,
      { creatorId }
    );
  }

  static kycAlreadyVerified(creatorId: string): EconomyError {
    return new EconomyError(
      'KYC_ALREADY_VERIFIED',
      `Creator ${creatorId} is already verified`,
      { creatorId }
    );
  }

  static withdrawalNotFound(requestId: string): EconomyError {
    return new EconomyError(
      'WITHDRAWAL_NOT_FOUND',
      `Withdrawal request not found: ${requestId}`,
      { requestId }
    );
  }

  static withdrawalNotPending(requestId: string, status: string): EconomyError {
    return new EconomyError(
      'WITHDRAWAL_NOT_PENDING',
      `Withdrawal request ${requestId} is not pending (status: ${status})`,
      { requestId, status }
    );
  }

  static withdrawalAlreadyCompleted(requestId: string): EconomyError {
    return new EconomyError(
      'WITHDRAWAL_ALREADY_COMPLETED',
      `Cannot cancel completed withdrawal: ${requestId}`,
      { requestId }
    );
  }

  static minWithdrawalNotMet(amount: number, minimum: number): EconomyError {
    return new EconomyError(
      'MIN_WITHDRAWAL_NOT_MET',
      `Minimum withdrawal amount is ${minimum} coins, got: ${amount}`,
      { amount, minimum }
    );
  }

  // ==================== Configuration Errors ====================

  static invalidConfig(message: string, context?: ErrorContext): EconomyError {
    return new EconomyError('INVALID_CONFIG', message, context);
  }

  static percentagesInvalid(total: number, expected: number, breakdown?: Record<string, number>): EconomyError {
    return new EconomyError(
      'PERCENTAGES_INVALID',
      `Percentages must sum to ${expected}%, got: ${total}%`,
      { total, expected, breakdown }
    );
  }
}

