/**
 * TopUpModal Component
 * Modal for purchasing platform credits with real money
 */

import { useState } from 'react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';

interface TopUpPack {
  amount: number;
  price: string;
  bonus?: string;
}

interface TopUpModalProps {
  onPurchase: (amount: number) => void;
  onClose: () => void;
}

const CREDIT_PACKS: TopUpPack[] = [
  { amount: 500, price: '$4.99' },
  { amount: 1500, price: '$12.99', bonus: 'Save 13%' },
  { amount: 5000, price: '$34.99', bonus: 'Best Value' },
];

export function TopUpModal({ onPurchase, onClose }: TopUpModalProps) {
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePurchase = () => {
    if (selectedPack === null) return;
    
    setLoading(true);
    onPurchase(CREDIT_PACKS[selectedPack].amount);
    // Note: Parent handles the actual purchase flow and closes modal
  };

  return (
    <div className="topup-modal-overlay" onClick={onClose}>
      <Card className="topup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="topup-modal__header">
          <h2 className="topup-modal__title">Buy Credits</h2>
          <button className="topup-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="topup-modal__description">
          Purchase platform credits to buy assets, builds, and avatars. 
          Credits are the only item requiring real money.
        </p>

        <div className="topup-modal__packs">
          {CREDIT_PACKS.map((pack, index) => (
            <button
              key={pack.amount}
              className={`topup-pack ${selectedPack === index ? 'selected' : ''}`}
              onClick={() => setSelectedPack(index)}
              disabled={loading}
            >
              {pack.bonus && (
                <span className="topup-pack__badge">{pack.bonus}</span>
              )}
              <div className="topup-pack__icon">⚡</div>
              <div className="topup-pack__amount">
                {pack.amount.toLocaleString()}
              </div>
              <div className="topup-pack__currency">CRD</div>
              <div className="topup-pack__price">{pack.price}</div>
            </button>
          ))}
        </div>

        <div className="topup-modal__footer">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={selectedPack === null || loading}
          >
            {loading ? 'Processing...' : 'Purchase'}
          </Button>
        </div>

        <p className="topup-modal__disclaimer">
          By purchasing, you agree to our Terms of Service. 
          All sales are final. Credits do not expire.
        </p>
      </Card>
    </div>
  );
}

