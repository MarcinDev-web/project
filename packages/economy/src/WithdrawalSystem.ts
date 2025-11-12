import { EventBus } from '@engine/core/event';
import type { IDisposable } from '@engine/core/utils';
import { DisposableGroup } from '@engine/core/utils';
import type { CurrencyAmount, CreatorId, FiatCurrency } from './types';
import { PLATFORM_CURRENCY } from './types';
import { CurrencyManager } from './CurrencyManager';
import { CurrencyExchangeRate } from './CurrencyExchangeRate';

/**
 * KYC status
 */
export enum KYCStatus {
  /** Not submitted */
  NOT_SUBMITTED = 'not_submitted',
  /** Pending verification */
  PENDING = 'pending',
  /** Verified and approved */
  VERIFIED = 'verified',
  /** Rejected */
  REJECTED = 'rejected',
}

/**
 * Creator KYC information
 */
export interface CreatorKYC {
  creatorId: CreatorId;
  status: KYCStatus;
  /** Full name */
  fullName?: string;
  /** Email */
  email?: string;
  /** Tax ID / SSN */
  taxId?: string;
  /** Bank account details (encrypted) */
  bankAccount?: string;
  /** Submitted timestamp */
  submittedAt?: number;
  /** Verified timestamp */
  verifiedAt?: number;
  /** Rejection reason (if rejected) */
  rejectionReason?: string;
}

/**
 * Withdrawal request
 */
export interface WithdrawalRequest {
  requestId: string;
  creatorId: CreatorId;
  amount: CurrencyAmount;
  /** Requested fiat currency */
  fiatCurrency: FiatCurrency;
  /** Calculated fiat amount */
  fiatAmount: number;
  /** Request timestamp */
  requestedAt: number;
  /** Status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  /** Completion timestamp */
  completedAt?: number;
  /** Failure reason */
  failureReason?: string;
}

/**
 * Withdrawal system configuration
 */
export interface WithdrawalSystemConfig {
  /** Minimum withdrawal amount in coins */
  minWithdrawalAmount: number;
  /** Exchange rate system */
  exchangeRate: CurrencyExchangeRate;
  /** Optional logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Withdrawal system - handles creator payouts with KYC verification.
 * Only verified creators can withdraw coins to fiat.
 */
export class WithdrawalSystem implements IDisposable {
  private readonly kycRecords = new Map<CreatorId, CreatorKYC>();
  private readonly withdrawalRequests = new Map<string, WithdrawalRequest>();
  private readonly currencyManager: CurrencyManager;
  private readonly exchangeRate: CurrencyExchangeRate;
  // @ts-expect-error Reserved for future use
  private readonly _eventBus: EventBus;
  private readonly disposables: DisposableGroup;
  private disposed = false;

  private readonly minWithdrawalAmount: number;
  private readonly logger: WithdrawalSystemConfig['logger'];

  constructor(
    currencyManager: CurrencyManager,
    exchangeRate: CurrencyExchangeRate,
    eventBus: EventBus,
    config: WithdrawalSystemConfig
  ) {
    this.currencyManager = currencyManager;
    this.exchangeRate = exchangeRate;
    this._eventBus = eventBus;
    this.disposables = new DisposableGroup();
    this.minWithdrawalAmount = config.minWithdrawalAmount;
    this.logger = config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
  }

  /**
   * Submits KYC information for a creator.
   */
  submitKYC(creatorId: CreatorId, kycData: Omit<CreatorKYC, 'creatorId' | 'status'>): void {
    this.ensureNotDisposed();

    const existing = this.kycRecords.get(creatorId);
    if (existing && existing.status === KYCStatus.VERIFIED) {
      throw new Error(`Creator ${creatorId} is already verified`);
    }

    const kyc: CreatorKYC = {
      creatorId,
      status: KYCStatus.PENDING,
      ...kycData,
      submittedAt: Date.now(),
    };

    this.kycRecords.set(creatorId, kyc);
    this.logger?.debug(`KYC submitted for creator: ${creatorId}`);
  }

