import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CurrencyExchangeRate } from '../src/CurrencyExchangeRate';
import { PLATFORM_CURRENCY } from '../src/types';

describe('CurrencyExchangeRate', () => {
  let exchangeRate: CurrencyExchangeRate;

  beforeEach(() => {
    exchangeRate = new CurrencyExchangeRate({
      defaultCoinsPerFiat: 100,
      defaultFiatCurrency: 'USD',
    });
  });

  afterEach(() => {
    exchangeRate.dispose();
  });

  describe('Constructor', () => {
    it('should create exchange rate system', () => {
      expect(exchangeRate).toBeTruthy();
      expect(exchangeRate.isDisposed()).toBe(false);
    });

    it('should set default exchange rate', () => {
      const rate = exchangeRate.getRate('USD');
      expect(rate.coinsPerFiat).toBe(100);
      expect(rate.fiatCurrency).toBe('USD');
    });
  });

  describe('Exchange Rate Management', () => {
    it('should get exchange rate for default currency', () => {
      const rate = exchangeRate.getRate('USD');
      expect(rate.coinsPerFiat).toBe(100);
      expect(rate.fiatCurrency).toBe('USD');
    });

    it('should return default rate for unregistered currency', () => {
      const rate = exchangeRate.getRate('EUR');
      expect(rate.coinsPerFiat).toBe(100); // Default
      expect(rate.fiatCurrency).toBe('USD'); // Default
    });

    it('should set exchange rate for currency', () => {
      exchangeRate.setRate('EUR', 120);
      const rate = exchangeRate.getRate('EUR');
      expect(rate.coinsPerFiat).toBe(120);
      expect(rate.fiatCurrency).toBe('EUR');
    });

    it('should update lastUpdated timestamp', () => {
      const before = Date.now();
      exchangeRate.setRate('EUR', 120);
      const rate = exchangeRate.getRate('EUR');
      expect(rate.lastUpdated).toBeGreaterThanOrEqual(before);
    });

    it('should throw error for invalid exchange rate', () => {
      expect(() => {
        exchangeRate.setRate('EUR', -10);
      }).toThrow('positive and finite');

      expect(() => {
        exchangeRate.setRate('EUR', 0);
      }).toThrow('positive and finite');
    });
  });

  describe('Currency Conversion', () => {
    it('should convert fiat to coins', () => {
      const coins = exchangeRate.fiatToCoins(1, 'USD');
      expect(coins).toBe(100);
    });

    it('should convert coins to fiat', () => {
      const fiat = exchangeRate.coinsToFiat(100, 'USD');
      expect(fiat).toBe(1);
    });

    it('should handle fractional amounts', () => {
      const coins = exchangeRate.fiatToCoins(0.5, 'USD');
      expect(coins).toBe(50);

      const fiat = exchangeRate.coinsToFiat(50, 'USD');
      expect(fiat).toBe(0.5);
    });

    it('should use different rates for different currencies', () => {
      exchangeRate.setRate('EUR', 120);
      
      const usdCoins = exchangeRate.fiatToCoins(1, 'USD');
      const eurCoins = exchangeRate.fiatToCoins(1, 'EUR');
      
      expect(usdCoins).toBe(100);
      expect(eurCoins).toBe(120);
    });

    it('should throw error for invalid amounts', () => {
      expect(() => {
        exchangeRate.fiatToCoins(-1, 'USD');
      }).toThrow('non-negative');

      expect(() => {
        exchangeRate.coinsToFiat(-1, 'USD');
      }).toThrow('non-negative');
    });
  });

  describe('Getters', () => {
    it('should get all rates', () => {
      exchangeRate.setRate('EUR', 120);
      exchangeRate.setRate('PLN', 400);
      
      const rates = exchangeRate.getAllRates();
      expect(rates.length).toBeGreaterThanOrEqual(3); // USD + EUR + PLN
    });

    it('should get default fiat currency', () => {
      expect(exchangeRate.getDefaultFiatCurrency()).toBe('USD');
    });

    it('should get default coins per fiat', () => {
      expect(exchangeRate.getDefaultCoinsPerFiat()).toBe(100);
    });
  });

  describe('Dispose', () => {
    it('should dispose exchange rate system', () => {
      exchangeRate.dispose();
      expect(exchangeRate.isDisposed()).toBe(true);
    });

    it('should throw error after dispose', () => {
      exchangeRate.dispose();
      expect(() => {
        exchangeRate.getRate('USD');
      }).toThrow('disposed');
    });

    it('should be idempotent', () => {
      exchangeRate.dispose();
      expect(() => exchangeRate.dispose()).not.toThrow();
    });
  });
});

