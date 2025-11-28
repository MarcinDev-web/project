/**
 * WalletDropdown Component
 * Compact balance pill with dropdown showing all currency balances
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '../shared/Button';

export interface WalletBalance {
  currency: string;
  balance: number;
}

interface WalletDropdownProps {
  balances: WalletBalance[];
  loading?: boolean;
  onBuyCredits: () => void;
}

const PLATFORM_CURRENCIES = ['credits', 'coins', 'gems'];

const currencyConfig: Record<string, { icon: string; color: string }> = {
  coins: { icon: '🪙', color: '#fbbf24' },
  gems: { icon: '💎', color: '#a78bfa' },
  credits: { icon: '⚡', color: '#f97316' },
};

function formatBalance(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function WalletDropdown({ balances, loading, onBuyCredits }: WalletDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate primary balance (credits/CRD)
  const primaryBalance = balances.find(
    (b) => b.currency.toLowerCase() === 'credits'
  )?.balance ?? 0;

  // Ensure all default currencies are shown
  const displayBalances = PLATFORM_CURRENCIES.map((currency) => ({
    currency,
    balance: balances.find((b) => b.currency.toLowerCase() === currency)?.balance ?? 0,
  }));

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <div className="wallet-dropdown" ref={dropdownRef}>
      <button
        className="wallet-dropdown__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        disabled={loading}
      >
        <span className="wallet-dropdown__icon">⚡</span>
        <span className="wallet-dropdown__amount">
          {loading ? '...' : formatBalance(primaryBalance)}
        </span>
        <span className="wallet-dropdown__label">CRD</span>
        <span className={`wallet-dropdown__chevron ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="wallet-dropdown__panel">
          <div className="wallet-dropdown__header">
            <span className="wallet-dropdown__title">Your Balance</span>
          </div>

          <div className="wallet-dropdown__balances">
            {displayBalances.map((balance) => {
              const config = currencyConfig[balance.currency] ?? {
                icon: '💵',
                color: '#94a3b8',
              };

              return (
                <div key={balance.currency} className="wallet-dropdown__balance-row">
                  <div className="wallet-dropdown__currency">
                    <span className="wallet-dropdown__currency-icon">{config.icon}</span>
                    <span className="wallet-dropdown__currency-name">{balance.currency}</span>
                  </div>
                  <span
                    className="wallet-dropdown__balance-value"
                    style={{ color: config.color }}
                  >
                    {formatBalance(balance.balance)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="wallet-dropdown__footer">
            <Button
              size="small"
              onClick={() => {
                setIsOpen(false);
                onBuyCredits();
              }}
            >
              + Buy Credits
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

