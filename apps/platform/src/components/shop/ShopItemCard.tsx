/**
 * Shop Item Card Component
 */

import { Card } from '../shared/Card';
import { Button } from '../shared/Button';

export interface ShopItemCardProps {
  item: {
    id: string;
    name: string;
    description?: string;
    category: 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
    price: { currency: string; amount: number };
    imageUrl?: string;
    available: boolean;
    stock?: number;
  };
  owned?: boolean;
  onAddToCart?: () => void;
}

export function ShopItemCard({ item, owned, onAddToCart }: ShopItemCardProps) {
  const isOutOfStock = item.stock !== undefined && item.stock === 0;
  const canPurchase = item.available && !isOutOfStock && !owned;

  return (
    <Card className="shop-item-card">
      {item.imageUrl && (
        <div className="shop-item-image">
          <img src={item.imageUrl} alt={item.name} />
        </div>
      )}
      <div className="shop-item-content">
        <h3 className="shop-item-name">{item.name}</h3>
        {item.description && (
          <p className="shop-item-description">{item.description}</p>
        )}
        <div className="shop-item-meta">
          <span className="shop-item-category">{item.category}</span>
          {item.stock !== undefined && (
            <span className="shop-item-stock">Stock: {item.stock}</span>
          )}
        </div>
        <div className="shop-item-footer">
          <div className="shop-item-price">
            {item.price.amount} {item.price.currency}
          </div>
          {owned ? (
            <Button disabled>Owned</Button>
          ) : !canPurchase ? (
            <Button disabled>{isOutOfStock ? 'Out of Stock' : 'Unavailable'}</Button>
          ) : (
            <Button onClick={onAddToCart}>Add to Cart</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

