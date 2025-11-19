/**
 * Wallet Display Component
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
        <div className="wallet-loading">Loading wallet...</div>
      </Card>
    );
  }

  return (
    <Card className="wallet-display">
      <h3>Wallet</h3>
      <p className="wallet-subtitle">Live wallet balances synced from the server.</p>
      <div className="wallet-balances">
        {displayBalances.map((balance) => (
          <div key={balance.currency} className="wallet-balance">
            <span className="wallet-currency-label">{balance.currency}</span>
            <span className="wallet-currency-amount">
              {formatBalance(balance.balance)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

