import type { CurrencyAmount, WalletId } from './types';
import { TransactionStatus, TransactionType } from './types';

/**
 * Transaction metadata for additional information.
 */
export interface TransactionMetadata {
  [key: string]: unknown;
}

/**
 * Immutable transaction record.
 */
export class Transaction {
  /** Unique transaction ID */
  readonly id: string;
  /** Transaction timestamp (ms since epoch) */
  readonly timestamp: number;
  /** Transaction type */
  readonly type: TransactionType;
  /** Currency and amount */
  readonly amount: CurrencyAmount;
  /** Source wallet ID (optional, e.g., for deposits this might be null) */
  readonly fromWalletId: WalletId | null;
  /** Target wallet ID (optional, e.g., for withdrawals this might be null) */
  readonly toWalletId: WalletId | null;
  /** Transaction status */
  readonly status: TransactionStatus;
  /** Optional description */
  readonly description?: string;
  /** Optional metadata */
  readonly metadata?: TransactionMetadata;

  constructor(params: {
    id?: string;
    timestamp?: number;
    type: TransactionType;
    amount: CurrencyAmount;
    fromWalletId?: WalletId | null;
    toWalletId?: WalletId | null;
    status?: TransactionStatus;
    description?: string;
    metadata?: TransactionMetadata;
  }) {
    this.id = params.id ?? Transaction.generateId();
    this.timestamp = params.timestamp ?? Date.now();
    this.type = params.type;
    this.amount = { ...params.amount };
    this.fromWalletId = params.fromWalletId ?? null;
    this.toWalletId = params.toWalletId ?? null;
    this.status = params.status ?? TransactionStatus.PENDING;
    if (params.description !== undefined) {
      this.description = params.description;
    }
    if (params.metadata !== undefined) {
      this.metadata = { ...params.metadata };
    }

    // Validation
    Transaction.validate(this);
  }

  /**
   * Creates a copy of this transaction with updated fields.
   */
  with(
    updates: Partial<{
      status: TransactionStatus;
      description?: string;
      metadata?: TransactionMetadata;
    }>
  ): Transaction {
    const params: {
      id: string;
      timestamp: number;
      type: TransactionType;
      amount: CurrencyAmount;
      fromWalletId: WalletId | null;
      toWalletId: WalletId | null;
      status: TransactionStatus;
      description?: string;
      metadata?: TransactionMetadata;
    } = {
      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      amount: this.amount,
      fromWalletId: this.fromWalletId,
      toWalletId: this.toWalletId,
      status: updates.status ?? this.status,
    };

    if (updates.description !== undefined) {
      params.description = updates.description;
    } else if (this.description !== undefined) {
      params.description = this.description;
    }

    if (updates.metadata !== undefined) {
      params.metadata = updates.metadata;
    } else if (this.metadata !== undefined) {
      params.metadata = this.metadata;
    }

    return new Transaction(params);
  }

  /**
   * Checks if transaction is completed successfully.
   */
  isCompleted(): boolean {
    return this.status === TransactionStatus.COMPLETED;
  }

  /**
   * Checks if transaction failed.
   */
  isFailed(): boolean {
    return this.status === TransactionStatus.FAILED;
  }

  /**
   * Checks if transaction is pending.
   */
  isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }

  /**
   * Generates a unique transaction ID (timestamp-based).
   */
  private static generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Validates transaction data.
   */
  private static validate(transaction: Transaction): void {
    if (!Number.isFinite(transaction.amount.amount) || transaction.amount.amount < 0) {
      throw new Error(
        `Transaction amount must be non-negative and finite, got: ${transaction.amount.amount}`
      );
    }

    if (!transaction.amount.currency || typeof transaction.amount.currency !== 'string') {
      throw new Error(
        `Transaction currency must be a non-empty string, got: ${transaction.amount.currency}`
      );
    }

    if (transaction.type === TransactionType.TRANSFER) {
      if (!transaction.fromWalletId || !transaction.toWalletId) {
        throw new Error('Transfer transaction requires both fromWalletId and toWalletId');
      }
      if (transaction.fromWalletId === transaction.toWalletId) {
        throw new Error('Transfer transaction cannot have same source and target wallet');
      }
    }

    if (transaction.type === TransactionType.EXCHANGE) {
      if (!transaction.fromWalletId || !transaction.toWalletId) {
        throw new Error('Exchange transaction requires both fromWalletId and toWalletId');
      }
    }
  }
}
