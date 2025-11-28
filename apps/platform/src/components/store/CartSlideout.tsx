/**
 * CartSlideout Component
 * Slide-in panel from the right edge for shopping cart
 */

import { useEffect, useRef } from 'react';
import { Button } from '../shared/Button';

export interface CartItem {
  itemId: string;
  type: 'shop-item' | 'asset' | 'marketplace-item';
  quantity: number;
  name?: string;
  price?: { currency: string; amount: number };
}

interface CartSlideoutProps {
  isOpen: boolean;
  items: CartItem[];
  totals: Array<{ currency: string; amount: number }>;
  onClose: () => void;
  onRemove: (itemId: string, itemType: CartItem['type']) => void;
  onClear: () => void;
  onCheckout: () => void;
  loading?: boolean;
}

function getTypeIcon(type: CartItem['type']): string {
  switch (type) {
    case 'shop-item':
      return '🛍️';
    case 'asset':
      return '📦';
    case 'marketplace-item':
      return '🏪';
    default:
      return '📁';
  }
}

function getCurrencyIcon(currency: string): string {
  const lower = currency.toLowerCase();
  if (lower === 'coins' || lower === 'coin') return '🪙';
  if (lower === 'gems' || lower === 'gem') return '💎';
  if (lower === 'credits' || lower === 'credit' || lower === 'crd') return '⚡';
  return '💵';
}

export function CartSlideout({
  isOpen,
  items,
  totals,
  onClose,
  onRemove,
  onClear,
  onCheckout,
  loading,
}: CartSlideoutProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when slideout is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="cart-slideout-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        className="cart-slideout"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart"
        tabIndex={-1}
      >
        <div className="cart-slideout__header">
          <div className="cart-slideout__title-row">
            <h2 className="cart-slideout__title">
              Cart
              {items.length > 0 && (
                <span className="cart-slideout__count">({items.length})</span>
              )}
            </h2>
            <button
              className="cart-slideout__close"
              onClick={onClose}
              aria-label="Close cart"
            >
              ✕
            </button>
          </div>
          {items.length > 0 && (
            <button
              className="cart-slideout__clear"
              onClick={onClear}
              disabled={loading}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="cart-slideout__content">
          {items.length === 0 ? (
            <div className="cart-slideout__empty">
              <span className="cart-slideout__empty-icon">🛒</span>
              <p>Your cart is empty</p>
              <p className="cart-slideout__empty-hint">
                Browse the store and add items to get started
              </p>
            </div>
          ) : (
            <div className="cart-slideout__items">
              {items.map((item, index) => (
                <div
                  key={`${item.itemId}-${item.type}-${index}`}
                  className="cart-slideout__item"
                >
                  <div className="cart-slideout__item-icon">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="cart-slideout__item-info">
                    <div className="cart-slideout__item-name">
                      {item.name || item.itemId}
                    </div>
                    <div className="cart-slideout__item-meta">
                      <span className="cart-slideout__item-qty">×{item.quantity}</span>
                      {item.price && (
                        <span className="cart-slideout__item-price">
                          {getCurrencyIcon(item.price.currency)}{' '}
                          {(item.price.amount * item.quantity).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="cart-slideout__item-remove"
                    onClick={() => onRemove(item.itemId, item.type)}
                    disabled={loading}
                    aria-label={`Remove ${item.name || item.itemId}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-slideout__footer">
            <div className="cart-slideout__totals">
              {totals.map((entry) => (
                <div key={entry.currency} className="cart-slideout__total-row">
                  <span className="cart-slideout__total-label">
                    {getCurrencyIcon(entry.currency)} {entry.currency}
                  </span>
                  <span className="cart-slideout__total-value">
                    {entry.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <Button
              onClick={onCheckout}
              disabled={loading || items.length === 0}
              className="cart-slideout__checkout"
            >
              {loading ? 'Processing...' : 'Checkout'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

