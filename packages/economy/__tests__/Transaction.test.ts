import { describe, it, expect } from 'vitest';
import { Transaction } from '../src/Transaction';
import { TransactionType, TransactionStatus } from '../src/types';

describe('Transaction', () => {
  describe('Constructor', () => {
    it('should create transaction with required fields', () => {
      const tx = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      });

      expect(tx.type).toBe(TransactionType.DEPOSIT);
      expect(tx.amount.currency).toBe('coins');
      expect(tx.amount.amount).toBe(100);
      expect(tx.status).toBe(TransactionStatus.PENDING);
      expect(tx.id).toBeTruthy();
      expect(tx.timestamp).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const tx1 = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      });
      const tx2 = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
      });

      expect(tx1.id).not.toBe(tx2.id);
    });

    it('should accept custom timestamp', () => {
      const timestamp = 1234567890;
      const tx = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        timestamp,
      });

      expect(tx.timestamp).toBe(timestamp);
    });

    it('should accept optional fields', () => {
      const tx = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        fromWalletId: 'wallet1',
        toWalletId: 'wallet2',
        description: 'Test deposit',
        metadata: { source: 'test' },
        status: TransactionStatus.COMPLETED,
      });

      expect(tx.fromWalletId).toBe('wallet1');
      expect(tx.toWalletId).toBe('wallet2');
      expect(tx.description).toBe('Test deposit');
      expect(tx.metadata?.source).toBe('test');
      expect(tx.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  describe('Validation', () => {
    it('should throw error for negative amount', () => {
      expect(() => {
        new Transaction({
          type: TransactionType.DEPOSIT,
          amount: { currency: 'coins', amount: -10 },
        });
      }).toThrow('non-negative');
    });

    it('should throw error for invalid currency', () => {
      expect(() => {
        new Transaction({
          type: TransactionType.DEPOSIT,
          amount: { currency: '', amount: 100 },
        });
      }).toThrow('non-empty string');
    });

    it('should throw error for transfer without both wallets', () => {
      expect(() => {
        new Transaction({
          type: TransactionType.TRANSFER,
          amount: { currency: 'coins', amount: 100 },
          fromWalletId: 'wallet1',
        });
      }).toThrow('requires both fromWalletId and toWalletId');
    });

    it('should throw error for transfer with same source and target', () => {
      expect(() => {
        new Transaction({
          type: TransactionType.TRANSFER,
          amount: { currency: 'coins', amount: 100 },
          fromWalletId: 'wallet1',
          toWalletId: 'wallet1',
        });
      }).toThrow('same source and target');
    });
  });

  describe('with()', () => {
    it('should create new transaction with updated fields', () => {
      const original = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        status: TransactionStatus.PENDING,
      });

      const updated = original.with({ status: TransactionStatus.COMPLETED });

      expect(updated.id).toBe(original.id);
      expect(updated.status).toBe(TransactionStatus.COMPLETED);
      expect(original.status).toBe(TransactionStatus.PENDING); // Original unchanged
    });

    it('should preserve other fields when updating', () => {
      const original = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        description: 'Original',
      });

      const updated = original.with({ status: TransactionStatus.COMPLETED });

      expect(updated.description).toBe('Original');
      expect(updated.type).toBe(TransactionType.DEPOSIT);
    });
  });

  describe('Status checks', () => {
    it('should correctly identify completed transactions', () => {
      const tx = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        status: TransactionStatus.COMPLETED,
      });

      expect(tx.isCompleted()).toBe(true);
      expect(tx.isFailed()).toBe(false);
      expect(tx.isPending()).toBe(false);
    });

    it('should correctly identify failed transactions', () => {
      const tx = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        status: TransactionStatus.FAILED,
      });

      expect(tx.isCompleted()).toBe(false);
      expect(tx.isFailed()).toBe(true);
      expect(tx.isPending()).toBe(false);
    });

    it('should correctly identify pending transactions', () => {
      const tx = new Transaction({
        type: TransactionType.DEPOSIT,
        amount: { currency: 'coins', amount: 100 },
        status: TransactionStatus.PENDING,
      });

      expect(tx.isCompleted()).toBe(false);
      expect(tx.isFailed()).toBe(false);
      expect(tx.isPending()).toBe(true);
    });
  });
});

