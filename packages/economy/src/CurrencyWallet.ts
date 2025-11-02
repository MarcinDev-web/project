import { EventBus } from '@engine/core/event';
import type { IDisposable } from '@engine/core/utils';
import type {
  Currency,
  CurrencyAmount,
  CurrencyBalance,
  WalletId,
} from './types';
import { TransactionStatus, TransactionType } from './types';
import {
  type BalanceChangedEvent,
  CurrencyEventNames,
  type CurrencyDepositedEvent,
  type CurrencyExchangedEvent,
  type CurrencyTransferredEvent,
  type CurrencyWithdrawnEvent,
  type TransactionCompletedEvent,
  type TransactionFailedEvent,
} from './events';
import { Transaction } from './Transaction';

/**
 * Wallet for managing currency balances for a player.
 */
export class CurrencyWallet implements IDisposable {
  private readonly balances = new Map<Currency, number>();
  private disposed = false;

  /**
   * @param id - Unique wallet identifier
   * @param events - Optional EventBus for emitting events (if null, wallet won't emit events)
   */
  constructor(
    public readonly id: WalletId,
    private readonly events: EventBus | null = null,
  ) {}

  /**
   * Gets balance for a currency (returns 0 if currency not found).
   */
  balance(currency: Currency): number {
    this.ensureNotDisposed();
    return this.balances.get(currency) ?? 0;
  }

  /**
   * Gets all currency balances.
   */
  getAllBalances(): CurrencyBalance[] {
    this.ensureNotDisposed();
    return Array.from(this.balances.entries()).map(([currency, balance]) => ({
      currency,
      balance,
    }));
  }

  /**
   * Deposits currency into this wallet.
   * @param amount - Currency amount to deposit
   * @param description - Optional transaction description
   * @returns Created transaction
   * @throws Error if amount is invalid or wallet is disposed
   */
  deposit(amount: CurrencyAmount, description?: string): Transaction {
    this.ensureNotDisposed();
    CurrencyWallet.validateAmount(amount);

    const transaction = new Transaction({
      type: TransactionType.DEPOSIT,
      amount,
      toWalletId: this.id,
      status: TransactionStatus.COMPLETED,
      ...(description !== undefined ? { description } : {}),
    });

    const previousBalance = this.balance(amount.currency);
    const newBalance = previousBalance + amount.amount;
    this.balances.set(amount.currency, newBalance);

    this.emitDeposited(transaction, previousBalance, newBalance);

    return transaction;
  }

  /**
   * Withdraws currency from this wallet.
   * @param amount - Currency amount to withdraw
   * @param description - Optional transaction description
   * @returns Created transaction
   * @throws Error if amount is invalid, insufficient balance, or wallet is disposed
   */
  withdraw(amount: CurrencyAmount, description?: string): Transaction {
    this.ensureNotDisposed();
    CurrencyWallet.validateAmount(amount);

    const currentBalance = this.balance(amount.currency);
    if (currentBalance < amount.amount) {
      const transaction = new Transaction({
        type: TransactionType.WITHDRAWAL,
        amount,
        fromWalletId: this.id,
        status: TransactionStatus.FAILED,
        ...(description !== undefined ? { description } : {}),
      });

      this.emitFailed(transaction, new Error(`Insufficient balance: ${currentBalance} < ${amount.amount}`));
      throw new Error(`Insufficient balance: have ${currentBalance}, need ${amount.amount} ${amount.currency}`);
    }

    const transaction = new Transaction({
      type: TransactionType.WITHDRAWAL,
      amount,
      fromWalletId: this.id,
      status: TransactionStatus.COMPLETED,
      ...(description !== undefined ? { description } : {}),
    });

    const previousBalance = currentBalance;
    const newBalance = previousBalance - amount.amount;
    this.balances.set(amount.currency, newBalance);

    this.emitWithdrawn(transaction, previousBalance, newBalance);

    return transaction;
  }

