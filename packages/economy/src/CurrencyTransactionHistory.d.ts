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
export declare class CurrencyTransactionHistory {
    private transactions;
    private readonly maxSize;
    constructor(maxSize?: number);
    /**
     * Gets the maximum history size.
     */
    get limit(): number;
    /**
     * Adds a transaction to history.
     * If history is full, removes oldest transaction.
     */
    add(transaction: Transaction): void;
    /**
     * Gets all transactions matching the filter.
     */
    getAll(filter?: TransactionFilter): Transaction[];
    /**
     * Gets the latest transaction.
     */
    getLatest(filter?: TransactionFilter): Transaction | null;
    /**
     * Gets transactions in reverse chronological order (newest first).
     */
    getRecent(count: number, filter?: TransactionFilter): Transaction[];
    /**
     * Gets the number of transactions.
     */
    size(filter?: TransactionFilter): number;
    /**
     * Calculates metrics for transactions matching the filter.
     */
    getMetrics(filter?: TransactionFilter): TransactionMetrics;
    /**
     * Exports all transactions (for serialization).
     */
    export(): Transaction[];
    /**
     * Imports transactions (replaces current history).
     */
    import(transactions: Transaction[]): void;
    /**
     * Clears all transactions.
     */
    clear(): void;
    /**
     * Filters transactions based on criteria.
     */
    private filter;
    /**
     * Clones a transaction to ensure immutability.
     */
    private cloneTransaction;
}
//# sourceMappingURL=CurrencyTransactionHistory.d.ts.map