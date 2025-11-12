import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RevenueSplit } from '../src/RevenueSplit';
import { PLATFORM_CURRENCY } from '../src/types';

describe('RevenueSplit', () => {
  let revenueSplit: RevenueSplit;

  beforeEach(() => {
    revenueSplit = new RevenueSplit();
  });

  afterEach(() => {
    revenueSplit.dispose();
  });

  describe('In-Game Split', () => {
    it('should calculate default in-game split (70/25/5)', () => {
      const result = revenueSplit.calculateInGameSplit(
        { currency: PLATFORM_CURRENCY, amount: 100 },
        'creator1'
      );

      expect(result.creator.amount).toBe(70);
      expect(result.platform.amount).toBe(25);
      expect(result.processing.amount).toBe(5);
      expect(result.total.amount).toBe(100);
    });

    it('should handle custom split configuration', () => {
      const customSplit = new RevenueSplit({
        creatorPercent: 80,
        platformPercent: 15,
        processingPercent: 5,
      });

      const result = customSplit.calculateInGameSplit(
        { currency: PLATFORM_CURRENCY, amount: 100 },
        'creator1'
      );

      expect(result.creator.amount).toBe(80);
      expect(result.platform.amount).toBe(15);
      expect(result.processing.amount).toBe(5);
      customSplit.dispose();
    });

    it('should throw error for non-coin currency', () => {
      expect(() => {
        revenueSplit.calculateInGameSplit({ currency: 'gems', amount: 100 }, 'creator1');
      }).toThrow();
    });

    it('should handle rounding correctly', () => {
      const result = revenueSplit.calculateInGameSplit(
        { currency: PLATFORM_CURRENCY, amount: 33 },
        'creator1'
      );

      // 33 * 0.7 = 23.1 -> 23
      // 33 * 0.25 = 8.25 -> 8
      // Remainder = 2
      expect(result.total.amount).toBe(33);
    });
  });

  describe('Marketplace Split', () => {
    it('should calculate default marketplace split (60/20/20)', () => {
      const result = revenueSplit.calculateMarketplaceSplit(
        { currency: PLATFORM_CURRENCY, amount: 100 },
        'assetCreator1',
        'gameCreator1'
      );

      expect(result.assetCreator.amount).toBe(60);
      expect(result.gameCreator.amount).toBe(20);
      expect(result.platform.amount).toBe(20);
      expect(result.total.amount).toBe(100);
    });

    it('should throw error for non-coin currency', () => {
      expect(() => {
        revenueSplit.calculateMarketplaceSplit(
          { currency: 'gems', amount: 100 },
          'assetCreator1',
          'gameCreator1'
        );
      }).toThrow();
    });
  });

  describe('Configuration Updates', () => {
    it('should update in-game split configuration', () => {
      revenueSplit.updateInGameSplit({ creatorPercent: 75, platformPercent: 20, processingPercent: 5 });
      const config = revenueSplit.getInGameSplit();
      expect(config.creatorPercent).toBe(75);
      expect(config.platformPercent).toBe(20);
      expect(config.processingPercent).toBe(5);
    });

    it('should validate split percentages sum to 100', () => {
      expect(() => {
        new RevenueSplit({ creatorPercent: 50, platformPercent: 30, processingPercent: 30 });
      }).toThrow('sum to 100');
    });

    it('should reject negative percentages', () => {
      expect(() => {
        new RevenueSplit({ creatorPercent: -10, platformPercent: 50, processingPercent: 60 });
      }).toThrow('non-negative');
    });
  });

  describe('Dispose', () => {
    it('should dispose revenue split', () => {
      revenueSplit.dispose();
      expect(revenueSplit.isDisposed()).toBe(true);
    });
  });
});

