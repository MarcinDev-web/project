import { describe, it, expect, beforeEach } from 'vitest';
import { CurrencyTransactionHistory } from '../src/CurrencyTransactionHistory';
import { Transaction } from '../src/Transaction';
import { TransactionType } from '../src/types';
import { TransactionStatus } from '../src/types';

describe('CurrencyTransactionHistory', () => {
  let history: CurrencyTransactionHistory;

  beforeEach(() => {
    history = new CurrencyTransactionHistory(10);
  });

  describe('Constructor', () => {
    it('should create history with max size', () => {
      expect(history.limit).toBe(10);
    });

    it('should throw error for invalid max size', () => {
      expect(() => {
        new CurrencyTransactionHistory(0);
      }).toThrow('positive');

      expect(() => {
        new CurrencyTransactionHistory(-1);
      }).toThrow('positive');
    });
  });

  describe('Add and Get', () => {
    it('should add and retrieve transactions', () => {
      const tx = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      });

      history.add(tx);
      const all = history.getAll();

      expect(all).toHaveLength(1);
      expect(all[0]?.id).toBe(tx.id);
    });

    it('should enforce size limit', () => {
      const history = new CurrencyTransactionHistory(3);

      for (let i = 0; i < 5; i++) {
        history.add(new Transaction({
          type: TransactionType.DEPOSIT,
          amount: { currency: 'coins', amount: i * 10 },
        }));
      }

      expect(history.size()).toBe(3);
      const all = history.getAll();
      // Should keep the last 3
      expect(all[0]?.amount.amount).toBe(20);
      expect(all[1]?.amount.amount).toBe(30);
      expect(all[2]?.amount.amount).toBe(40);
    });

    it('should clone transactions for immutability', () => {
      const tx = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      });

      history.add(tx);
      const retrieved = history.getAll()[0]!;

      // Should be different instances
      expect(retrieved).not.toBe(tx);
      expect(retrieved.id).toBe(tx.id);
    });
  });

  describe('Filter', () => {
    beforeEach(() => {
      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        toWalletId: 'wallet1',
      }));

      history.add(new Transaction({
        type: TransactionType.WITHDRAWAL,
        amount: { currency: 'coins', amount: 50 },
        fromWalletId: 'wallet1',
      }));

      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'gems', amount: 200 },
        toWalletId: 'wallet2',
      }));
    });

    it('should filter by currency', () => {
      const filtered = history.getAll({ currency: 'coins' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(tx => tx.amount.currency === 'coins')).toBe(true);
    });

    it('should filter by wallet ID', () => {
      const filtered = history.getAll({ walletId: 'wallet1' });
      expect(filtered).toHaveLength(2);
    });

    it('should filter by type', () => {
      const filtered = history.getAll({ type: TransactionType.DEPOSIT });
      expect(filtered).toHaveLength(2);
    });

    it('should filter by status', () => {
      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        status: TransactionStatus.FAILED,
      }));

      const filtered = history.getAll({ status: TransactionStatus.FAILED });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.status).toBe(TransactionStatus.FAILED);
    });

    it('should filter by timestamp range', () => {
      const baseTime = Date.now();
      history.clear();

      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        timestamp: baseTime - 2000,
      }));

      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 200 },
        timestamp: baseTime - 1000,
      }));

      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 300 },
        timestamp: baseTime,
      }));

      const filtered = history.getAll({
        fromTimestamp: baseTime - 1500,
        toTimestamp: baseTime - 500,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.amount.amount).toBe(200);
    });
  });

  describe('Get Latest', () => {
    it('should return latest transaction', () => {
      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      }));

      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 200 },
      }));

      const latest = history.getLatest();
      expect(latest?.amount.amount).toBe(200);
    });

    it('should return null when empty', () => {
      expect(history.getLatest()).toBeNull();
    });

    it('should filter latest transaction', () => {
      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      }));

      history.add(new Transaction({
        type: TransactionType.WITHDRAWAL,
        amount: { currency: 'coins', amount: 50 },
      }));

      const latest = history.getLatest({ type: TransactionType.WITHDRAWAL });
      expect(latest?.type).toBe(TransactionType.WITHDRAWAL);
    });
  });

  describe('Get Recent', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        history.add(new Transaction({
          type: TransactionType.DEPOSIT,
          amount: { currency: 'coins', amount: (i + 1) * 10 },
        }));
      }
    });

    it('should return recent transactions in reverse order', () => {
      const recent = history.getRecent(3);
      expect(recent).toHaveLength(3);
      expect(recent[0]?.amount.amount).toBe(50); // Newest first
      expect(recent[1]?.amount.amount).toBe(40);
      expect(recent[2]?.amount.amount).toBe(30);
    });

    it('should return all if count exceeds size', () => {
      const recent = history.getRecent(10);
      expect(recent).toHaveLength(5);
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        status: TransactionStatus.COMPLETED,
      }));

      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 200 },
        status: TransactionStatus.COMPLETED,
      }));

      history.add(new Transaction({
        type: TransactionType.WITHDRAWAL,
        amount: { currency: 'coins', amount: 50 },
        status: TransactionStatus.COMPLETED,
      }));

      history.add(new Transaction({
        type: TransactionType.TRANSFER,
        amount: { currency: 'coins', amount: 30 },
        fromWalletId: 'wallet1',
        toWalletId: 'wallet2',
        status: TransactionStatus.COMPLETED,
      }));

      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 150 },
        status: TransactionStatus.FAILED,
      }));
    });

    it('should calculate metrics correctly', () => {
      const metrics = history.getMetrics();

      expect(metrics.totalCount).toBe(5);
      expect(metrics.totalDeposited).toBe(300); // Only completed deposits
      expect(metrics.totalWithdrawn).toBe(50);
      expect(metrics.totalTransferred).toBe(30);
      expect(metrics.countByType[TransactionType.DEPOSIT]).toBe(3);
      expect(metrics.countByType[TransactionType.WITHDRAWAL]).toBe(1);
      expect(metrics.countByStatus[TransactionStatus.COMPLETED]).toBe(4);
      expect(metrics.countByStatus[TransactionStatus.FAILED]).toBe(1);
    });

    it('should calculate filtered metrics', () => {
      const metrics = history.getMetrics({ status: TransactionStatus.COMPLETED });

      expect(metrics.totalCount).toBe(4);
      expect(metrics.totalDeposited).toBe(300);
    });
  });

  describe('Export/Import', () => {
    it('should export transactions', () => {
      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      }));

      const exported = history.export();
      expect(exported).toHaveLength(1);
      expect(exported[0]?.id).toBeTruthy();
    });

    it('should import transactions', () => {
      const tx1 = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      });

      const tx2 = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 200 },
      });

      history.import([tx1, tx2]);
      expect(history.size()).toBe(2);
    });

    it('should enforce size limit on import', () => {
      const history = new CurrencyTransactionHistory(2);
      const transactions = [
        new Transaction({ type: TransactionType.DEPOSIT, amount: { currency: 'coins', amount: 100 } }),
        new Transaction({ type: TransactionType.DEPOSIT, amount: { currency: 'coins', amount: 200 } }),
        new Transaction({ type: TransactionType.DEPOSIT, amount: { currency: 'coins', amount: 300 } }),
      ];

      history.import(transactions);
      expect(history.size()).toBe(2);
    });
  });

  describe('Clear', () => {
    it('should clear all transactions', () => {
      history.add(new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      }));

      history.clear();
      expect(history.size()).toBe(0);
    });
  });
});

