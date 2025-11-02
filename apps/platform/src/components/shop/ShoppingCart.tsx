/**
 * Shopping Cart Component
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
  onRemove?: (itemId: string, itemType: CartItem['type']) => void;
  onClear?: () => void;
  onCheckout?: () => void;
  loading?: boolean;
}

export function ShoppingCart({
  items,
  total,
  onRemove,
  onClear,
  onCheckout,
  loading,
}: ShoppingCartProps) {
  if (items.length === 0) {
    return (
      <Card className="shopping-cart">
        <div className="cart-empty">
          <p>Your cart is empty</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="shopping-cart">
      <div className="cart-header">
        <h3>Shopping Cart</h3>
        {items.length > 0 && onClear && (
          <Button variant="secondary" onClick={onClear} size="small">
            Clear
          </Button>
        )}
      </div>
      <div className="cart-items">
        {items.map((item, index) => (
          <div key={`${item.itemId}-${item.type}-${index}`} className="cart-item">
            <div className="cart-item-info">
              <div className="cart-item-name">{item.name || item.itemId}</div>
              <div className="cart-item-meta">
                <span className="cart-item-type">{item.type}</span>
                <span className="cart-item-quantity">Qty: {item.quantity}</span>
                {item.price && (
                  <span className="cart-item-price">
                    {item.price.amount * item.quantity} {item.price.currency}
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
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      {total && (
        <div className="cart-footer">
          <div className="cart-total">
            <strong>Total: {total.amount} {total.currency}</strong>
          </div>
          {onCheckout && (
            <Button onClick={onCheckout} disabled={loading || items.length === 0}>
              {loading ? 'Processing...' : 'Checkout'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

