/**
 * Example usage of the currency system in a game world.
 * This demonstrates how to integrate the currency system with player entities.
 */
import { CurrencyManager, CurrencyWallet, type CurrencyAmount } from '../index';
/**
 * Example: Setting up currency system for a game world
 */
export declare function setupGameCurrencySystem(): CurrencyManager;
/**
 * Example: Creating and managing player wallets
 */
export declare function setupPlayerWallet(manager: CurrencyManager, playerId: string, initialBalances?: Map<string, number>): CurrencyWallet;
/**
 * Example: Player receives reward
 */
export declare function givePlayerReward(wallet: CurrencyWallet, reward: CurrencyAmount, reason: string): void;
/**
 * Example: Player purchases item
 */
export declare function purchaseItem(wallet: CurrencyWallet, itemCost: CurrencyAmount, itemName: string): boolean;
/**
 * Example: Player trades with another player
 */
export declare function tradeBetweenPlayers(fromWallet: CurrencyWallet, toWallet: CurrencyWallet, amount: CurrencyAmount, tradeDescription: string): boolean;
/**
 * Example: Exchange currency (e.g., convert coins to gems)
 */
export declare function exchangePlayerCurrency(wallet: CurrencyWallet, fromCurrency: string, toCurrency: string, fromAmount: number, exchangeRate: number): boolean;
/**
 * Example: Complete game economy workflow
 */
export declare function exampleGameEconomyWorkflow(): void;
//# sourceMappingURL=CurrencySystemExample.d.ts.map