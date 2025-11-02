import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupGameCurrencySystem,
  setupPlayerWallet,
  givePlayerReward,
  purchaseItem,
  tradeBetweenPlayers,
  exchangePlayerCurrency,
} from '../src/examples/CurrencySystemExample';

describe('Currency System Examples', () => {
  describe('setupGameCurrencySystem', () => {
    it('should create and configure currency manager', () => {
      const manager = setupGameCurrencySystem();

      expect(manager.isCurrencyRegistered('coins')).toBe(true);
      expect(manager.isCurrencyRegistered('gems')).toBe(true);
      expect(manager.isCurrencyRegistered('credits')).toBe(true);

      manager.dispose();
    });
  });

  describe('Player wallet operations', () => {
    let manager: ReturnType<typeof setupGameCurrencySystem>;
    let wallet: ReturnType<typeof setupPlayerWallet>;

    beforeEach(() => {
      manager = setupGameCurrencySystem();
      const initialBalances = new Map([
        ['coins', 100],
        ['gems', 10],
      ]);
      wallet = setupPlayerWallet(manager, 'player1', initialBalances);
    });

    afterEach(() => {
      manager.dispose();
    });

    it('should give player reward', () => {
      const initialBalance = wallet.balance('coins');
      givePlayerReward(wallet, { currency: 'coins', amount: 50 }, 'Quest completion');

      expect(wallet.balance('coins')).toBe(initialBalance + 50);
    });

    it('should purchase item when sufficient balance', () => {
      const initialBalance = wallet.balance('coins');
      const success = purchaseItem(wallet, { currency: 'coins', amount: 30 }, 'Magic Sword');

      expect(success).toBe(true);
      expect(wallet.balance('coins')).toBe(initialBalance - 30);
    });

    it('should fail purchase when insufficient balance', () => {
      const initialBalance = wallet.balance('coins');
      const success = purchaseItem(wallet, { currency: 'coins', amount: 1000 }, 'Expensive Item');

      expect(success).toBe(false);
      expect(wallet.balance('coins')).toBe(initialBalance); // Balance unchanged
    });
  });

  describe('Player trading', () => {
    let manager: ReturnType<typeof setupGameCurrencySystem>;
    let wallet1: ReturnType<typeof setupPlayerWallet>;
    let wallet2: ReturnType<typeof setupPlayerWallet>;

    beforeEach(() => {
      manager = setupGameCurrencySystem();
      wallet1 = setupPlayerWallet(manager, 'player1', new Map([['coins', 100]]));
      wallet2 = setupPlayerWallet(manager, 'player2', new Map([['coins', 50]]));
    });

    afterEach(() => {
      manager.dispose();
    });

    it('should transfer currency between players', () => {
      const success = tradeBetweenPlayers(wallet1, wallet2, { currency: 'coins', amount: 25 }, 'Trade');

      expect(success).toBe(true);
      expect(wallet1.balance('coins')).toBe(75);
      expect(wallet2.balance('coins')).toBe(75);
    });

    it('should fail transfer when insufficient balance', () => {
      const success = tradeBetweenPlayers(wallet1, wallet2, { currency: 'coins', amount: 1000 }, 'Trade');

      expect(success).toBe(false);
      expect(wallet1.balance('coins')).toBe(100);
      expect(wallet2.balance('coins')).toBe(50);
    });
  });

  describe('Currency exchange', () => {
    let manager: ReturnType<typeof setupGameCurrencySystem>;
    let wallet: ReturnType<typeof setupPlayerWallet>;

    beforeEach(() => {
      manager = setupGameCurrencySystem();
      wallet = setupPlayerWallet(manager, 'player1', new Map([['coins', 100]]));
    });

    afterEach(() => {
      manager.dispose();
    });

    it('should exchange coins for gems', () => {
      const initialCoins = wallet.balance('coins');
      const initialGems = wallet.balance('gems');
      const success = exchangePlayerCurrency(wallet, 'coins', 'gems', 50, 0.1); // 50 coins = 5 gems

      expect(success).toBe(true);
      expect(wallet.balance('coins')).toBe(initialCoins - 50);
      expect(wallet.balance('gems')).toBe(initialGems + 5);
    });

    it('should fail exchange when insufficient balance', () => {
      const success = exchangePlayerCurrency(wallet, 'coins', 'gems', 1000, 0.1);

      expect(success).toBe(false);
    });
  });
});

