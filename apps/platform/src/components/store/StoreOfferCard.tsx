import type { ReactNode } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';

export type StoreOfferSource = 'shop-item' | 'asset' | 'marketplace';
export type StoreOfferKind =
  | 'build'
  | 'avatar'
  | 'material'
  | 'model'
  | 'texture'
  | 'script'
  | 'consumable'
  | 'cosmetic'
  | 'upgrade'
  | 'collectible'
  | 'other';
export type StorePriceType = 'free' | 'platform' | 'fiat';

export interface StoreOffer {
  id: string;
  source: StoreOfferSource;
  kind: StoreOfferKind;
  title: string;
  description?: string;
  tags?: string[];
  priceType: StorePriceType;
  priceLabel: string;
  amount?: number;
  currency?: string;
  imageUrl?: string;
  badge?: string;
  available?: boolean;
  stock?: number;
  owned?: boolean;
  author?: string;
  downloads?: number;
  likes?: number;
  createdAt?: number;
  link?: string;
}

interface StoreOfferCardProps {
  offer: StoreOffer;
  onAddToCart?: (offer: StoreOffer) => void;
  onOpen?: (offer: StoreOffer) => void;
  onDownloadFree?: (offer: StoreOffer) => void;
  actionLoading?: boolean;
  footerSlot?: ReactNode;
}

export function StoreOfferCard({
  offer,
  onAddToCart,
  onOpen,
  onDownloadFree,
  actionLoading,
  footerSlot,
}: StoreOfferCardProps) {
  const isUnavailable = offer.available === false || (offer.stock !== undefined && offer.stock === 0);
  const canAddToCart = onAddToCart && !offer.owned && !isUnavailable && offer.source !== 'marketplace';

  const renderAction = () => {
    if (offer.owned) {
      return <Button disabled size="small">Owned</Button>;
    }

    if (isUnavailable) {
      return <Button disabled size="small">Unavailable</Button>;
    }

    if (offer.priceType === 'free' && offer.source === 'marketplace' && onDownloadFree) {
      return (
        <Button size="small" onClick={() => onDownloadFree(offer)} disabled={actionLoading}>
          {actionLoading ? 'Downloading...' : 'Download'}
        </Button>
      );
    }

    if (canAddToCart) {
      return (
        <Button size="small" onClick={() => onAddToCart?.(offer)} disabled={actionLoading}>
          {actionLoading ? 'Adding...' : 'Add to cart'}
        </Button>
      );
    }

    return (
      <Button
        size="small"
        variant="secondary"
        onClick={() => onOpen?.(offer)}
        disabled={actionLoading}
      >
        {actionLoading ? 'Opening...' : 'View details'}
      </Button>
    );
  };

  return (
    <Card className="store-offer-card">
      <div className="shop-card-visual">
        {offer.imageUrl ? (
          <div className="shop-item-image">
            <img src={offer.imageUrl} alt={offer.title} />
          </div>
        ) : (
          <div className="shop-item-placeholder">No preview available</div>
        )}
        <div className="shop-card-badges">
          {offer.badge && <span className="shop-badge">{offer.badge}</span>}
          {offer.owned && <span className="shop-badge success">Owned</span>}
          {isUnavailable && <span className="shop-badge warning">Unavailable</span>}
        </div>
      </div>

      <div className="store-offer-body">
        <div className="store-offer-header">
          <div className="store-offer-kind">{offer.kind}</div>
          <div className={`store-price-pill ${offer.priceType}`}>
            {offer.priceLabel}
          </div>
        </div>
        <h3 className="shop-item-name">{offer.title}</h3>
        {offer.description && (
          <p className="shop-item-description">{offer.description}</p>
        )}

        <div className="store-offer-meta">
          {offer.author && <span>by {offer.author}</span>}
          {offer.downloads !== undefined && <span>{offer.downloads} downloads</span>}
          {offer.likes !== undefined && <span>{offer.likes} likes</span>}
          {offer.stock !== undefined && <span>Stock: {offer.stock}</span>}
        </div>

        {offer.tags && offer.tags.length > 0 && (
          <div className="store-offer-tags">
            {offer.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="store-tag">{tag}</span>
            ))}
          </div>
        )}

        <div className="shop-item-footer">
          {renderAction()}
          {footerSlot}
        </div>
      </div>
    </Card>
  );
}
