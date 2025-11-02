import type { Currency, CurrencyAmount, CurrencyBalance, WalletId } from './types';
import type { Transaction } from './Transaction';
/**
 * Event emitted when currency is deposited into a wallet.
 */
export interface CurrencyDepositedEvent {
    walletId: WalletId;
    amount: CurrencyAmount;
    transaction: Transaction;
    newBalance: CurrencyBalance;
}
/**
 * Event emitted when currency is withdrawn from a wallet.
 */
export interface CurrencyWithdrawnEvent {
    walletId: WalletId;
    amount: CurrencyAmount;
    transaction: Transaction;
    newBalance: CurrencyBalance;
}
/**
 * Event emitted when currency is transferred between wallets.
 */
export interface CurrencyTransferredEvent {
    fromWalletId: WalletId;
    toWalletId: WalletId;
    amount: CurrencyAmount;
    transaction: Transaction;
    fromNewBalance: CurrencyBalance;
    toNewBalance: CurrencyBalance;
}
/**
 * Event emitted when currency is exchanged (converted from one type to another).
 */
export interface CurrencyExchangedEvent {
    walletId: WalletId;
    fromAmount: CurrencyAmount;
    toAmount: CurrencyAmount;
    exchangeRate: number;
    transaction: Transaction;
    fromNewBalance: CurrencyBalance;
    toNewBalance: CurrencyBalance;
}
/**
 * Event emitted when a transaction is completed.
 */
export interface TransactionCompletedEvent {
    transaction: Transaction;
}
/**
 * Event emitted when a transaction fails.
 */
export interface TransactionFailedEvent {
    transaction: Transaction;
    error: Error;
}
/**
 * Event emitted when wallet balance changes.
 */
export interface BalanceChangedEvent {
    walletId: WalletId;
    currency: Currency;
    previousBalance: number;
    newBalance: number;
    transaction: Transaction;
}
/**
 * Event emitted when a wallet is created.
 */
export interface WalletCreatedEvent {
    walletId: WalletId;
}
/**
 * Event emitted when a wallet is disposed.
 */
export interface WalletDisposedEvent {
    walletId: WalletId;
}
/**
 * Union type of all currency events.
 */
export type CurrencyEvent = CurrencyDepositedEvent | CurrencyWithdrawnEvent | CurrencyTransferredEvent | CurrencyExchangedEvent | TransactionCompletedEvent | TransactionFailedEvent | BalanceChangedEvent | WalletCreatedEvent | WalletDisposedEvent;
/**
 * Event name constants for type-safe event handling.
 */
export declare const CurrencyEventNames: {
    readonly DEPOSITED: "currency:deposited";
    readonly WITHDRAWN: "currency:withdrawn";
    readonly TRANSFERRED: "currency:transferred";
    readonly EXCHANGED: "currency:exchanged";
    readonly TRANSACTION_COMPLETED: "currency:transaction:completed";
    readonly TRANSACTION_FAILED: "currency:transaction:failed";
    readonly BALANCE_CHANGED: "currency:balance:changed";
    readonly WALLET_CREATED: "currency:wallet:created";
    readonly WALLET_DISPOSED: "currency:wallet:disposed";
};
//# sourceMappingURL=events.d.ts.map