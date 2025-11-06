import type { Currency, WalletId } from './types';
import { Transaction } from './Transaction';
import { TransactionStatus, TransactionType } from './types';

/**
 * Filter options for querying transaction history.
 */
export interface TransactionFilter {
  /** Filter by currency */
  currency?: Currency;
  /** Filter by wallet ID (from or to) */
  walletId?: WalletId;
  /** Filter by transaction type */
  type?: TransactionType;
  /** Filter by status */
  status?: TransactionStatus;
  /** Filter by start timestamp (inclusive) */
  fromTimestamp?: number;
  /** Filter by end timestamp (inclusive) */
  toTimestamp?: number;
}

/**
 * Transaction metrics.
 */
export interface TransactionMetrics {
  /** Total number of transactions */
  totalCount: number;
  /** Total deposited amount (sum of all deposits) */
  totalDeposited: number;
  /** Total withdrawn amount (sum of all withdrawals) */
  totalWithdrawn: number;
  /** Total transferred amount (sum of all transfers) */
  totalTransferred: number;
  /** Count by transaction type */
  countByType: Record<TransactionType, number>;
  /** Count by status */
  countByStatus: Record<TransactionStatus, number>;
}

/**
 * Manages transaction history with filtering, metrics, and size limits.
 */
export class CurrencyTransactionHistory {
  private transactions: Transaction[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 100) {
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new Error(`Max size must be positive, got: ${maxSize}`);
    }
    this.maxSize = Math.floor(maxSize);
  }

  /**
   * Gets the maximum history size.
   */
  get limit(): number {
    return this.maxSize;
  }

  /**
   * Adds a transaction to history.
   * If history is full, removes oldest transaction.
   */
  add(transaction: Transaction): void {
    // Clone to ensure immutability
    const cloned = this.cloneTransaction(transaction);
    this.transactions.push(cloned);

    // Enforce size limit (remove oldest)
    if (this.transactions.length > this.maxSize) {
      this.transactions.shift();
    }
  }

  /**
   * Gets all transactions matching the filter.
   */
  getAll(filter?: TransactionFilter): Transaction[] {
    return this.filter(this.transactions, filter).map((tx) => this.cloneTransaction(tx));
  }

  /**
   * Gets the latest transaction.
   */
  getLatest(filter?: TransactionFilter): Transaction | null {
    const filtered = this.filter(this.transactions, filter);
    if (filtered.length === 0) {
      return null;
    }
    return this.cloneTransaction(filtered[filtered.length - 1]!);
  }

  /**
   * Gets transactions in reverse chronological order (newest first).
   */
  getRecent(count: number, filter?: TransactionFilter): Transaction[] {
    const filtered = this.filter(this.transactions, filter);
    const start = Math.max(0, filtered.length - count);
    return filtered
      .slice(start)
      .reverse()
      .map((tx) => this.cloneTransaction(tx));
  }

  /**
   * Gets the number of transactions.
   */
  size(filter?: TransactionFilter): number {
    return this.filter(this.transactions, filter).length;
  }

  /**
   * Calculates metrics for transactions matching the filter.
   */
  getMetrics(filter?: TransactionFilter): TransactionMetrics {
    const filtered = this.filter(this.transactions, filter);

    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalTransferred = 0;

    const countByType: Record<TransactionType, number> = {
      [TransactionType.DEPOSIT]: 0,
      [TransactionType.WITHDRAWAL]: 0,
      [TransactionType.TRANSFER]: 0,
      [TransactionType.EXCHANGE]: 0,
    };

    const countByStatus: Record<TransactionStatus, number> = {
      [TransactionStatus.PENDING]: 0,
      [TransactionStatus.COMPLETED]: 0,
      [TransactionStatus.FAILED]: 0,
      [TransactionStatus.CANCELLED]: 0,
    };

    for (const tx of filtered) {
      countByType[tx.type]++;
      countByStatus[tx.status]++;

      if (tx.status === TransactionStatus.COMPLETED) {
        switch (tx.type) {
          case TransactionType.DEPOSIT:
            totalDeposited += tx.amount.amount;
            break;
          case TransactionType.WITHDRAWAL:
            totalWithdrawn += tx.amount.amount;
            break;
          case TransactionType.TRANSFER:
            totalTransferred += tx.amount.amount;
            break;
          case TransactionType.EXCHANGE:
            // Exchanges don't contribute to these totals
            break;
        }
      }
    }

    return {
      totalCount: filtered.length,
      totalDeposited,
      totalWithdrawn,
      totalTransferred,
      countByType,
      countByStatus,
    };
  }

  /**
   * Exports all transactions (for serialization).
   */
  export(): Transaction[] {
    return this.transactions.map((tx) => this.cloneTransaction(tx));
  }

  /**
   * Imports transactions (replaces current history).
   */
  import(transactions: Transaction[]): void {
    this.transactions = transactions.map((tx) => this.cloneTransaction(tx)).slice(-this.maxSize);
  }

  /**
   * Clears all transactions.
   */
  clear(): void {
    this.transactions = [];
  }

  /**
   * Filters transactions based on criteria.
   */
  private filter(transactions: Transaction[], filter?: TransactionFilter): Transaction[] {
    if (!filter) {
      return transactions;
    }

    return transactions.filter((tx) => {
      if (filter.currency && tx.amount.currency !== filter.currency) {
        return false;
      }

      if (filter.walletId) {
        const walletId = filter.walletId;
        if (tx.fromWalletId !== walletId && tx.toWalletId !== walletId) {
          return false;
        }
      }

      if (filter.type && tx.type !== filter.type) {
        return false;
      }

      if (filter.status && tx.status !== filter.status) {
        return false;
      }

      if (filter.fromTimestamp !== undefined && tx.timestamp < filter.fromTimestamp) {
        return false;
      }

      if (filter.toTimestamp !== undefined && tx.timestamp > filter.toTimestamp) {
        return false;
      }

      return true;
    });
  }

  /**
   * Clones a transaction to ensure immutability.
   */
  private cloneTransaction(transaction: Transaction): Transaction {
    const params: {
      id: string;
      timestamp: number;
      type: TransactionType;
      amount: { currency: Currency; amount: number };
      fromWalletId: WalletId | null;
      toWalletId: WalletId | null;
      status: TransactionStatus;
      description?: string;
      metadata?: { [key: string]: unknown };
    } = {
      id: transaction.id,
      timestamp: transaction.timestamp,
      type: transaction.type,
      amount: { ...transaction.amount },
      fromWalletId: transaction.fromWalletId,
      toWalletId: transaction.toWalletId,
      status: transaction.status,
    };

    if (transaction.description !== undefined) {
      params.description = transaction.description;
    }

    if (transaction.metadata !== undefined) {
      params.metadata = { ...transaction.metadata };
    }

    return new Transaction(params);
  }
}
