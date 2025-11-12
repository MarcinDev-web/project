import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@engine/core/event';
import { CurrencyManager } from '../src/CurrencyManager';
import { CurrencySinks, FeeType } from '../src/CurrencySinks';
import { PLATFORM_CURRENCY } from '../src/types';

describe('CurrencySinks', () => {
  let currencyManager: CurrencyManager;
  let burnWallet: any;
  let fundWallet: any;
  let eventBus: EventBus;
  let sinks: CurrencySinks;

  beforeEach(() => {
    currencyManager = new CurrencyManager();
    eventBus = currencyManager.events;
    burnWallet = currencyManager.createWallet('burn_wallet');
    fundWallet = currencyManager.createWallet('fund_wallet');
    
    sinks = new CurrencySinks(burnWallet, fundWallet, eventBus, {
      burnPercent: 50,
      fundPercent: 50,
    });
  });

  afterEach(() => {
    sinks.dispose();
    currencyManager.dispose();
  });

  describe('Fee Processing', () => {
    it('should process fee and split between burn and fund', () => {
      const result = sinks.processFee(
        { currency: 'coin', amount: 100 },
        FeeType.PLATFORM_SERVICE
      );

      expect(result.burned.amount).toBe(50);
      expect(result.toFund.amount).toBe(50);
      expect(result.totalRemoved.amount).toBe(100);
    });

    it('should deposit burned coins to burn wallet', () => {
      sinks.processFee({ currency: PLATFORM_CURRENCY, amount: 100 }, FeeType.PLATFORM_SERVICE);
      
      expect(burnWallet.balance('coin')).toBe(50);
    });

    it('should deposit fund coins to fund wallet', () => {
      sinks.processFee({ currency: PLATFORM_CURRENCY, amount: 100 }, FeeType.PLATFORM_SERVICE);
      
      expect(fundWallet.balance('coin')).toBe(50);
    });

    it('should handle different fee types', () => {
      sinks.processFee({ currency: 'coin', amount: 100 }, FeeType.MARKETPLACE_LISTING);
      sinks.processFee({ currency: 'coin', amount: 100 }, FeeType.MARKETPLACE_TRANSACTION);
      
      expect(burnWallet.balance('coin')).toBe(100);
      expect(fundWallet.balance('coin')).toBe(100);
    });

    it('should throw error for non-coin currency', () => {
      expect(() => {
        sinks.processFee({ currency: 'gems', amount: 100 }, FeeType.PLATFORM_SERVICE);
      }).toThrow();
    });
  });

  describe('Statistics', () => {
    it('should track total burned coins', () => {
      sinks.processFee({ currency: 'coin', amount: 100 }, FeeType.PLATFORM_SERVICE);
      sinks.processFee({ currency: 'coin', amount: 200 }, FeeType.PLATFORM_SERVICE);
      
      expect(sinks.getTotalBurned()).toBe(150); // 50 + 100
    });

    it('should track total coins sent to fund', () => {
      sinks.processFee({ currency: 'coin', amount: 100 }, FeeType.PLATFORM_SERVICE);
      sinks.processFee({ currency: 'coin', amount: 200 }, FeeType.PLATFORM_SERVICE);
      
      expect(sinks.getTotalToFund()).toBe(150); // 50 + 100
    });

    it('should get current fund balance', () => {
      sinks.processFee({ currency: PLATFORM_CURRENCY, amount: 100 }, FeeType.PLATFORM_SERVICE);
      
      expect(sinks.getFundBalance()).toBe(50);
    });

    it('should get current burn balance', () => {
      sinks.processFee({ currency: PLATFORM_CURRENCY, amount: 100 }, FeeType.PLATFORM_SERVICE);
      
      expect(sinks.getBurnBalance()).toBe(50);
    });
  });

  describe('Configuration Validation', () => {
    it('should throw error if burn + fund exceeds 100%', () => {
      expect(() => {
        new CurrencySinks(burnWallet, fundWallet, eventBus, {
          burnPercent: 60,
          fundPercent: 50,
        });
      }).toThrow('cannot exceed 100%');
    });
  });

  describe('Dispose', () => {
    it('should dispose sinks', () => {
      sinks.dispose();
      expect(sinks.isDisposed()).toBe(true);
    });
  });
});