  /**
   * Transfers currency from this wallet to another wallet.
   * @param to - Target wallet
   * @param amount - Currency amount to transfer
   * @param description - Optional transaction description
   * @returns Created transaction
   * @throws Error if amount is invalid, insufficient balance, or wallet is disposed
   */
  transfer(to: CurrencyWallet, amount: CurrencyAmount, description?: string): Transaction {
    this.ensureNotDisposed();
    to.ensureNotDisposed();

    CurrencyWallet.validateAmount(amount);

    const currentBalance = this.balance(amount.currency);
    if (currentBalance < amount.amount) {
      const transaction = new Transaction({
        type: TransactionType.TRANSFER,
        amount,
        fromWalletId: this.id,
        toWalletId: to.id,
        status: TransactionStatus.FAILED,
        ...(description !== undefined ? { description } : {}),
      });

      this.emitFailed(transaction, new Error(`Insufficient balance: ${currentBalance} < ${amount.amount}`));
      throw new Error(`Insufficient balance: have ${currentBalance}, need ${amount.amount} ${amount.currency}`);
    }

    const transaction = new Transaction({
      type: TransactionType.TRANSFER,
      amount,
      fromWalletId: this.id,
      toWalletId: to.id,
      status: TransactionStatus.COMPLETED,
      ...(description !== undefined ? { description } : {}),
    });

    // Update source wallet
    const fromPreviousBalance = currentBalance;
    const fromNewBalance = fromPreviousBalance - amount.amount;
    this.balances.set(amount.currency, fromNewBalance);

    // Update target wallet
    const toPreviousBalance = to.balance(amount.currency);
    const toNewBalance = toPreviousBalance + amount.amount;
    to.balances.set(amount.currency, toNewBalance);

    this.emitTransferred(transaction, to, fromPreviousBalance, fromNewBalance, toPreviousBalance, toNewBalance);

    return transaction;
  }

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
  exchange(
    fromCurrency: Currency,
    toCurrency: Currency,
    fromAmount: number,
    exchangeRate: number,
    description?: string,
  ): Transaction {
    this.ensureNotDisposed();

    if (!Number.isFinite(fromAmount) || fromAmount < 0) {
      throw new Error(`Exchange fromAmount must be non-negative and finite, got: ${fromAmount}`);
    }

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new Error(`Exchange rate must be positive and finite, got: ${exchangeRate}`);
    }

    if (fromCurrency === toCurrency) {
      throw new Error('Cannot exchange currency to itself');
    }

    const currentBalance = this.balance(fromCurrency);
    if (currentBalance < fromAmount) {
      const transaction = new Transaction({
        type: TransactionType.EXCHANGE,
        amount: { currency: fromCurrency, amount: fromAmount },
        fromWalletId: this.id,
        toWalletId: this.id,
        status: TransactionStatus.FAILED,
        ...(description !== undefined ? { description } : {}),
      });

      this.emitFailed(transaction, new Error(`Insufficient balance: ${currentBalance} < ${fromAmount}`));
      throw new Error(`Insufficient balance: have ${currentBalance}, need ${fromAmount} ${fromCurrency}`);
    }

    const toAmount = fromAmount * exchangeRate;

    const transaction = new Transaction({
      type: TransactionType.EXCHANGE,
      amount: { currency: fromCurrency, amount: fromAmount },
      fromWalletId: this.id,
      toWalletId: this.id,
      status: TransactionStatus.COMPLETED,
      ...(description !== undefined ? { description } : {}),
      metadata: {
        toCurrency,
        toAmount,
        exchangeRate,
      },
    });

    // Update balances
    const fromPreviousBalance = currentBalance;
    const fromNewBalance = fromPreviousBalance - fromAmount;
    this.balances.set(fromCurrency, fromNewBalance);

    const toPreviousBalance = this.balance(toCurrency);
    const toNewBalance = toPreviousBalance + toAmount;
    this.balances.set(toCurrency, toNewBalance);

    this.emitExchanged(transaction, fromCurrency, toCurrency, fromAmount, toAmount, exchangeRate, fromPreviousBalance, fromNewBalance, toPreviousBalance, toNewBalance);

