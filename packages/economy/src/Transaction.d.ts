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
export declare class Transaction {
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
    });
    /**
     * Creates a copy of this transaction with updated fields.
     */
    with(updates: Partial<{
        status: TransactionStatus;
        description?: string;
        metadata?: TransactionMetadata;
    }>): Transaction;
    /**
     * Checks if transaction is completed successfully.
     */
    isCompleted(): boolean;
    /**
     * Checks if transaction failed.
     */
    isFailed(): boolean;
    /**
     * Checks if transaction is pending.
     */
    isPending(): boolean;
    /**
     * Generates a unique transaction ID (timestamp-based).
     */
    private static generateId;
    /**
     * Validates transaction data.
     */
    private static validate;
}
//# sourceMappingURL=Transaction.d.ts.map