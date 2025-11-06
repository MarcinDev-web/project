import { EventBus } from '@engine/core/event';
import { type IDisposable } from '@engine/core/utils';
import type { Currency, CurrencyAmount, WalletId } from './types';
import { CurrencyWallet } from './CurrencyWallet';
import { CurrencyTransactionHistory } from './CurrencyTransactionHistory';
/**
 * Global currency statistics.
 */
export interface CurrencyStatistics {
    /** Total number of registered wallets */
    totalWallets: number;
    /** Total number of transactions */
    totalTransactions: number;
    /** Total balance per currency across all wallets */
    totalBalances: Map<Currency, number>;
}
/**
 * Main manager for the currency system.
 * Handles wallet management, currency registration, and provides central event bus.
 */
export declare class CurrencyManager implements IDisposable {
    private readonly wallets;
    private readonly currencies;
    private readonly history;
    private readonly disposables;
    private disposed;
    /**
     * Central EventBus for all currency events.
     */
    readonly events: EventBus;
    /**
     * @param maxHistorySize - Maximum number of transactions to keep in history
     */
    constructor(maxHistorySize?: number);
    /**
     * Registers a currency type in the system.
     */
    registerCurrency(currency: Currency): void;
    /**
     * Checks if a currency is registered.
     */
    isCurrencyRegistered(currency: Currency): boolean;
    /**
     * Gets all registered currencies.
     */
    getRegisteredCurrencies(): Currency[];
    /**
     * Creates a new wallet for a player.
     * @param walletId - Unique wallet identifier
     * @param initialBalances - Optional initial balances
     */
    createWallet(walletId: WalletId, initialBalances?: Map<Currency, number>): CurrencyWallet;
    /**
     * Gets a wallet by ID.
     */
    getWallet(walletId: WalletId): CurrencyWallet | null;
    /**
     * Checks if a wallet exists.
     */
    hasWallet(walletId: WalletId): boolean;
    /**
     * Removes a wallet (calls dispose on it first).
     */
    removeWallet(walletId: WalletId): boolean;
    /**
     * Gets all wallet IDs.
     */
    getAllWalletIds(): WalletId[];
    /**
     * Gets the transaction history.
     */
    getHistory(): CurrencyTransactionHistory;
    /**
     * Calculates global statistics.
     */
    getStatistics(): CurrencyStatistics;
    /**
     * Validates currency amount (checks if currency is registered if any currencies are registered).
     */
    validateAmount(amount: CurrencyAmount): void;
    /**
     * Disposes the manager and all wallets.
     */
    dispose(): void;
    /**
     * Checks if manager is disposed.
     */
    isDisposed(): boolean;
    private ensureNotDisposed;
    private setupEventHandlers;
}
//# sourceMappingURL=CurrencyManager.d.ts.map