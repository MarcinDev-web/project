/**
 * PurchaseModal - Modal for purchasing shop items
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { marketplaceApi } from '../../api/marketplace';
import type { GalleryItem } from './types';

export interface PurchaseModalProps {
  /** Item to purchase */
  item: GalleryItem;
  /** User's current balance */
  userBalance?: number;
  /** Currency symbol */
  currencySymbol?: string;
  /** Called when purchase is successful */
  onPurchaseSuccess: (item: GalleryItem) => void;
  /** Called when modal is closed */
  onClose: () => void;
}

type PurchaseState = 'idle' | 'confirming' | 'processing' | 'success' | 'error';

/**
 * Purchase modal component
 */
export const PurchaseModal = memo(function PurchaseModal({
  item,
  userBalance = 0,
  currencySymbol = '💎',
  onPurchaseSuccess,
  onClose,
}: PurchaseModalProps) {
  const [state, setState] = useState<PurchaseState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const price = item.price ?? 0;
  const canAfford = userBalance >= price;

  // Handle purchase
  const handlePurchase = useCallback(async () => {
    if (!canAfford) {
      setErrorMessage('Insufficient balance');
      setState('error');
      return;
    }

    setState('processing');
    setErrorMessage(null);

    try {
      const result = await marketplaceApi.purchaseItem(item.id);
      
      if (result.success) {
        setNewBalance(result.newBalance ?? null);
        setState('success');
        
        // Mark item as owned
        const purchasedItem: GalleryItem = {
          ...item,
          status: 'owned',
        };
        
        // Delay calling success to show animation
        setTimeout(() => {
          onPurchaseSuccess(purchasedItem);
        }, 1500);
      } else {
        setErrorMessage('Purchase failed. Please try again.');
        setState('error');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      setErrorMessage('An error occurred. Please try again later.');
      setState('error');
    }
  }, [item, canAfford, onPurchaseSuccess]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'processing') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, state]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div 
      className="purchase-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== 'processing') {
          onClose();
        }
      }}
    >
      <div className="purchase-modal">
        {/* Header */}
        <div className="purchase-modal__header">
          <h2 className="purchase-modal__title">
            {state === 'success' ? '🎉 Purchase Complete!' : '🛒 Confirm Purchase'}
          </h2>
          {state !== 'processing' && state !== 'success' && (
            <button
              className="purchase-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Item preview */}
        <div className="purchase-modal__item">
          <div className="purchase-modal__item-preview">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.name}
                className="purchase-modal__item-image"
              />
            ) : (
              <span className="purchase-modal__item-placeholder">
                {item.previewEmoji ?? '🎭'}
              </span>
            )}
          </div>
          
          <div className="purchase-modal__item-info">
            <h3 className="purchase-modal__item-name">{item.name}</h3>
            {item.rarity && (
              <span className={`purchase-modal__item-rarity purchase-modal__item-rarity--${item.rarity}`}>
                {item.rarity}
              </span>
            )}
          </div>
        </div>

        {/* Price and balance */}
        <div className="purchase-modal__pricing">
          <div className="purchase-modal__price-row">
            <span>Price</span>
            <span className="purchase-modal__price">
              {currencySymbol} {price}
            </span>
          </div>
          
          <div className="purchase-modal__price-row">
            <span>Your Balance</span>
            <span className={`purchase-modal__balance ${!canAfford ? 'purchase-modal__balance--insufficient' : ''}`}>
              {currencySymbol} {userBalance}
            </span>
          </div>
          
          <div className="purchase-modal__divider" />
          
          <div className="purchase-modal__price-row purchase-modal__price-row--total">
            <span>After Purchase</span>
            <span className="purchase-modal__new-balance">
              {state === 'success' && newBalance !== null
                ? `${currencySymbol} ${newBalance}`
                : `${currencySymbol} ${userBalance - price}`}
            </span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="purchase-modal__error">
            <span>❌</span>
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Insufficient funds warning */}
        {!canAfford && state !== 'error' && (
          <div className="purchase-modal__warning">
            <span>⚠️</span>
            <p>You don't have enough {currencySymbol} to purchase this item.</p>
          </div>
        )}

        {/* Success message */}
        {state === 'success' && (
          <div className="purchase-modal__success">
            <div className="purchase-modal__success-icon">✨</div>
            <p>Item added to your inventory!</p>
          </div>
        )}

        {/* Actions */}
        <div className="purchase-modal__actions">
          {state === 'success' ? (
            <button
              className="purchase-modal__btn purchase-modal__btn--primary"
              onClick={onClose}
            >
              Continue
            </button>
          ) : (
            <>
              <button
                className="purchase-modal__btn purchase-modal__btn--secondary"
                onClick={onClose}
                disabled={state === 'processing'}
              >
                Cancel
              </button>
              
              {!canAfford ? (
                <button
                  className="purchase-modal__btn purchase-modal__btn--primary"
                  onClick={() => {
                    // Navigate to shop/store to buy currency
                    window.location.href = '/shop';
                  }}
                >
                  Get {currencySymbol}
                </button>
              ) : (
                <button
                  className="purchase-modal__btn purchase-modal__btn--primary"
                  onClick={handlePurchase}
                  disabled={state === 'processing'}
                >
                  {state === 'processing' ? (
                    <>
                      <span className="purchase-modal__spinner" />
                      Processing...
                    </>
                  ) : (
                    <>Buy for {currencySymbol} {price}</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

