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
    createdAt?: number;
  };
  owned?: boolean;
  onAddToCart?: () => void;
}

export function ShopItemCard({ item, owned, onAddToCart }: ShopItemCardProps) {
  const isOutOfStock = item.stock !== undefined && item.stock === 0;
  const canPurchase = item.available && !isOutOfStock && !owned;
  const isNew = item.createdAt ? Date.now() - item.createdAt < 1000 * 60 * 60 * 24 * 7 : false;

  return (
    <Card className="shop-item-card">
      <div className="shop-card-visual">
        {item.imageUrl ? (
          <div className="shop-item-image">
            <img src={item.imageUrl} alt={item.name} />
          </div>
        ) : (
          <div className="shop-item-placeholder">No preview available</div>
        )}
        <div className="shop-card-badges">
          {owned && <span className="shop-badge success">Owned</span>}
          {isOutOfStock && <span className="shop-badge warning">Sold out</span>}
          {!owned && !isOutOfStock && item.available && isNew && (
            <span className="shop-badge">New</span>
          )}
        </div>
      </div>
      <div className="shop-item-content">
        <h3 className="shop-item-name">{item.name}</h3>
        {item.description && (
          <p className="shop-item-description">{item.description}</p>
        )}
        <div className="shop-item-meta">
          <span className="shop-item-category">{item.category}</span>
          {item.available ? (
            <span className="shop-status positive">Available</span>
          ) : (
            <span className="shop-status">Unavailable</span>
          )}
          {item.stock !== undefined && (
            <span className="shop-item-stock">Stock: {item.stock}</span>
          )}
        </div>
        <div className="shop-item-footer">
          <div className="shop-price-block">
            <span className="shop-price-chip">
              {item.price.amount} {item.price.currency}
            </span>
            {owned && <span className="shop-muted-tag">In your library</span>}
          </div>
          {owned ? (
            <Button disabled size="small">Owned</Button>
          ) : !canPurchase ? (
            <Button disabled size="small">{isOutOfStock ? 'Out of Stock' : 'Unavailable'}</Button>
          ) : (
            <Button onClick={onAddToCart} size="small">Add to cart</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

