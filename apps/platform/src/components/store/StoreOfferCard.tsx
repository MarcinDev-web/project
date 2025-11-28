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

// Generate unique gradient based on item title/id for visual variety
function getItemGradient(title: string, kind: StoreOfferKind): { gradient: string; accent: string } {
  // Hash the title for consistent but varied colors
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Kind-based color themes
  const kindThemes: Record<StoreOfferKind, { primary: string; secondary: string; accent: string }[]> = {
    avatar: [
      { primary: '#6366f1', secondary: '#8b5cf6', accent: '#a78bfa' }, // Purple
      { primary: '#ec4899', secondary: '#f472b6', accent: '#f9a8d4' }, // Pink
      { primary: '#14b8a6', secondary: '#2dd4bf', accent: '#5eead4' }, // Teal
      { primary: '#f97316', secondary: '#fb923c', accent: '#fdba74' }, // Orange
      { primary: '#06b6d4', secondary: '#22d3ee', accent: '#67e8f9' }, // Cyan
    ],
    build: [
      { primary: '#3b82f6', secondary: '#60a5fa', accent: '#93c5fd' }, // Blue
      { primary: '#10b981', secondary: '#34d399', accent: '#6ee7b7' }, // Emerald
      { primary: '#8b5cf6', secondary: '#a78bfa', accent: '#c4b5fd' }, // Violet
      { primary: '#f59e0b', secondary: '#fbbf24', accent: '#fcd34d' }, // Amber
    ],
    material: [
      { primary: '#78716c', secondary: '#a8a29e', accent: '#d6d3d1' }, // Stone
      { primary: '#854d0e', secondary: '#a16207', accent: '#ca8a04' }, // Bronze
      { primary: '#475569', secondary: '#64748b', accent: '#94a3b8' }, // Slate
    ],
    model: [
      { primary: '#0891b2', secondary: '#06b6d4', accent: '#22d3ee' }, // Cyan
      { primary: '#7c3aed', secondary: '#8b5cf6', accent: '#a78bfa' }, // Violet
    ],
    texture: [
      { primary: '#059669', secondary: '#10b981', accent: '#34d399' }, // Emerald
      { primary: '#dc2626', secondary: '#ef4444', accent: '#f87171' }, // Red
    ],
    script: [
      { primary: '#16a34a', secondary: '#22c55e', accent: '#4ade80' }, // Green (code)
      { primary: '#0284c7', secondary: '#0ea5e9', accent: '#38bdf8' }, // Sky
    ],
    consumable: [
      { primary: '#ea580c', secondary: '#f97316', accent: '#fb923c' }, // Orange
      { primary: '#db2777', secondary: '#ec4899', accent: '#f472b6' }, // Pink
    ],
    cosmetic: [
      { primary: '#c026d3', secondary: '#d946ef', accent: '#e879f9' }, // Fuchsia
      { primary: '#e11d48', secondary: '#f43f5e', accent: '#fb7185' }, // Rose
    ],
    upgrade: [
      { primary: '#eab308', secondary: '#facc15', accent: '#fde047' }, // Yellow/Gold
      { primary: '#f97316', secondary: '#fb923c', accent: '#fdba74' }, // Orange
    ],
    collectible: [
      { primary: '#7c3aed', secondary: '#8b5cf6', accent: '#a78bfa' }, // Violet
      { primary: '#2563eb', secondary: '#3b82f6', accent: '#60a5fa' }, // Blue
    ],
    other: [
      { primary: '#64748b', secondary: '#94a3b8', accent: '#cbd5e1' }, // Slate
    ],
  };
  
  const themes = kindThemes[kind] || kindThemes.other;
  const themeIndex = Math.abs(hash) % themes.length;
  const theme = themes[themeIndex];
  
  return {
    gradient: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 50%, ${theme.primary} 100%)`,
    accent: theme.accent,
  };
}

// SVG icons for different product kinds
function getKindIcon(kind: StoreOfferKind, title: string): ReactNode {
  const iconSize = 48;
  const strokeWidth = 1.5;
  
  // Check title for specific avatar types
  const lowerTitle = title.toLowerCase();
  
  if (kind === 'avatar') {
    if (lowerTitle.includes('viking')) {
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
          {/* Viking helmet with horns */}
          <path d="M12 28C12 20 16 14 24 14C32 14 36 20 36 28" strokeLinecap="round" />
          <path d="M10 28H38V32C38 36 32 40 24 40C16 40 10 36 10 32V28Z" />
          <path d="M12 24L6 16M36 24L42 16" strokeLinecap="round" /> {/* Horns */}
          <path d="M18 32H30" strokeLinecap="round" /> {/* Face guard */}
          <circle cx="20" cy="26" r="2" fill="currentColor" /> {/* Eye */}
          <circle cx="28" cy="26" r="2" fill="currentColor" /> {/* Eye */}
          <path d="M8 8L12 24M40 8L36 24" strokeLinecap="round" strokeWidth="2" /> {/* Horn detail */}
        </svg>
      );
    }
    if (lowerTitle.includes('elf')) {
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
          {/* Elf with pointed ears */}
          <ellipse cx="24" cy="26" rx="10" ry="12" />
          <path d="M14 22L6 14" strokeLinecap="round" /> {/* Pointed ear */}
          <path d="M34 22L42 14" strokeLinecap="round" /> {/* Pointed ear */}
          <circle cx="20" cy="24" r="1.5" fill="currentColor" />
          <circle cx="28" cy="24" r="1.5" fill="currentColor" />
          <path d="M21 30C22 31 26 31 27 30" strokeLinecap="round" /> {/* Smile */}
          <path d="M18 16C20 12 28 12 30 16" strokeLinecap="round" /> {/* Hair */}
          <path d="M24 8V14" strokeLinecap="round" /> {/* Hair strand */}
        </svg>
      );
    }
    if (lowerTitle.includes('cyborg') || lowerTitle.includes('robot')) {
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
          {/* Cyborg head */}
          <rect x="12" y="12" width="24" height="26" rx="4" />
          <rect x="16" y="18" width="6" height="4" rx="1" fill="currentColor" /> {/* Eye */}
          <rect x="26" y="18" width="6" height="4" rx="1" /> {/* Mechanical eye */}
          <circle cx="29" cy="20" r="1" fill="currentColor" />
          <path d="M20 28H28" strokeLinecap="round" />
          <path d="M18 32H30" strokeLinecap="round" />
          <path d="M10 20H12M36 20H38" strokeLinecap="round" /> {/* Side panels */}
          <path d="M24 8V12" strokeLinecap="round" /> {/* Antenna */}
          <circle cx="24" cy="6" r="2" />
          <path d="M14 40V44M34 40V44" strokeLinecap="round" /> {/* Neck connectors */}
        </svg>
      );
    }
    // Default avatar
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        <circle cx="24" cy="18" r="8" />
        <path d="M12 42C12 34 17 28 24 28C31 28 36 34 36 42" strokeLinecap="round" />
      </svg>
    );
  }
  
  if (kind === 'build') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* Building blocks */}
        <rect x="8" y="28" width="12" height="12" rx="1" />
        <rect x="20" y="20" width="12" height="20" rx="1" />
        <rect x="28" y="8" width="12" height="32" rx="1" />
        <path d="M8 28L14 22H26L32 8" strokeLinecap="round" strokeDasharray="2 2" />
      </svg>
    );
  }
  
  if (kind === 'material') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* Material/texture square */}
        <rect x="8" y="8" width="32" height="32" rx="2" />
        <path d="M8 20H40M8 32H40M20 8V40M32 8V40" strokeOpacity="0.5" />
        <circle cx="24" cy="24" r="6" fill="currentColor" fillOpacity="0.2" />
      </svg>
    );
  }
  
  if (kind === 'model') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* 3D cube */}
        <path d="M24 6L40 16V32L24 42L8 32V16L24 6Z" />
        <path d="M24 6V22M24 22L8 32M24 22L40 32" strokeOpacity="0.6" />
      </svg>
    );
  }
  
  if (kind === 'texture') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* Texture/image */}
        <rect x="6" y="10" width="36" height="28" rx="2" />
        <circle cx="16" cy="20" r="4" />
        <path d="M6 32L18 24L28 32L42 20" strokeLinecap="round" />
      </svg>
    );
  }
  
  if (kind === 'script') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* Code brackets */}
        <path d="M16 12L8 24L16 36" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M32 12L40 24L32 36" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 8L20 40" strokeLinecap="round" />
      </svg>
    );
  }
  
  if (kind === 'consumable') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* Potion bottle */}
        <path d="M20 8H28V14L34 24V38C34 40 32 42 28 42H20C16 42 14 40 14 38V24L20 14V8Z" />
        <path d="M18 8H30" strokeLinecap="round" />
        <ellipse cx="24" cy="32" rx="6" ry="4" fill="currentColor" fillOpacity="0.3" />
      </svg>
    );
  }
  
  if (kind === 'cosmetic') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* Sparkle/star */}
        <path d="M24 4L28 18L42 18L30 28L34 42L24 32L14 42L18 28L6 18L20 18L24 4Z" />
      </svg>
    );
  }
  
  if (kind === 'upgrade') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* Arrow up with plus */}
        <path d="M24 40V12M24 12L14 22M24 12L34 22" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 6H32" strokeLinecap="round" />
        <circle cx="24" cy="6" r="4" />
      </svg>
    );
  }
  
  if (kind === 'collectible') {
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
        {/* Trophy/gem */}
        <path d="M16 8H32L36 16L24 40L12 16L16 8Z" />
        <path d="M16 8L24 20L32 8" strokeOpacity="0.5" />
        <path d="M12 16H36" strokeOpacity="0.5" />
      </svg>
    );
  }
  
  // Default icon
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <rect x="8" y="8" width="32" height="32" rx="4" />
      <circle cx="24" cy="24" r="8" />
    </svg>
  );
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
  
  const { gradient, accent } = getItemGradient(offer.title, offer.kind);

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
          <div 
            className="shop-item-placeholder shop-item-placeholder--dynamic"
            style={{ 
              '--card-gradient': gradient,
              '--card-accent': accent,
            } as React.CSSProperties}
          >
            <div className="shop-item-placeholder__icon">
              {getKindIcon(offer.kind, offer.title)}
            </div>
            <span className="shop-item-placeholder__title">{offer.title}</span>
          </div>
        )}
        <div className="shop-card-badges">
          {offer.badge && <span className="shop-badge shop-badge--new">{offer.badge}</span>}
          {offer.owned && <span className="shop-badge shop-badge--success">Owned</span>}
          {isUnavailable && <span className="shop-badge shop-badge--warning">Unavailable</span>}
        </div>
      </div>

      <div className="store-offer-body">
        <div className="store-offer-header">
          <div className="store-offer-kind">
            <span className="store-offer-kind__icon">{getKindEmoji(offer.kind)}</span>
            {offer.kind}
          </div>
          <div className={`store-price-pill store-price-pill--${offer.priceType}`}>
            {offer.priceLabel}
          </div>
        </div>
        <h3 className="shop-item-name">{offer.title}</h3>
        {offer.description && (
          <p className="shop-item-description">{offer.description}</p>
        )}

        <div className="store-offer-meta">
          {offer.author && <span className="store-offer-meta__author">by {offer.author}</span>}
          {offer.downloads !== undefined && (
            <span className="store-offer-meta__stat">
              <span className="store-offer-meta__icon">⬇</span>
              {offer.downloads.toLocaleString()}
            </span>
          )}
          {offer.likes !== undefined && (
            <span className="store-offer-meta__stat">
              <span className="store-offer-meta__icon">♥</span>
              {offer.likes.toLocaleString()}
            </span>
          )}
          {offer.stock !== undefined && (
            <span className="store-offer-meta__stat">Stock: {offer.stock}</span>
          )}
        </div>

        <div className="shop-item-footer">
          {renderAction()}
          {footerSlot}
        </div>
      </div>
    </Card>
  );
}

function getKindEmoji(kind: StoreOfferKind): string {
  const emojis: Record<StoreOfferKind, string> = {
    avatar: '👤',
    build: '🏗️',
    material: '🧱',
    model: '📦',
    texture: '🎨',
    script: '⚡',
    consumable: '🧪',
    cosmetic: '✨',
    upgrade: '⬆️',
    collectible: '💎',
    other: '📁',
  };
  return emojis[kind] || '📁';
}
