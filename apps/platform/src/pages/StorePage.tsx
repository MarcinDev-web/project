import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { WalletDisplay } from '../components/shop/WalletDisplay';
import { ShoppingCart } from '../components/shop/ShoppingCart';
import { shopApi, type Asset, type CartItem, type ShopItem, type WalletBalance } from '../api/shop';
import { marketplaceApi, type MarketplaceItem } from '../api/marketplace';
import { useAuth } from '../contexts/AuthContext';
import { StoreOfferCard, type StoreOffer, type StoreOfferKind, type StorePriceType } from '../components/store/StoreOfferCard';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';

type ItemFilter =
  | 'all'
  | 'build'
  | 'avatar'
  | 'material'
  | 'model'
  | 'texture'
  | 'script'
  | 'consumable'
  | 'cosmetic'
  | 'upgrade'
  | 'collectible';

type PriceFilter = 'all' | 'free' | 'platform';

const PLATFORM_CURRENCIES = ['credits', 'coins', 'gems'];
const PLATFORM_CURRENCY_LABEL = 'CRD';

export function StorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [wallet, setWallet] = useState<WalletBalance[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'newest'>('featured');

  useEffect(() => {
    void loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const emptyItems = { items: [] as ShopItem[], total: 0, page: 0, pageSize: 0 };
      const emptyAssets = { items: [] as Asset[], total: 0, page: 0, pageSize: 0 };
      const emptyCart = { items: [] as CartItem[] };
      const emptyWallet = { balances: [] as WalletBalance[] };
      const emptyOwned = { items: [] as Array<{ itemId: string; itemType: CartItem['type'] }> };

      const [
        itemsResponse,
        assetsResponse,
        cartResponse,
        walletResponse,
        ownedResponse,
        marketplaceBuilds,
        marketplaceAvatars,
      ] = await Promise.all([
        user ? shopApi.getItems({ limit: 100 }) : Promise.resolve(emptyItems),
        user ? shopApi.getAssets({ limit: 100 }) : Promise.resolve(emptyAssets),
        user ? shopApi.getCart() : Promise.resolve(emptyCart),
        user ? shopApi.getWallet() : Promise.resolve(emptyWallet),
        user ? shopApi.getOwned() : Promise.resolve(emptyOwned),
        marketplaceApi.getBuilds({ limit: 50 }),
        marketplaceApi.getAvatars({ limit: 50 }),
      ]);

      setCart(cartResponse.items);
      setWallet(walletResponse.balances);

      const ownedSet = new Set<string>();
      for (const item of ownedResponse.items) {
        ownedSet.add(`${item.itemId}:${item.itemType}`);
      }
      setOwnedItems(ownedSet);

      const normalizedOffers: StoreOffer[] = [
        ...itemsResponse.items.map(normalizeShopItem(ownedSet)),
        ...assetsResponse.items.map(normalizeAsset(ownedSet)),
        ...marketplaceBuilds.items.map((item) => normalizeMarketplaceItem(item, 'build')),
        ...marketplaceAvatars.items.map((item) => normalizeMarketplaceItem(item, 'avatar')),
      ];

      setOffers(normalizedOffers);
    } catch (error) {
      console.error('Failed to load store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizePrice = (price?: { currency: string; amount: number }): { type: StorePriceType; label: string; currency?: string; amount?: number } => {
    if (!price || price.amount === 0) {
      return { type: 'free', label: 'Free' };
    }
    const currencyCode = price.currency.toLowerCase();
    if (PLATFORM_CURRENCIES.includes(currencyCode)) {
      return {
        type: 'platform',
        label: `${price.amount} ${PLATFORM_CURRENCY_LABEL}`,
        currency: PLATFORM_CURRENCY_LABEL,
        amount: price.amount,
      };
    }
    return {
      type: 'fiat',
      label: `${price.amount} ${price.currency}`,
      currency: price.currency,
      amount: price.amount,
    };
  };

  const normalizeShopItem = (ownedSet: Set<string>) => (item: ShopItem): StoreOffer => {
    const price = normalizePrice(item.price);
    return {
      id: item.id,
      source: 'shop-item',
      kind: item.category as StoreOfferKind,
      title: item.name,
      description: item.description,
      tags: [item.category],
      priceType: price.type,
      priceLabel: price.label,
      amount: price.amount,
      currency: price.currency,
      imageUrl: item.imageUrl,
      available: item.available,
      stock: item.stock,
      owned: ownedSet.has(`${item.id}:shop-item`),
      badge: isNew(item.createdAt) ? 'New' : undefined,
      createdAt: item.createdAt,
    };
  };

  const normalizeAsset = (ownedSet: Set<string>) => (asset: Asset): StoreOffer => {
    const price = normalizePrice(asset.price);
    return {
      id: asset.id,
      source: 'asset',
      kind: asset.type as StoreOfferKind,
      title: asset.name,
      description: asset.description,
      tags: asset.category ? [asset.category] : [asset.type],
      priceType: price.type,
      priceLabel: price.label,
      amount: price.amount,
      currency: price.currency,
      imageUrl: asset.previewUrl,
      available: asset.available,
      owned: ownedSet.has(`${asset.id}:asset`),
      badge: isNew(asset.createdAt) ? 'New' : undefined,
      createdAt: asset.createdAt,
    };
  };

  const normalizeMarketplaceItem = (item: MarketplaceItem, fallbackKind: StoreOfferKind): StoreOffer => {
    const price = normalizePrice(item.price);
    return {
      id: item.id,
      source: 'marketplace',
      kind: (item.type ?? fallbackKind) as StoreOfferKind,
      title: item.title,
      description: item.description,
      tags: item.tags,
      priceType: price.type,
      priceLabel: price.label,
      amount: price.amount,
      currency: price.currency,
      imageUrl: item.thumbnailUrl,
      badge: isNew(item.createdAt) ? 'New' : undefined,
      author: item.authorName ?? 'Unknown',
      downloads: item.downloads,
      likes: item.likes,
      createdAt: item.createdAt,
      link: `/marketplace/${item.id}`,
    };
  };

  const handleAddToCart = async (offer: StoreOffer) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setActionLoadingId(offer.id);
    try {
      const type: CartItem['type'] = offer.source === 'asset' ? 'asset' : 'shop-item';
      await shopApi.addToCart({ itemId: offer.id, type, quantity: 1 });
      const cartResponse = await shopApi.getCart();
      setCart(cartResponse.items);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveFromCart = async (itemId: string, itemType: CartItem['type']) => {
    setCartLoading(true);
    try {
      await shopApi.removeFromCart(itemId, itemType);
      const cartResponse = await shopApi.getCart();
      setCart(cartResponse.items);
    } catch (error) {
      console.error('Failed to remove from cart:', error);
    } finally {
      setCartLoading(false);
    }
  };

  const handleClearCart = async () => {
    setCartLoading(true);
    try {
      await shopApi.clearCart();
      setCart([]);
    } catch (error) {
      console.error('Failed to clear cart:', error);
    } finally {
      setCartLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setCartLoading(true);
    try {
      const result = await shopApi.checkout();
      if (result.success) {
        await loadData();
        alert('Purchase successful!');
      } else {
        alert(`Checkout failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setCartLoading(false);
    }
  };

  const handleOpen = (offer: StoreOffer) => {
    if (offer.link) {
      navigate(offer.link);
    }
  };

  const handleDownloadFree = async (offer: StoreOffer) => {
    setActionLoadingId(offer.id);
    try {
      const download = await marketplaceApi.downloadFreeItem(offer.id);
      window.open(download.fileUrl, '_blank');
    } catch (error) {
      console.error('Failed to download item:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  const platformBalance = useMemo(() => {
    for (const code of PLATFORM_CURRENCIES) {
      const balance = wallet.find((entry) => entry.currency.toLowerCase() === code);
      if (balance) return balance.balance;
    }
    return 0;
  }, [wallet]);

  const priceFilterMatch = (offer: StoreOffer) => {
    if (priceFilter === 'all') return true;
    return offer.priceType === priceFilter;
  };

  const itemFilterMatch = (offer: StoreOffer) => {
    if (itemFilter === 'all') return true;
    return offer.kind === itemFilter;
  };

  const visibleOffers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const catalogOffers = offers.filter((offer) => offer.priceType !== 'fiat');
    let filtered = catalogOffers.filter((offer) => {
      const matchesSearch =
        !query ||
        offer.title.toLowerCase().includes(query) ||
        (offer.description?.toLowerCase().includes(query) ?? false) ||
        (offer.tags?.some((tag) => tag.toLowerCase().includes(query)) ?? false);
      return matchesSearch && priceFilterMatch(offer) && itemFilterMatch(offer);
    });

    if (sortBy === 'newest') {
      filtered = filtered.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }

    return filtered;
  }, [offers, searchTerm, priceFilter, itemFilter, sortBy]);

  const filters: Array<{ key: ItemFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: offers.length },
    { key: 'build', label: 'Builds', count: offers.filter((o) => o.kind === 'build').length },
    { key: 'avatar', label: 'Avatars', count: offers.filter((o) => o.kind === 'avatar').length },
    { key: 'material', label: 'Materials', count: offers.filter((o) => o.kind === 'material').length },
    { key: 'model', label: 'Models', count: offers.filter((o) => o.kind === 'model').length },
    { key: 'texture', label: 'Textures', count: offers.filter((o) => o.kind === 'texture').length },
    { key: 'script', label: 'Scripts', count: offers.filter((o) => o.kind === 'script').length },
    { key: 'consumable', label: 'Consumables', count: offers.filter((o) => o.kind === 'consumable').length },
    { key: 'cosmetic', label: 'Cosmetics', count: offers.filter((o) => o.kind === 'cosmetic').length },
    { key: 'upgrade', label: 'Upgrades', count: offers.filter((o) => o.kind === 'upgrade').length },
    { key: 'collectible', label: 'Collectibles', count: offers.filter((o) => o.kind === 'collectible').length },
  ];

  const priceFilters: Array<{ key: PriceFilter; label: string }> = [
    { key: 'all', label: 'All prices' },
    { key: 'free', label: 'Free' },
    { key: 'platform', label: 'Platform currency' },
  ];

  const topupPacks = [
    { amount: 500, price: '$4.99' },
    { amount: 1500, price: '$12.99' },
    { amount: 5000, price: '$34.99' },
  ];

  const isGuest = !user;

  const handleTopupClick = (amount: number) => {
    if (!user) {
      navigate('/login');
      return;
    }
    alert(`Connect billing API to process a purchase of ${amount.toLocaleString()} ${PLATFORM_CURRENCY_LABEL}.`);
  };

  const cartItemsWithDetails = useMemo(() => {
    return cart.map((item) => {
      const match = offers.find((offer) => {
        const key = offer.source === 'asset' ? 'asset' : 'shop-item';
        return `${offer.id}:${key}` === `${item.itemId}:${item.type}`;
      });
      const price = match && match.priceType !== 'free' && match.amount && match.currency
        ? { currency: match.currency, amount: match.amount }
        : item.price;

      return {
        ...item,
        name: match?.title ?? item.name ?? item.itemId,
        price,
      };
    });
  }, [cart, offers]);

  const cartTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of cartItemsWithDetails) {
      if (!item.price) continue;
      totals.set(item.price.currency, (totals.get(item.price.currency) ?? 0) + item.price.amount * item.quantity);
    }
    return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount }));
  }, [cartItemsWithDetails]);

  return (
    <Layout>
      <div className="shop-page">
        <section className="shop-hero">
          <div className="shop-hero__content">
            <p className="shop-eyebrow">Unified Store</p>
            <h1>Assets, builds, avatars, currency</h1>
            <p className="shop-hero__subtitle">
              One storefront for marketplace content, shop items, creator assets, and platform currency. Real money is only used for buying platform credits; everything else is free or costs platform currency.
            </p>
            {isGuest && (
              <div className="store-cta-row">
                <Button onClick={() => navigate('/login')}>Log in to purchase</Button>
              </div>
            )}
            <div className="shop-hero__stats">
              <div className="shop-hero__stat">
                <span className="shop-hero__stat-value">{offers.length}</span>
                <span className="shop-hero__stat-label">Total offers</span>
              </div>
              <div className="shop-hero__stat">
                <span className="shop-hero__stat-value">{platformBalance}</span>
                <span className="shop-hero__stat-label">Platform balance ({PLATFORM_CURRENCY_LABEL})</span>
              </div>
              <div className="shop-hero__stat">
                <span className="shop-hero__stat-value">{cart.length}</span>
                <span className="shop-hero__stat-label">Cart items</span>
              </div>
            </div>
          </div>
            <div className="shop-hero__panel">
              <div className="shop-hero__panel-header">
                <p className="shop-eyebrow">Top up currency</p>
                <span className="shop-pill">Platform</span>
              </div>
            <div className="store-topup-grid">
              {topupPacks.map((pack) => (
                <Card key={pack.amount} className="store-topup-card">
                  <div className="store-topup-amount">{pack.amount.toLocaleString()} {PLATFORM_CURRENCY_LABEL}</div>
                  <div className="store-topup-price">{pack.price}</div>
                  <Button size="small" onClick={() => handleTopupClick(pack.amount)}>
                    Buy credits
                  </Button>
                </Card>
              ))}
            </div>
            <div className="shop-hero__hint">
              Single platform currency for all purchases. Real money is only used to buy these packs.
            </div>
          </div>
        </section>

        <div className="shop-toolbar">
          <div className="shop-search">
            <input
              type="search"
              placeholder="Search everything..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="shop-tabs">
            {priceFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setPriceFilter(filter.key)}
                className={`shop-tab-button ${priceFilter === filter.key ? 'active' : ''}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="shop-filters">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setItemFilter(filter.key)}
              className={`shop-filter-chip ${itemFilter === filter.key ? 'active' : ''}`}
            >
              {filter.label} <span className="shop-muted">({filter.count})</span>
            </button>
          ))}
          <div className="store-sort">
            <span className="shop-muted">Sort:</span>
            <button
              className={`shop-filter-chip ${sortBy === 'featured' ? 'active' : ''}`}
              onClick={() => setSortBy('featured')}
            >
              Featured
            </button>
            <button
              className={`shop-filter-chip ${sortBy === 'newest' ? 'active' : ''}`}
              onClick={() => setSortBy('newest')}
            >
              Newest
            </button>
          </div>
        </div>

        <div className="shop-content-wrapper">
          <div className="shop-main-content">
            {loading ? (
              <div className="shop-loading">Loading unified catalog...</div>
            ) : visibleOffers.length === 0 ? (
              <div className="shop-empty-state">
                <p>No results for the current filters.</p>
                <p className="shop-muted">Try adjusting the search or category.</p>
              </div>
            ) : (
              <div className="shop-items-grid">
                {visibleOffers.map((offer) => (
                  <StoreOfferCard
                    key={offer.id}
                    offer={offer}
                    onAddToCart={offer.source === 'marketplace' ? undefined : handleAddToCart}
                    onOpen={handleOpen}
                    onDownloadFree={offer.source === 'marketplace' ? handleDownloadFree : undefined}
                    actionLoading={actionLoadingId === offer.id}
                    footerSlot={
                      offer.priceType === 'free' ? <span className="store-tag">Free</span> : null
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="shop-sidebar">
            <WalletDisplay balances={wallet} loading={loading} />
            <div className="shop-sidebar-card">
              <ShoppingCart
                items={cartItemsWithDetails}
                totals={cartTotals}
                onRemove={handleRemoveFromCart}
                onClear={handleClearCart}
                onCheckout={handleCheckout}
                loading={cartLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function isNew(createdAt?: number): boolean {
  if (!createdAt) return false;
  const WEEK = 1000 * 60 * 60 * 24 * 7;
  return Date.now() - createdAt < WEEK;
}
