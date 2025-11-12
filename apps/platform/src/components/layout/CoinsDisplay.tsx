/**
 * Coins Display Component for TopBar
 */

import { useEffect, useState } from 'react';
import { shopApi, type WalletBalance } from '../../api/shop';

export function CoinsDisplay() {
  const [coins, setCoins] = useState<number>(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadCoins = async () => {
      try {
        const wallet = await shopApi.getWallet();
        const coinsBalance = wallet.balances.find(
          (b: WalletBalance) => b.currency.toLowerCase() === 'coins'
        );
        if (!cancelled) {
          // Use 100 if balance is missing, undefined, or 0
          const balance = coinsBalance?.balance ?? 0;
          setCoins(balance > 0 ? balance : 100);
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load coins:', error);
          setCoins(100);
          setLoading(false);
        }
      }
    };

    void loadCoins();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="coins-display">
      <span className="coins-display__icon">🪙</span>
      <span className="coins-display__amount">{coins.toLocaleString()}</span>
    </div>
  );
}

