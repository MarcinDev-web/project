import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { shopApi, type Asset, type CartItem, type ShopItem, type WalletBalance } from '../api/shop';
import { marketplaceApi, type MarketplaceItem } from '../api/marketplace';
import { useAuth } from '../contexts/AuthContext';
import { StoreOfferCard, type StoreOffer, type StoreOfferKind, type StorePriceType } from '../components/store/StoreOfferCard';
import { WalletDropdown } from '../components/store/WalletDropdown';
import { TopUpModal } from '../components/store/TopUpModal';
import { CartSlideout } from '../components/store/CartSlideout';
import { StoreToolbar, type ItemFilter, type PriceFilter, type SortOption } from '../components/store/StoreToolbar';
import { Button } from '../components/shared/Button';

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

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  // UI state for modals/slideouts
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const isGuest = !user;

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
        setCartOpen(false);
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

  const handleTopUpPurchase = (amount: number) => {
    if (!user) {
      navigate('/login');
      return;
    }
    alert(`Connect billing API to process a purchase of ${amount.toLocaleString()} ${PLATFORM_CURRENCY_LABEL}.`);
    setShowTopUpModal(false);
  };

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

  // Only show filters that have items (count > 0), always keep "All"
  const filterOptions = useMemo(() => {
    const allFilters: Array<{ key: ItemFilter; label: string; count: number }> = [
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
    // Filter out empty categories (except "All" which is always visible)
    return allFilters.filter((f) => f.key === 'all' || f.count > 0);
  }, [offers]);

  // Reset filter to 'all' if current selection becomes empty
  useEffect(() => {
    const currentFilterExists = filterOptions.some((f) => f.key === itemFilter);
    if (!currentFilterExists && itemFilter !== 'all') {
      setItemFilter('all');
    }
  }, [filterOptions, itemFilter]);

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
      <div className="store-page">
        {/* Compact Header */}
        <header className="store-header">
          <StoreToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            itemFilter={itemFilter}
            onItemFilterChange={setItemFilter}
            priceFilter={priceFilter}
            onPriceFilterChange={setPriceFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterOptions={filterOptions}
            totalCount={visibleOffers.length}
          />

          <div className="store-header__actions">
            {isGuest ? (
              <Button size="small" onClick={() => navigate('/login')}>
                Log in
              </Button>
            ) : (
              <>
                <WalletDropdown
                  balances={wallet}
                  loading={loading}
                  onBuyCredits={() => setShowTopUpModal(true)}
                />
                <Button
                  size="small"
                  variant="primary"
                  onClick={() => setShowTopUpModal(true)}
                  className="store-buy-btn"
                >
                  + Buy
                </Button>
                <button
                  className="store-cart-trigger"
                  onClick={() => setCartOpen(true)}
                  aria-label={`Shopping cart with ${cart.length} items`}
                >
                  <span className="store-cart-trigger__icon">🛒</span>
                  {cart.length > 0 && (
                    <span className="store-cart-trigger__badge">{cart.length}</span>
                  )}
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Content - Full Width Grid */}
        <main className="store-content">
          {loading ? (
            <div className="store-loading">
              <span className="store-loading__spinner" />
              Loading catalog...
            </div>
          ) : visibleOffers.length === 0 ? (
            <div className="store-empty">
              <span className="store-empty__icon">🔍</span>
              <p className="store-empty__title">No results found</p>
              <p className="store-empty__hint">
                Try adjusting your search or filters
              </p>
              {searchTerm && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setSearchTerm('')}
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="store-grid">
              {visibleOffers.map((offer) => (
                <StoreOfferCard
                  key={offer.id}
                  offer={offer}
                  onAddToCart={offer.source === 'marketplace' ? undefined : handleAddToCart}
                  onOpen={handleOpen}
                  onDownloadFree={offer.source === 'marketplace' ? handleDownloadFree : undefined}
                  actionLoading={actionLoadingId === offer.id}
                />
              ))}
            </div>
          )}
        </main>

        {/* Top Up Modal */}
        {showTopUpModal && (
          <TopUpModal
            onPurchase={handleTopUpPurchase}
            onClose={() => setShowTopUpModal(false)}
          />
        )}

        {/* Cart Slideout */}
        <CartSlideout
          isOpen={cartOpen}
          items={cartItemsWithDetails}
          totals={cartTotals}
          onClose={() => setCartOpen(false)}
          onRemove={handleRemoveFromCart}
          onClear={handleClearCart}
          onCheckout={handleCheckout}
          loading={cartLoading}
        />
      </div>
    </Layout>
  );
}

function isNew(createdAt?: number): boolean {
  if (!createdAt) return false;
  const WEEK = 1000 * 60 * 60 * 24 * 7;
  return Date.now() - createdAt < WEEK;
}
