/**
 * Shopping Cart Component
 * Enhanced with better visual hierarchy and animations
 */

import { Card } from '../shared/Card';
import { Button } from '../shared/Button';

export interface CartItem {
  itemId: string;
  type: 'shop-item' | 'asset' | 'marketplace-item';
  quantity: number;
  name?: string;
  price?: { currency: string; amount: number };
}

export interface ShoppingCartProps {
  items: CartItem[];
  total?: { currency: string; amount: number };
  totals?: { currency: string; amount: number }[];
  onRemove?: (itemId: string, itemType: CartItem['type']) => void;
  onClear?: () => void;
  onCheckout?: () => void;
  loading?: boolean;
}

// Get type icon for cart items
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

// Get currency icon
function getCurrencyIcon(currency: string): string {
  const lower = currency.toLowerCase();
  if (lower === 'coins' || lower === 'coin') return '🪙';
  if (lower === 'gems' || lower === 'gem') return '💎';
  if (lower === 'credits' || lower === 'credit' || lower === 'crd') return '⚡';
  return '💵';
}

export function ShoppingCart({
  items,
  total,
  totals,
  onRemove,
  onClear,
  onCheckout,
  loading,
}: ShoppingCartProps) {
  if (items.length === 0) {
    return (
      <Card className="shopping-cart">
        <div className="cart-empty">
          <span className="cart-empty__icon">🛒</span>
          <p>Your cart is empty</p>
        </div>
      </Card>
    );
  }

  const fallbackTotals = totals ?? (total ? [total] : []);

  return (
    <Card className="shopping-cart">
      <div className="cart-header">
        <div>
          <p className="shop-kicker">Cart</p>
          <h3>Ready to checkout</h3>
          <p className="cart-subtitle">{items.length} item(s) prepared for checkout.</p>
        </div>
        {items.length > 0 && onClear && (
          <Button variant="secondary" onClick={onClear} size="small">
            Clear
          </Button>
        )}
      </div>
      <div className="cart-items" aria-busy={loading}>
        {items.map((item, index) => (
          <div 
            key={`${item.itemId}-${item.type}-${index}`} 
            className="cart-item"
            style={{ 
              animationDelay: `${index * 0.05}s`,
            }}
          >
            <div className="cart-item-icon">
              {getTypeIcon(item.type)}
            </div>
            <div className="cart-item-info">
              <div className="cart-item-name">{item.name || item.itemId}</div>
              <div className="cart-item-meta">
                <span className="cart-item-type">{item.type}</span>
                <span className="cart-item-quantity">×{item.quantity}</span>
                {item.price && (
                  <span className="cart-item-price">
                    {getCurrencyIcon(item.price.currency)} {item.price.amount * item.quantity}
                  </span>
                )}
              </div>
            </div>
            {onRemove && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => onRemove(item.itemId, item.type)}
              >
                ✕
              </Button>
            )}
          </div>
        ))}
      </div>
      {fallbackTotals.length > 0 && (
        <div className="cart-footer">
          <div className="cart-total">
            {fallbackTotals.map((entry) => (
              <div key={entry.currency} className="cart-total-row">
                <span className="cart-total-label">
                  {getCurrencyIcon(entry.currency)} {entry.currency}
                </span>
                <span className="cart-total-value">
                  {entry.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          {onCheckout && (
            <Button onClick={onCheckout} disabled={loading || items.length === 0}>
              {loading ? '⏳ Processing...' : '🛒 Checkout'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
