import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurrencyWallet } from '../src/CurrencyWallet';
import { EventBus } from '@engine/core/event';
import { TransactionType, TransactionStatus } from '../src/types';
import { CurrencyEventNames } from '../src/events';

describe('CurrencyWallet', () => {
  let events: EventBus;
  let wallet: CurrencyWallet;

  beforeEach(() => {
    events = new EventBus();
    wallet = new CurrencyWallet('wallet1', events);
  });

  describe('Balance', () => {
    it('should return 0 for non-existent currency', () => {
      expect(wallet.balance('coins')).toBe(0);
    });

    it('should track balance after deposit', () => {
      wallet.deposit({ currency: 'coins', amount: 100 });
      expect(wallet.balance('coins')).toBe(100);
    });

    it('should update balance after multiple deposits', () => {
      wallet.deposit({ currency: 'coins', amount: 100 });
      wallet.deposit({ currency: 'coins', amount: 50 });
      expect(wallet.balance('coins')).toBe(150);
    });

    it('should track multiple currencies independently', () => {
      wallet.deposit({ currency: 'coins', amount: 100 });
      wallet.deposit({ currency: 'gems', amount: 50 });
      expect(wallet.balance('coins')).toBe(100);
      expect(wallet.balance('gems')).toBe(50);
    });

    it('should return all balances', () => {
      wallet.deposit({ currency: 'coins', amount: 100 });
      wallet.deposit({ currency: 'gems', amount: 50 });

      const balances = wallet.getAllBalances();
      expect(balances).toHaveLength(2);
      expect(balances.some(b => b.currency === 'coins' && b.balance === 100)).toBe(true);
      expect(balances.some(b => b.currency === 'gems' && b.balance === 50)).toBe(true);
    });
  });

  describe('Deposit', () => {
    it('should deposit currency and create transaction', () => {
      const tx = wallet.deposit({ currency: 'coins', amount: 100 });

      expect(tx.type).toBe(TransactionType.DEPOSIT);
      expect(tx.amount.amount).toBe(100);
      expect(tx.status).toBe(TransactionStatus.COMPLETED);
      expect(wallet.balance('coins')).toBe(100);
    });

    it('should emit deposit event', () => {
      const handler = vi.fn();
      events.on(CurrencyEventNames.DEPOSITED, handler);

      wallet.deposit({ currency: 'coins', amount: 100 });

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0]?.[0];
      expect(event.walletId).toBe('wallet1');
      expect(event.amount.amount).toBe(100);
    });

    it('should emit transaction completed event', () => {
      const handler = vi.fn();
      events.on(CurrencyEventNames.TRANSACTION_COMPLETED, handler);

      wallet.deposit({ currency: 'coins', amount: 100 });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should emit balance changed event', () => {
      const handler = vi.fn();
      events.on(CurrencyEventNames.BALANCE_CHANGED, handler);

      wallet.deposit({ currency: 'coins', amount: 100 });

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0]?.[0];
      expect(event.previousBalance).toBe(0);
      expect(event.newBalance).toBe(100);
    });

    it('should throw error for invalid amount', () => {
      expect(() => {
        wallet.deposit({ currency: 'coins', amount: -10 });
      }).toThrow('non-negative');
    });
  });

  describe('Withdraw', () => {
    beforeEach(() => {
      wallet.deposit({ currency: 'coins', amount: 100 });
    });

    it('should withdraw currency and create transaction', () => {
      const tx = wallet.withdraw({ currency: 'coins', amount: 50 });

      expect(tx.type).toBe(TransactionType.WITHDRAWAL);
      expect(tx.amount.amount).toBe(50);
      expect(tx.status).toBe(TransactionStatus.COMPLETED);
      expect(wallet.balance('coins')).toBe(50);
    });

    it('should emit withdraw event', () => {
      const handler = vi.fn();
      events.on(CurrencyEventNames.WITHDRAWN, handler);

      wallet.withdraw({ currency: 'coins', amount: 50 });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should throw error for insufficient balance', () => {
      expect(() => {
        wallet.withdraw({ currency: 'coins', amount: 150 });
      }).toThrow('Insufficient balance');

      expect(wallet.balance('coins')).toBe(100); // Balance unchanged
    });

    it('should emit failed event on insufficient balance', () => {
      const handler = vi.fn();
      events.on(CurrencyEventNames.TRANSACTION_FAILED, handler);

      try {
        wallet.withdraw({ currency: 'coins', amount: 150 });
      } catch {
        // Expected
      }

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('Transfer', () => {
    let wallet2: CurrencyWallet;

    beforeEach(() => {
      wallet.deposit({ currency: 'coins', amount: 100 });
      wallet2 = new CurrencyWallet('wallet2', events);
    });

    it('should transfer currency between wallets', () => {
      const tx = wallet.transfer(wallet2, { currency: 'coins', amount: 50 });

      expect(tx.type).toBe(TransactionType.TRANSFER);
      expect(tx.fromWalletId).toBe('wallet1');
      expect(tx.toWalletId).toBe('wallet2');
      expect(wallet.balance('coins')).toBe(50);
      expect(wallet2.balance('coins')).toBe(50);
    });

    it('should emit transfer event', () => {
      const handler = vi.fn();
      events.on(CurrencyEventNames.TRANSFERRED, handler);

      wallet.transfer(wallet2, { currency: 'coins', amount: 50 });

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0]?.[0];
      expect(event.fromWalletId).toBe('wallet1');
      expect(event.toWalletId).toBe('wallet2');
    });

    it('should throw error for insufficient balance', () => {
      expect(() => {
        wallet.transfer(wallet2, { currency: 'coins', amount: 150 });
      }).toThrow('Insufficient balance');
    });
  });

  describe('Exchange', () => {
    beforeEach(() => {
      wallet.deposit({ currency: 'coins', amount: 100 });
    });

    it('should exchange currency', () => {
      const tx = wallet.exchange('coins', 'gems', 50, 2.0);

      expect(tx.type).toBe(TransactionType.EXCHANGE);
      expect(wallet.balance('coins')).toBe(50);
      expect(wallet.balance('gems')).toBe(100); // 50 * 2.0
    });

    it('should emit exchange event', () => {
      const handler = vi.fn();
      events.on(CurrencyEventNames.EXCHANGED, handler);

      wallet.exchange('coins', 'gems', 50, 2.0);

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0]?.[0];
      expect(event.fromAmount.amount).toBe(50);
      expect(event.toAmount.amount).toBe(100);
      expect(event.exchangeRate).toBe(2.0);
    });

    it('should throw error for insufficient balance', () => {
      expect(() => {
        wallet.exchange('coins', 'gems', 150, 2.0);
      }).toThrow('Insufficient balance');
    });

    it('should throw error for invalid exchange rate', () => {
      expect(() => {
        wallet.exchange('coins', 'gems', 50, -1.0);
      }).toThrow('positive and finite');
    });

    it('should throw error for same currency', () => {
      expect(() => {
        wallet.exchange('coins', 'coins', 50, 2.0);
      }).toThrow('Cannot exchange currency to itself');
    });
  });

  describe('Has Balance', () => {
    beforeEach(() => {
      wallet.deposit({ currency: 'coins', amount: 100 });
    });

    it('should return true when sufficient balance', () => {
      expect(wallet.hasBalance('coins', 50)).toBe(true);
      expect(wallet.hasBalance('coins', 100)).toBe(true);
    });

    it('should return false when insufficient balance', () => {
      expect(wallet.hasBalance('coins', 150)).toBe(false);
    });

    it('should return false for non-existent currency', () => {
      expect(wallet.hasBalance('gems', 1)).toBe(false);
    });
  });

  describe('Dispose', () => {
    it('should dispose wallet and clear balances', () => {
      wallet.deposit({ currency: 'coins', amount: 100 });
      wallet.dispose();

      expect(wallet.isDisposed()).toBe(true);
      expect(() => wallet.balance('coins')).toThrow('disposed');
    });

    it('should emit disposed event', () => {
      const handler = vi.fn();
      events.on(CurrencyEventNames.WALLET_DISPOSED, handler);

      wallet.dispose();

      expect(handler).toHaveBeenCalledOnce();
      const event = handler.mock.calls[0]?.[0];
      expect(event.walletId).toBe('wallet1');
    });

    it('should be idempotent', () => {
      wallet.dispose();
      expect(() => wallet.dispose()).not.toThrow();
    });
  });

  describe('Wallet without events', () => {
    it('should work without EventBus', () => {
      const noEventWallet = new CurrencyWallet('wallet2', null);
      noEventWallet.deposit({ currency: 'coins', amount: 100 });
      expect(noEventWallet.balance('coins')).toBe(100);
    });
  });
});

