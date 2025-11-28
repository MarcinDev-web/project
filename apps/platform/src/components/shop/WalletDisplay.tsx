/**
 * Wallet Display Component
 * Enhanced with currency icons and visual feedback
 */

import { Card } from '../shared/Card';

export interface WalletBalance {
  currency: string;
  balance: number;
}

export interface WalletDisplayProps {
  balances: WalletBalance[];
  loading?: boolean;
}

// Currency icons and colors for visual distinction
const currencyConfig: Record<string, { icon: string; color: string; gradient: string }> = {
  coins: {
    icon: '🪙',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)',
  },
  gems: {
    icon: '💎',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
  },
  credits: {
    icon: '⚡',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.1) 100%)',
  },
};

export function WalletDisplay({ balances, loading }: WalletDisplayProps) {
  // Default currencies that should always be displayed
  const defaultCurrencies = ['coins', 'gems', 'credits'];
  
  // Create a map of balances for quick lookup
  const balanceMap = new Map<string, number>();
  balances.forEach(balance => {
    balanceMap.set(balance.currency.toLowerCase(), balance.balance);
  });

  // Get balances for default currencies (use 0 if not found)
  const displayBalances = defaultCurrencies.map(currency => ({
    currency,
    balance: balanceMap.get(currency) ?? 0,
  }));
  const formatBalance = (value: number) => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(value);

  if (loading) {
    return (
      <Card className="wallet-display">
        <div className="wallet-loading">
          <span className="wallet-loading__icon">💰</span>
          Loading wallet...
        </div>
      </Card>
    );
  }

  return (
    <Card className="wallet-display">
      <h3>Wallet</h3>
      <p className="wallet-subtitle">Live wallet balances synced from the server.</p>
      <div className="wallet-balances">
        {displayBalances.map((balance) => {
          const config = currencyConfig[balance.currency] || {
            icon: '💵',
            color: '#94a3b8',
            gradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15) 0%, rgba(100, 116, 139, 0.1) 100%)',
          };
          
          return (
            <div 
              key={balance.currency} 
              className="wallet-balance"
              style={{ 
                background: config.gradient,
                borderColor: `${config.color}33`,
              }}
            >
              <div className="wallet-currency-info">
                <span 
                  className="wallet-currency-icon"
                  style={{ filter: `drop-shadow(0 2px 4px ${config.color}40)` }}
                >
                  {config.icon}
                </span>
                <span className="wallet-currency-label">{balance.currency}</span>
              </div>
              <span 
                className="wallet-currency-amount"
                style={{ color: config.color }}
              >
                {formatBalance(balance.balance)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