    return transaction;
  }

  /**
   * Checks if wallet has sufficient balance for an amount.
   */
  hasBalance(currency: Currency, amount: number): boolean {
    this.ensureNotDisposed();
    return this.balance(currency) >= amount;
  }

  /**
   * Sets balance directly (internal use, does not create transaction).
   * @internal
   */
  setBalance(currency: Currency, balance: number): void {
    this.ensureNotDisposed();
    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error(`Balance must be non-negative and finite, got: ${balance}`);
    }
    this.balances.set(currency, balance);
  }

  /**
   * Disposes the wallet, clearing all balances.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.events) {
      this.events.emit(CurrencyEventNames.WALLET_DISPOSED, { walletId: this.id });
    }

    this.balances.clear();
  }

  /**
   * Checks if wallet is disposed.
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error(`Wallet ${this.id} has been disposed`);
    }
  }

  private static validateAmount(amount: CurrencyAmount): void {
    if (!Number.isFinite(amount.amount) || amount.amount < 0) {
      throw new Error(`Amount must be non-negative and finite, got: ${amount.amount}`);
    }

    if (!amount.currency || typeof amount.currency !== 'string') {
      throw new Error(`Currency must be a non-empty string, got: ${amount.currency}`);
    }
  }

  private emitDeposited(transaction: Transaction, previousBalance: number, newBalance: number): void {
    if (!this.events) return;

    const event: CurrencyDepositedEvent = {
      walletId: this.id,
      amount: transaction.amount,
      transaction,
      newBalance: {
        currency: transaction.amount.currency,
        balance: newBalance,
      },
    };

    this.events.emit(CurrencyEventNames.DEPOSITED, event);
    this.events.emit(CurrencyEventNames.TRANSACTION_COMPLETED, { transaction } as TransactionCompletedEvent);
    this.emitBalanceChanged(transaction, transaction.amount.currency, previousBalance, newBalance);
  }

  private emitWithdrawn(transaction: Transaction, previousBalance: number, newBalance: number): void {
    if (!this.events) return;

    const event: CurrencyWithdrawnEvent = {
      walletId: this.id,
      amount: transaction.amount,
      transaction,
      newBalance: {
        currency: transaction.amount.currency,
        balance: newBalance,
      },
    };

    this.events.emit(CurrencyEventNames.WITHDRAWN, event);
    this.events.emit(CurrencyEventNames.TRANSACTION_COMPLETED, { transaction } as TransactionCompletedEvent);
    this.emitBalanceChanged(transaction, transaction.amount.currency, previousBalance, newBalance);
  }

  private emitTransferred(
    transaction: Transaction,
    to: CurrencyWallet,
    fromPreviousBalance: number,
    fromNewBalance: number,
    _toPreviousBalance: number,
    toNewBalance: number,
  ): void {
    if (!this.events) return;

    const event: CurrencyTransferredEvent = {
      fromWalletId: this.id,
      toWalletId: to.id,
      amount: transaction.amount,
      transaction,
      fromNewBalance: {
        currency: transaction.amount.currency,
        balance: fromNewBalance,
      },
      toNewBalance: {
        currency: transaction.amount.currency,
        balance: toNewBalance,
      },
    };

    this.events.emit(CurrencyEventNames.TRANSFERRED, event);
    this.events.emit(CurrencyEventNames.TRANSACTION_COMPLETED, { transaction } as TransactionCompletedEvent);
    this.emitBalanceChanged(transaction, transaction.amount.currency, fromPreviousBalance, fromNewBalance);
  }

  private emitExchanged(
    transaction: Transaction,
    fromCurrency: Currency,
    toCurrency: Currency,
    fromAmount: number,
    toAmount: number,
    exchangeRate: number,
    fromPreviousBalance: number,
    fromNewBalance: number,
    toPreviousBalance: number,
    toNewBalance: number,
  ): void {
    if (!this.events) return;

    const event: CurrencyExchangedEvent = {
      walletId: this.id,
      fromAmount: { currency: fromCurrency, amount: fromAmount },
      toAmount: { currency: toCurrency, amount: toAmount },
      exchangeRate,
      transaction,
      fromNewBalance: {
        currency: fromCurrency,
        balance: fromNewBalance,
      },
      toNewBalance: {
        currency: toCurrency,
        balance: toNewBalance,
      },
    };

    this.events.emit(CurrencyEventNames.EXCHANGED, event);
    this.events.emit(CurrencyEventNames.TRANSACTION_COMPLETED, { transaction } as TransactionCompletedEvent);
    this.emitBalanceChanged(transaction, fromCurrency, fromPreviousBalance, fromNewBalance);
    this.emitBalanceChanged(transaction, toCurrency, toPreviousBalance, toNewBalance);
  }

  private emitBalanceChanged(transaction: Transaction, currency: Currency, previousBalance: number, newBalance: number): void {
    if (!this.events) return;

    const event: BalanceChangedEvent = {
      walletId: this.id,
      currency,
      previousBalance,
      newBalance,
      transaction,
    };

    this.events.emit(CurrencyEventNames.BALANCE_CHANGED, event);
  }

  private emitFailed(transaction: Transaction, error: Error): void {
    if (!this.events) return;

    const event: TransactionFailedEvent = {
      transaction,
      error,
    };

    this.events.emit(CurrencyEventNames.TRANSACTION_FAILED, event);
  }
}

