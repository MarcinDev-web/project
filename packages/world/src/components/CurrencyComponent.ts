import { Component } from './Component';
import { registerComponent } from './registry';
import type { CurrencyManager, CurrencyWallet } from '@engine/economy';
import type { CurrencyAmount } from '@engine/economy';

/**
 * CurrencyComponent provides currency wallet functionality to entities.
 * Requires a CurrencyManager to be available in the world context.
 */
export class CurrencyComponent extends Component {
  static readonly type = 'Currency';

  /** Reference to the currency wallet (managed by CurrencyManager) */
  private wallet: CurrencyWallet | null = null;

  /** Wallet ID for this entity (used to retrieve wallet from manager) */
  walletId: string;

  /** Reference to the currency manager (should be set externally) */
  private manager: CurrencyManager | null = null;

  /**
   * @param walletId - Unique wallet identifier (typically entity ID or player ID)
   */
  constructor(walletId?: string) {
    super();
    // Use entity ID if available, otherwise use provided walletId or generate
    this.walletId = walletId ?? `wallet_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Sets the currency manager reference.
   * This should be called by a system that has access to the global CurrencyManager.
   */
  setManager(manager: CurrencyManager): void {
    this.manager = manager;

    // Create or get wallet for this entity
    let wallet = manager.getWallet(this.walletId);
    if (!wallet) {
      wallet = manager.createWallet(this.walletId);
    }
    this.wallet = wallet;
  }

  /**
   * Gets the currency wallet.
   * @throws Error if manager not set
   */
  getWallet(): CurrencyWallet {
    if (!this.wallet) {
      throw new Error(`CurrencyComponent: Wallet not initialized. Call setManager() first or ensure entity has wallet.`);
    }
    return this.wallet;
  }

  /**
   * Gets balance for a currency.
   */
  getBalance(currency: string): number {
    return this.getWallet().balance(currency);
  }

  /**
   * Deposits currency into this entity's wallet.
   */
  deposit(amount: CurrencyAmount, description?: string): void {
    this.getWallet().deposit(amount, description);
  }

  /**
   * Withdraws currency from this entity's wallet.
   * @throws Error if insufficient balance
   */
  withdraw(amount: CurrencyAmount, description?: string): void {
    this.getWallet().withdraw(amount, description);
  }

  /**
   * Checks if entity has sufficient balance.
   */
  hasBalance(currency: string, amount: number): boolean {
    return this.getWallet().hasBalance(currency, amount);
  }

  /**
   * Transfers currency to another entity's wallet.
   */
  transferTo(other: CurrencyComponent, amount: CurrencyAmount, description?: string): void {
    this.getWallet().transfer(other.getWallet(), amount, description);
  }

  getType(): string {
    return CurrencyComponent.type;
  }

  clone(): CurrencyComponent {
    const copy = new CurrencyComponent(this.walletId);
    copy.manager = this.manager;
    // Wallet reference is shared (managed by manager)
    copy.wallet = this.wallet;
    return copy;
  }

  toJSON(): {
    walletId: string;
  } {
    return {
      walletId: this.walletId,
    };
  }

  fromJSON(data: {
    walletId?: string;
  }): void {
    if (data.walletId) {
      this.walletId = data.walletId;
    }
  }

  protected onDetach(): void {
    // Wallet is managed by CurrencyManager, so we don't dispose it here
    // The manager should handle wallet lifecycle
    this.wallet = null;
    this.manager = null;
  }
}

registerComponent(CurrencyComponent.type, CurrencyComponent);

