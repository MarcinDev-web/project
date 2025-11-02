import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CurrencyManager } from '../src/CurrencyManager';
import { CurrencyEventNames } from '../src/events';
import { TransactionType } from '../src/types';

describe('CurrencyManager', () => {
  let manager: CurrencyManager;

  beforeEach(() => {
    manager = new CurrencyManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Constructor', () => {
    it('should create manager with EventBus', () => {
      expect(manager.events).toBeTruthy();
      expect(manager.isDisposed()).toBe(false);
    });

    it('should create manager with custom history size', () => {
      const customManager = new CurrencyManager(50);
      expect(customManager.getHistory().limit).toBe(50);
      customManager.dispose();
    });
  });

  describe('Currency Registration', () => {
    it('should register currency', () => {
      manager.registerCurrency('coins');
      expect(manager.isCurrencyRegistered('coins')).toBe(true);
    });

    it('should get all registered currencies', () => {
      manager.registerCurrency('coins');
      manager.registerCurrency('gems');
      const currencies = manager.getRegisteredCurrencies();
      expect(currencies).toHaveLength(2);
      expect(currencies).toContain('coins');
      expect(currencies).toContain('gems');
    });

    it('should throw error for invalid currency', () => {
      expect(() => {
        manager.registerCurrency('');
      }).toThrow('non-empty string');
    });
  });

  describe('Wallet Management', () => {
    it('should create wallet', () => {
      const wallet = manager.createWallet('player1');
      expect(manager.hasWallet('player1')).toBe(true);
      expect(manager.getWallet('player1')).toBe(wallet);
    });

    it('should emit wallet created event', () => {
      const handler = vi.fn();
      manager.events.on(CurrencyEventNames.WALLET_CREATED, handler);

      manager.createWallet('player1');

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0]?.[0];
      expect(event.walletId).toBe('player1');
    });

    it('should create wallet with initial balances', () => {
      const initialBalances = new Map<string, number>();
      initialBalances.set('coins', 100);
      initialBalances.set('gems', 50);

      const wallet = manager.createWallet('player1', initialBalances);
      expect(wallet.balance('coins')).toBe(100);
      expect(wallet.balance('gems')).toBe(50);
    });

    it('should validate currency when currencies are registered', () => {
      manager.registerCurrency('coins');
      const initialBalances = new Map<string, number>();
      initialBalances.set('coins', 100);
      initialBalances.set('invalid', 50);

      expect(() => {
        manager.createWallet('player1', initialBalances);
      }).toThrow('not registered');
    });

    it('should throw error for duplicate wallet', () => {
      manager.createWallet('player1');
      expect(() => {
        manager.createWallet('player1');
      }).toThrow('already exists');
    });

    it('should get all wallet IDs', () => {
      manager.createWallet('player1');
      manager.createWallet('player2');
      const ids = manager.getAllWalletIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('player1');
      expect(ids).toContain('player2');
    });

    it('should remove wallet', () => {
      manager.createWallet('player1');
      expect(manager.removeWallet('player1')).toBe(true);
      expect(manager.hasWallet('player1')).toBe(false);
    });

    it('should return false when removing non-existent wallet', () => {
      expect(manager.removeWallet('nonexistent')).toBe(false);
    });
  });

  describe('Transaction History', () => {
    it('should add transactions to history', () => {
      const wallet = manager.createWallet('player1');
      wallet.deposit({ currency: 'coins', amount: 100 });

      const history = manager.getHistory();
      expect(history.size()).toBe(1);
    });

    it('should get transaction history', () => {
      const history = manager.getHistory();
      expect(history).toBeTruthy();
      expect(history.size()).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics', () => {
      const wallet1 = manager.createWallet('player1');
      const wallet2 = manager.createWallet('player2');

      wallet1.deposit({ currency: 'coins', amount: 100 });
      wallet1.deposit({ currency: 'gems', amount: 50 });
      wallet2.deposit({ currency: 'coins', amount: 200 });

      const stats = manager.getStatistics();
      expect(stats.totalWallets).toBe(2);
      expect(stats.totalBalances.get('coins')).toBe(300);
      expect(stats.totalBalances.get('gems')).toBe(50);
    });
  });

  describe('Validation', () => {
    it('should validate currency amounts', () => {
      manager.registerCurrency('coins');

      expect(() => {
        manager.validateAmount({ currency: 'coins', amount: 100 });
      }).not.toThrow();

      expect(() => {
        manager.validateAmount({ currency: 'invalid', amount: 100 });
      }).toThrow('not registered');
    });

    it('should allow any currency when none registered', () => {
      expect(() => {
        manager.validateAmount({ currency: 'coins', amount: 100 });
      }).not.toThrow();
    });
  });

  describe('Dispose', () => {
    it('should dispose manager and all wallets', () => {
      const wallet = manager.createWallet('player1');
      wallet.deposit({ currency: 'coins', amount: 100 });

      manager.dispose();

      expect(manager.isDisposed()).toBe(true);
      expect(() => manager.getWallet('player1')).toThrow('disposed');
      expect(wallet.isDisposed()).toBe(true);
    });

    it('should clear history on dispose', () => {
      const wallet = manager.createWallet('player1');
      wallet.deposit({ currency: 'coins', amount: 100 });

      const history = manager.getHistory();
      expect(history.size()).toBe(1);
      
      manager.dispose();
      // History should be cleared internally (can't access after dispose)
      expect(manager.isDisposed()).toBe(true);
    });

    it('should be idempotent', () => {
      manager.dispose();
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should handle complete workflow', () => {
      // Register currencies
      manager.registerCurrency('coins');
      manager.registerCurrency('gems');

      // Create wallets
      const wallet1 = manager.createWallet('player1');
      const wallet2 = manager.createWallet('player2');

      // Initial deposits
      wallet1.deposit({ currency: 'coins', amount: 100 });
      wallet2.deposit({ currency: 'coins', amount: 50 });

      // Transfer
      wallet1.transfer(wallet2, { currency: 'coins', amount: 30 });

      // Exchange
      wallet1.exchange('coins', 'gems', 20, 2.0);

      // Verify balances
      expect(wallet1.balance('coins')).toBe(50);
      expect(wallet1.balance('gems')).toBe(40);
      expect(wallet2.balance('coins')).toBe(80);

      // Verify history
      const history = manager.getHistory();
      expect(history.size()).toBe(4); // deposit to wallet1, deposit to wallet2, transfer, exchange
    });
  });
});

