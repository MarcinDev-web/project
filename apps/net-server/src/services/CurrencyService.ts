/**
 * Currency Service - Wrapper for @engine/economy CurrencyManager
 * Provides server-side wallet management and transaction handling
 */

import { CurrencyManager, CurrencyWallet, type CurrencyAmount } from '@engine/economy';

export class CurrencyService {
  private readonly manager: CurrencyManager;
  private readonly wallets = new Map<string, CurrencyWallet>();

  constructor() {
    this.manager = new CurrencyManager();
    // Register default currencies
    this.manager.registerCurrency('coins');
    this.manager.registerCurrency('gems');
    this.manager.registerCurrency('credits');
  }

  /**
   * Get or create wallet for user
   */
  getWallet(userId: string): CurrencyWallet {
    let wallet = this.wallets.get(userId);
    if (!wallet) {
      wallet = this.manager.createWallet(userId);
      this.wallets.set(userId, wallet);
    }
    return wallet;
  }

  /**
   * Check if user has sufficient balance for a purchase
   */
  hasBalance(userId: string, required: CurrencyAmount): boolean {
    const wallet = this.getWallet(userId);
    return wallet.balance(required.currency) >= required.amount;
  }

  /**
   * Withdraw currency from user wallet (for purchases)
   */
  withdraw(userId: string, amount: CurrencyAmount, description: string): void {
    const wallet = this.getWallet(userId);
    wallet.withdraw(amount, description);
  }

  /**
   * Deposit currency to user wallet
   */
  deposit(userId: string, amount: CurrencyAmount, description: string): void {
    const wallet = this.getWallet(userId);
    wallet.deposit(amount, description);
  }

  /**
   * Get balance for a specific currency
   */
  getBalance(userId: string, currency: string): number {
    const wallet = this.getWallet(userId);
    return wallet.balance(currency);
  }

  /**
   * Get all balances for a user
   */
  getAllBalances(userId: string): Map<string, number> {
    const wallet = this.getWallet(userId);
    const balances = new Map<string, number>();
    for (const currency of ['coins', 'gems', 'credits'] as const) {
      balances.set(currency, wallet.balance(currency));
    }
    return balances;
  }

  /**
   * Get the currency manager (for event subscriptions)
   */
  getManager(): CurrencyManager {
    return this.manager;
  }

  /**
   * Cleanup - dispose wallets
   */
  dispose(): void {
    for (const wallet of this.wallets.values()) {
      wallet.dispose();
    }
    this.wallets.clear();
    this.manager.dispose();
  }
}
