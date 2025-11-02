/**
 * Example usage of the currency system in a game world.
 * This demonstrates how to integrate the currency system with player entities.
 */

import { CurrencyManager, CurrencyWallet, type CurrencyAmount } from '../index';
import { CurrencyEventNames } from '../events';
import type { CurrencyDepositedEvent, CurrencyTransferredEvent } from '../events';

/**
 * Example: Setting up currency system for a game world
 */
export function setupGameCurrencySystem(): CurrencyManager {
  // Create the global currency manager
  const manager = new CurrencyManager();

  // Register available currencies
  manager.registerCurrency('coins'); // Basic currency
  manager.registerCurrency('gems'); // Premium currency
  manager.registerCurrency('credits'); // Marketplace currency

  // Subscribe to events for game logic
  manager.events.on(CurrencyEventNames.DEPOSITED, (data) => {
    const event = data as CurrencyDepositedEvent;
    if (event) {
      console.log(`[Currency] Player ${event.walletId} deposited ${event.amount.amount} ${event.amount.currency}`);
      // Could trigger achievement unlocks, notifications, etc.
    }
  });

  manager.events.on(CurrencyEventNames.TRANSFERRED, (data) => {
    const event = data as CurrencyTransferredEvent;
    if (event) {
      console.log(
        `[Currency] Transfer: ${event.fromWalletId} → ${event.toWalletId}: ${event.amount.amount} ${event.amount.currency}`
      );
      // Could trigger trading UI updates, notifications, etc.
    }
  });

  return manager;
}

/**
 * Example: Creating and managing player wallets
 */
export function setupPlayerWallet(
  manager: CurrencyManager,
  playerId: string,
  initialBalances?: Map<string, number>
): CurrencyWallet {
  // Create wallet for player (with initial balances set directly, not as deposits)
  const wallet = manager.createWallet(playerId, initialBalances);
  return wallet;
}

/**
 * Example: Player receives reward
 */
export function givePlayerReward(
  wallet: CurrencyWallet,
  reward: CurrencyAmount,
  reason: string
): void {
  wallet.deposit(reward, `Reward: ${reason}`);
}

/**
 * Example: Player purchases item
 */
export function purchaseItem(
  wallet: CurrencyWallet,
  itemCost: CurrencyAmount,
  itemName: string
): boolean {
  try {
    wallet.withdraw(itemCost, `Purchase: ${itemName}`);
    return true;
  } catch (error) {
    console.warn(`[Purchase] Failed: ${error}`);
    return false;
  }
}

/**
 * Example: Player trades with another player
 */
export function tradeBetweenPlayers(
  fromWallet: CurrencyWallet,
  toWallet: CurrencyWallet,
  amount: CurrencyAmount,
  tradeDescription: string
): boolean {
  try {
    fromWallet.transfer(toWallet, amount, tradeDescription);
    return true;
  } catch (error) {
    console.warn(`[Trade] Failed: ${error}`);
    return false;
  }
}

/**
 * Example: Exchange currency (e.g., convert coins to gems)
 */
export function exchangePlayerCurrency(
  wallet: CurrencyWallet,
  fromCurrency: string,
  toCurrency: string,
  fromAmount: number,
  exchangeRate: number
): boolean {
  try {
    wallet.exchange(fromCurrency, toCurrency, fromAmount, exchangeRate, `Exchange ${fromCurrency} → ${toCurrency}`);
    return true;
  } catch (error) {
    console.warn(`[Exchange] Failed: ${error}`);
    return false;
  }
}

/**
 * Example: Complete game economy workflow
 */
export function exampleGameEconomyWorkflow(): void {
  console.log('=== Game Economy System Example ===\n');

  // 1. Setup currency system
  const manager = setupGameCurrencySystem();
  console.log('✓ Currency system initialized\n');

  // 2. Create player wallets
  const player1Wallet = setupPlayerWallet(manager, 'player1', new Map([
    ['coins', 100],
    ['gems', 10],
  ]));
  console.log(`✓ Player 1 wallet created: ${player1Wallet.balance('coins')} coins, ${player1Wallet.balance('gems')} gems\n`);

  const player2Wallet = setupPlayerWallet(manager, 'player2', new Map([
    ['coins', 50],
  ]));
  console.log(`✓ Player 2 wallet created: ${player2Wallet.balance('coins')} coins\n`);

  // 3. Player 1 completes quest and gets reward
  givePlayerReward(player1Wallet, { currency: 'coins', amount: 50 }, 'Quest completion');
  console.log(`✓ Player 1 balance after reward: ${player1Wallet.balance('coins')} coins\n`);

  // 4. Player 1 purchases item
  const purchased = purchaseItem(player1Wallet, { currency: 'coins', amount: 75 }, 'Magic Sword');
  console.log(`✓ Purchase ${purchased ? 'successful' : 'failed'}: ${player1Wallet.balance('coins')} coins remaining\n`);

  // 5. Player 1 trades with Player 2
  const traded = tradeBetweenPlayers(player1Wallet, player2Wallet, { currency: 'coins', amount: 25 }, 'Trade: Equipment');
  console.log(`✓ Trade ${traded ? 'successful' : 'failed'}`);
  console.log(`  Player 1: ${player1Wallet.balance('coins')} coins`);
  console.log(`  Player 2: ${player2Wallet.balance('coins')} coins\n`);

  // 6. Player 2 exchanges coins for gems
  const exchanged = exchangePlayerCurrency(player2Wallet, 'coins', 'gems', 30, 0.1);
  console.log(`✓ Exchange ${exchanged ? 'successful' : 'failed'}`);
  console.log(`  Player 2: ${player2Wallet.balance('coins')} coins, ${player2Wallet.balance('gems')} gems\n`);

  // 7. View statistics
  const stats = manager.getStatistics();
  console.log('=== Global Statistics ===');
  console.log(`Total wallets: ${stats.totalWallets}`);
  console.log(`Total transactions: ${stats.totalTransactions}`);
  console.log('Total balances:');
  for (const [currency, total] of stats.totalBalances.entries()) {
    console.log(`  ${currency}: ${total}`);
  }
  console.log('');

  // 8. View transaction history
  const history = manager.getHistory();
  console.log('=== Recent Transactions ===');
  const recent = history.getRecent(5);
  for (const tx of recent) {
    console.log(`[${tx.type}] ${tx.amount.amount} ${tx.amount.currency} - ${tx.description || 'No description'}`);
  }
  console.log('');

  // Cleanup
  manager.dispose();
  console.log('✓ Currency system disposed\n');
}

