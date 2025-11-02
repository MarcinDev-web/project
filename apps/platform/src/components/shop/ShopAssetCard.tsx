/**
 * Shop Asset Card Component
 */

import { Card } from '../shared/Card';
import { Button } from '../shared/Button';

export interface ShopAssetCardProps {
  asset: {
    id: string;
    name: string;
    description?: string;
    type: 'material' | 'model' | 'texture' | 'script';
    category?: string;
    price: { currency: string; amount: number };
    previewUrl?: string;
    available: boolean;
  };
  owned?: boolean;
  onAddToCart?: () => void;
}

export function ShopAssetCard({ asset, owned, onAddToCart }: ShopAssetCardProps) {
  const canPurchase = asset.available && !owned;

  return (
    <Card className="shop-asset-card">
      {asset.previewUrl && (
        <div className="shop-asset-preview">
          <img src={asset.previewUrl} alt={asset.name} />
        </div>
      )}
      <div className="shop-asset-content">
        <h3 className="shop-asset-name">{asset.name}</h3>
        {asset.description && (
          <p className="shop-asset-description">{asset.description}</p>
        )}
        <div className="shop-asset-meta">
          <span className="shop-asset-type">{asset.type}</span>
          {asset.category && (
            <span className="shop-asset-category">{asset.category}</span>
          )}
        </div>
        <div className="shop-asset-footer">
          <div className="shop-asset-price">
            {asset.price.amount} {asset.price.currency}
          </div>
          {owned ? (
            <Button disabled>Owned</Button>
          ) : !canPurchase ? (
            <Button disabled>Unavailable</Button>
          ) : (
            <Button onClick={onAddToCart}>Add to Cart</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

