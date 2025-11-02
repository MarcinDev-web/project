import { Component } from './Component';
import type { CurrencyManager, CurrencyWallet } from '@engine/economy';
import type { CurrencyAmount } from '@engine/economy';
/**
 * CurrencyComponent provides currency wallet functionality to entities.
 * Requires a CurrencyManager to be available in the world context.
 */
export declare class CurrencyComponent extends Component {
    static readonly type = "Currency";
    /** Reference to the currency wallet (managed by CurrencyManager) */
    private wallet;
    /** Wallet ID for this entity (used to retrieve wallet from manager) */
    walletId: string;
    /** Reference to the currency manager (should be set externally) */
    private manager;
    /**
     * @param walletId - Unique wallet identifier (typically entity ID or player ID)
     */
    constructor(walletId?: string);
    /**
     * Sets the currency manager reference.
     * This should be called by a system that has access to the global CurrencyManager.
     */
    setManager(manager: CurrencyManager): void;
    /**
     * Gets the currency wallet.
     * @throws Error if manager not set
     */
    getWallet(): CurrencyWallet;
    /**
     * Gets balance for a currency.
     */
    getBalance(currency: string): number;
    /**
     * Deposits currency into this entity's wallet.
     */
    deposit(amount: CurrencyAmount, description?: string): void;
    /**
     * Withdraws currency from this entity's wallet.
     * @throws Error if insufficient balance
     */
    withdraw(amount: CurrencyAmount, description?: string): void;
    /**
     * Checks if entity has sufficient balance.
     */
    hasBalance(currency: string, amount: number): boolean;
    /**
     * Transfers currency to another entity's wallet.
     */
    transferTo(other: CurrencyComponent, amount: CurrencyAmount, description?: string): void;
    getType(): string;
    clone(): CurrencyComponent;
    toJSON(): {
        walletId: string;
    };
    fromJSON(data: {
        walletId?: string;
    }): void;
    protected onDetach(): void;
}
//# sourceMappingURL=CurrencyComponent.d.ts.map