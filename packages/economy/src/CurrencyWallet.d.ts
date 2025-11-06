import { EventBus } from '@engine/core/event';
import type { IDisposable } from '@engine/core/utils';
import type { Currency, CurrencyAmount, CurrencyBalance, WalletId } from './types';
import { Transaction } from './Transaction';
/**
 * Wallet for managing currency balances for a player.
 */
export declare class CurrencyWallet implements IDisposable {
    readonly id: WalletId;
    private readonly events;
    private readonly balances;
    private disposed;
    /**
     * @param id - Unique wallet identifier
     * @param events - Optional EventBus for emitting events (if null, wallet won't emit events)
     */
    constructor(id: WalletId, events?: EventBus | null);
    /**
     * Gets balance for a currency (returns 0 if currency not found).
     */
    balance(currency: Currency): number;
    /**
     * Gets all currency balances.
     */
    getAllBalances(): CurrencyBalance[];
    /**
     * Deposits currency into this wallet.
     * @param amount - Currency amount to deposit
     * @param description - Optional transaction description
     * @returns Created transaction
     * @throws Error if amount is invalid or wallet is disposed
     */
    deposit(amount: CurrencyAmount, description?: string): Transaction;
    /**
     * Withdraws currency from this wallet.
     * @param amount - Currency amount to withdraw
     * @param description - Optional transaction description
     * @returns Created transaction
     * @throws Error if amount is invalid, insufficient balance, or wallet is disposed
     */
    withdraw(amount: CurrencyAmount, description?: string): Transaction;
    /**
     * Transfers currency from this wallet to another wallet.
     * @param to - Target wallet
     * @param amount - Currency amount to transfer
     * @param description - Optional transaction description
     * @returns Created transaction
     * @throws Error if amount is invalid, insufficient balance, or wallet is disposed
     */
    transfer(to: CurrencyWallet, amount: CurrencyAmount, description?: string): Transaction;
    /**
     * Exchanges currency from one type to another using an exchange rate.
     * @param fromCurrency - Currency to exchange from
     * @param toCurrency - Currency to exchange to
     * @param fromAmount - Amount of source currency
     * @param exchangeRate - Exchange rate (toAmount = fromAmount * exchangeRate)
     * @param description - Optional transaction description
     * @returns Created transaction
     * @throws Error if currencies are invalid, insufficient balance, or wallet is disposed
     */
    exchange(fromCurrency: Currency, toCurrency: Currency, fromAmount: number, exchangeRate: number, description?: string): Transaction;
    /**
     * Checks if wallet has sufficient balance for an amount.
     */
    hasBalance(currency: Currency, amount: number): boolean;
    /**
     * Sets balance directly (internal use, does not create transaction).
     * @internal
     */
    setBalance(currency: Currency, balance: number): void;
    /**
     * Disposes the wallet, clearing all balances.
     */
    dispose(): void;
    /**
     * Checks if wallet is disposed.
     */
    isDisposed(): boolean;
    private ensureNotDisposed;
    private static validateAmount;
    private emitDeposited;
    private emitWithdrawn;
    private emitTransferred;
    private emitExchanged;
    private emitBalanceChanged;
    private emitFailed;
}
//# sourceMappingURL=CurrencyWallet.d.ts.map