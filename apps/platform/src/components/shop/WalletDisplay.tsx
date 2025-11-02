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
  if (loading) {
    return (
      <Card className="wallet-display">
        <div className="wallet-loading">Loading wallet...</div>
      </Card>
    );
  }

  if (balances.length === 0) {
    return (
      <Card className="wallet-display">
        <div className="wallet-empty">No currency available</div>
      </Card>
    );
  }

  return (
    <Card className="wallet-display">
      <h3>Wallet</h3>
      <div className="wallet-balances">
        {balances.map((balance) => (
          <div key={balance.currency} className="wallet-balance">
            <span className="wallet-currency">{balance.currency}</span>
            <span className="wallet-amount">{balance.balance}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

