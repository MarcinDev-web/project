import { EventBus } from '@engine/core/event';
import { DisposableGroup, type IDisposable } from '@engine/core/utils';
import type { Currency, CurrencyAmount, WalletId } from './types';
import { CurrencyWallet } from './CurrencyWallet';
import { CurrencyTransactionHistory } from './CurrencyTransactionHistory';
import { CurrencyEventNames, type WalletCreatedEvent } from './events';
import type { Transaction } from './Transaction';

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
export class CurrencyManager implements IDisposable {
  private readonly wallets = new Map<WalletId, CurrencyWallet>();
  private readonly currencies = new Set<Currency>();
  private readonly history: CurrencyTransactionHistory;
  private readonly disposables: DisposableGroup;
  private disposed = false;

  /**
   * Central EventBus for all currency events.
   */
  readonly events: EventBus;

  /**
   * @param maxHistorySize - Maximum number of transactions to keep in history
   */
  constructor(maxHistorySize = 100) {
    this.events = new EventBus();
    this.history = new CurrencyTransactionHistory(maxHistorySize);
    this.disposables = new DisposableGroup();

    // Subscribe to wallet events and add to history
    this.setupEventHandlers();
  }

  /**
   * Registers a currency type in the system.
   */
  registerCurrency(currency: Currency): void {
    this.ensureNotDisposed();

    if (!currency || typeof currency !== 'string') {
      throw new Error(`Currency must be a non-empty string, got: ${currency}`);
    }

    this.currencies.add(currency);
  }

  /**
   * Checks if a currency is registered.
   */
  isCurrencyRegistered(currency: Currency): boolean {
    this.ensureNotDisposed();
    return this.currencies.has(currency);
  }

  /**
   * Gets all registered currencies.
   */
  getRegisteredCurrencies(): Currency[] {
    this.ensureNotDisposed();
    return Array.from(this.currencies);
  }

  /**
   * Creates a new wallet for a player.
   * @param walletId - Unique wallet identifier
   * @param initialBalances - Optional initial balances
   */
  createWallet(walletId: WalletId, initialBalances?: Map<Currency, number>): CurrencyWallet {
    this.ensureNotDisposed();

    if (this.wallets.has(walletId)) {
      throw new Error(`Wallet ${walletId} already exists`);
    }

    const wallet = new CurrencyWallet(walletId, this.events);

    // Set initial balances if provided
    if (initialBalances) {
      for (const [currency, balance] of initialBalances.entries()) {
        if (this.currencies.size > 0 && !this.currencies.has(currency)) {
          throw new Error(`Currency ${currency} is not registered`);
        }
        wallet.setBalance(currency, balance);
      }
    }

    this.wallets.set(walletId, wallet);

    // Emit wallet created event
    const event: WalletCreatedEvent = { walletId };
    this.events.emit(CurrencyEventNames.WALLET_CREATED, event);

    return wallet;
  }

  /**
   * Gets a wallet by ID.
   */
  getWallet(walletId: WalletId): CurrencyWallet | null {
    this.ensureNotDisposed();
    return this.wallets.get(walletId) ?? null;
  }

  /**
   * Checks if a wallet exists.
   */
  hasWallet(walletId: WalletId): boolean {
    this.ensureNotDisposed();
    return this.wallets.has(walletId);
  }

  /**
   * Removes a wallet (calls dispose on it first).
   */
  removeWallet(walletId: WalletId): boolean {
    this.ensureNotDisposed();

    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      return false;
    }

    wallet.dispose();
    this.wallets.delete(walletId);
    return true;
  }

  /**
   * Gets all wallet IDs.
   */
  getAllWalletIds(): WalletId[] {
    this.ensureNotDisposed();
    return Array.from(this.wallets.keys());
  }

  /**
   * Gets the transaction history.
   */
  getHistory(): CurrencyTransactionHistory {
    this.ensureNotDisposed();
    return this.history;
  }

  /**
   * Calculates global statistics.
   */
  getStatistics(): CurrencyStatistics {
    this.ensureNotDisposed();

    const totalBalances = new Map<Currency, number>();

    for (const wallet of this.wallets.values()) {
      for (const balance of wallet.getAllBalances()) {
        const current = totalBalances.get(balance.currency) ?? 0;
        totalBalances.set(balance.currency, current + balance.balance);
      }
    }

    return {
      totalWallets: this.wallets.size,
      totalTransactions: this.history.size(),
      totalBalances,
    };
  }

  /**
   * Validates currency amount (checks if currency is registered if any currencies are registered).
   */
  validateAmount(amount: CurrencyAmount): void {
    this.ensureNotDisposed();

    if (!Number.isFinite(amount.amount) || amount.amount < 0) {
      throw new Error(`Amount must be non-negative and finite, got: ${amount.amount}`);
    }

    if (!amount.currency || typeof amount.currency !== 'string') {
      throw new Error(`Currency must be a non-empty string, got: ${amount.currency}`);
    }

    // If currencies are registered, validate currency exists
    if (this.currencies.size > 0 && !this.currencies.has(amount.currency)) {
      throw new Error(`Currency ${amount.currency} is not registered`);
    }
  }

  /**
   * Disposes the manager and all wallets.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Dispose all wallets
    for (const wallet of this.wallets.values()) {
      wallet.dispose();
    }
    this.wallets.clear();

    // Dispose event bus and other resources
    this.disposables.dispose();

    // Clear history
    this.history.clear();
    this.currencies.clear();
  }

  /**
   * Checks if manager is disposed.
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('CurrencyManager has been disposed');
    }
  }

  private setupEventHandlers(): void {
    // Subscribe to transaction events and add to history
    const unsubscribeCompleted = this.events.on(CurrencyEventNames.TRANSACTION_COMPLETED, (data) => {
      if (data && typeof data === 'object' && 'transaction' in data) {
        const event = data as { transaction: Transaction };
        this.history.add(event.transaction);
      }
    });

    const unsubscribeFailed = this.events.on(CurrencyEventNames.TRANSACTION_FAILED, (data) => {
      if (data && typeof data === 'object' && 'transaction' in data) {
        const event = data as { transaction: Transaction };
        this.history.add(event.transaction);
      }
    });

    this.disposables.add(unsubscribeCompleted);
    this.disposables.add(unsubscribeFailed);
  }
}