  /**
   * Verifies KYC (admin function - in real system would be manual review).
   */
  verifyKYC(creatorId: CreatorId): void {
    this.ensureNotDisposed();

    const kyc = this.kycRecords.get(creatorId);
    if (!kyc) {
      throw new Error(`KYC not found for creator: ${creatorId}`);
    }

    if (kyc.status === KYCStatus.VERIFIED) {
      return; // Already verified
    }

    kyc.status = KYCStatus.VERIFIED;
    kyc.verifiedAt = Date.now();
    this.logger?.debug(`KYC verified for creator: ${creatorId}`);
  }

  /**
   * Rejects KYC (admin function).
   */
  rejectKYC(creatorId: CreatorId, reason: string): void {
    this.ensureNotDisposed();

    const kyc = this.kycRecords.get(creatorId);
    if (!kyc) {
      throw new Error(`KYC not found for creator: ${creatorId}`);
    }

    kyc.status = KYCStatus.REJECTED;
    kyc.rejectionReason = reason;
    this.logger?.warn(`KYC rejected for creator ${creatorId}: ${reason}`);
  }

  /**
   * Gets KYC status for a creator.
   */
  getKYCStatus(creatorId: CreatorId): KYCStatus {
    this.ensureNotDisposed();
    const kyc = this.kycRecords.get(creatorId);
    return kyc?.status ?? KYCStatus.NOT_SUBMITTED;
  }

  /**
   * Checks if creator is verified.
   */
  isCreatorVerified(creatorId: CreatorId): boolean {
    return this.getKYCStatus(creatorId) === KYCStatus.VERIFIED;
  }

  /**
   * Requests withdrawal of coins to fiat.
   * @param creatorId - Creator ID
   * @param amount - Amount in coins
   * @param fiatCurrency - Target fiat currency
   * @returns Withdrawal request ID
   */
  requestWithdrawal(
    creatorId: CreatorId,
    amount: CurrencyAmount,
    fiatCurrency: FiatCurrency
  ): string {
    this.ensureNotDisposed();

    if (amount.currency !== PLATFORM_CURRENCY) {
      throw new Error(`Only ${PLATFORM_CURRENCY} currency supported for withdrawals`);
    }

    // Check KYC status
    if (!this.isCreatorVerified(creatorId)) {
      throw new Error(
        `Creator ${creatorId} is not verified. KYC status: ${this.getKYCStatus(creatorId)}`
      );
    }

    // Check minimum withdrawal amount
    if (amount.amount < this.minWithdrawalAmount) {
      throw new Error(
        `Minimum withdrawal amount is ${this.minWithdrawalAmount} coins, got: ${amount.amount}`
      );
    }

    // Get creator wallet
    const creatorWalletId = `creator_${creatorId}`;
    const creatorWallet = this.currencyManager.getWallet(creatorWalletId);
    if (!creatorWallet) {
      throw new Error(`Creator wallet not found: ${creatorWalletId}`);
    }

    // Check balance
    if (!creatorWallet.hasBalance(PLATFORM_CURRENCY, amount.amount)) {
      throw new Error(`Insufficient balance: need ${amount.amount} coins`);
    }

    // Calculate fiat amount
    const fiatAmount = this.exchangeRate.coinsToFiat(amount.amount, fiatCurrency);

    // Create withdrawal request
    const requestId = `withdrawal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const request: WithdrawalRequest = {
      requestId,
      creatorId,
      amount,
      fiatCurrency,
      fiatAmount,
      requestedAt: Date.now(),
      status: 'pending',
    };

    this.withdrawalRequests.set(requestId, request);
    this.logger?.debug(
      `Withdrawal requested: ${requestId} for ${amount.amount} coins (${fiatAmount} ${fiatCurrency})`
    );

    return requestId;
  }

  /**
   * Processes a withdrawal request (moves coins from creator wallet to platform withdrawal wallet).
   * In real system, this would trigger external payment processing.
   */
  processWithdrawal(requestId: string): void {
    this.ensureNotDisposed();

    const request = this.withdrawalRequests.get(requestId);
    if (!request) {
      throw new Error(`Withdrawal request not found: ${requestId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Withdrawal request ${requestId} is not pending (status: ${request.status})`);
    }

    // Get creator wallet
    const creatorWalletId = `creator_${request.creatorId}`;
    const creatorWallet = this.currencyManager.getWallet(creatorWalletId);
    if (!creatorWallet) {
      throw new Error(`Creator wallet not found: ${creatorWalletId}`);
    }

    // Get platform withdrawal wallet (holds coins pending fiat payout)
    const platformWalletId = 'platform_withdrawals';
    let platformWallet = this.currencyManager.getWallet(platformWalletId);
    if (!platformWallet) {
      platformWallet = this.currencyManager.createWallet(platformWalletId);
    }

    // Withdraw from creator wallet
    try {
      creatorWallet.withdraw(request.amount, `Withdrawal request: ${requestId}`);
    } catch (error) {
      request.status = 'failed';
      request.failureReason = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error(`Withdrawal failed: ${requestId}`, error instanceof Error ? error : undefined);
      throw error;
    }

    // Deposit to platform withdrawal wallet
    platformWallet.deposit(request.amount, `Withdrawal processing: ${requestId}`);

    // Update request status
    request.status = 'processing';
    this.logger?.debug(`Withdrawal processing: ${requestId}`);

    // In real system, this would trigger external payment processor
    // For now, we'll mark it as completed immediately (simulated)
    this.completeWithdrawal(requestId);
  }

  /**
   * Completes a withdrawal (marks as completed - in real system would be called by payment processor).
   */
  completeWithdrawal(requestId: string): void {
    this.ensureNotDisposed();

    const request = this.withdrawalRequests.get(requestId);
    if (!request) {
      throw new Error(`Withdrawal request not found: ${requestId}`);
    }

    request.status = 'completed';
    request.completedAt = Date.now();
    this.logger?.debug(`Withdrawal completed: ${requestId}`);
  }

  /**
   * Cancels a withdrawal request.
   */
  cancelWithdrawal(requestId: string): void {
    this.ensureNotDisposed();

    const request = this.withdrawalRequests.get(requestId);
    if (!request) {
      throw new Error(`Withdrawal request not found: ${requestId}`);
    }

    if (request.status === 'completed') {
      throw new Error(`Cannot cancel completed withdrawal: ${requestId}`);
    }

    if (request.status === 'processing') {
      // Refund coins to creator wallet
      const creatorWalletId = `creator_${request.creatorId}`;
      const creatorWallet = this.currencyManager.getWallet(creatorWalletId);
      const platformWalletId = 'platform_withdrawals';
      const platformWallet = this.currencyManager.getWallet(platformWalletId);

      if (creatorWallet && platformWallet) {
        try {
          platformWallet.withdraw(request.amount, `Withdrawal cancellation: ${requestId}`);
          creatorWallet.deposit(request.amount, `Withdrawal refund: ${requestId}`);
        } catch (error) {
          this.logger?.error(`Failed to refund withdrawal: ${requestId}`, error instanceof Error ? error : undefined);
        }
      }
    }

    request.status = 'cancelled';
    this.logger?.debug(`Withdrawal cancelled: ${requestId}`);
  }

  /**
   * Gets withdrawal request by ID.
   */
  getWithdrawalRequest(requestId: string): WithdrawalRequest | null {
    this.ensureNotDisposed();
    return this.withdrawalRequests.get(requestId) ?? null;
  }

  /**
   * Gets all withdrawal requests for a creator.
   */
  getCreatorWithdrawals(creatorId: CreatorId): WithdrawalRequest[] {
    this.ensureNotDisposed();
    return Array.from(this.withdrawalRequests.values()).filter(
      (req) => req.creatorId === creatorId
    );
  }

  /**
   * Gets all pending withdrawal requests.
   */
  getPendingWithdrawals(): WithdrawalRequest[] {
    this.ensureNotDisposed();
    return Array.from(this.withdrawalRequests.values()).filter((req) => req.status === 'pending');
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.disposables.dispose();
    this.kycRecords.clear();
    this.withdrawalRequests.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('WithdrawalSystem has been disposed');
    }
  }
}

