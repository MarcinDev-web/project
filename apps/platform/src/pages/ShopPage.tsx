/**
 * Shop Page
 */

import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { ShopItemCard } from '../components/shop/ShopItemCard';
import { ShopAssetCard } from '../components/shop/ShopAssetCard';
import { ShoppingCart } from '../components/shop/ShoppingCart';
import { WalletDisplay } from '../components/shop/WalletDisplay';
import { shopApi, type ShopItem, type Asset, type CartItem, type WalletBalance } from '../api/shop';
import { useAuth } from '../contexts/AuthContext';

const ITEM_FILTERS: Array<{ label: string; value: ShopItem['category'] | 'all' }> = [
  { label: 'All items', value: 'all' },
  { label: 'Consumables', value: 'consumable' },
  { label: 'Cosmetics', value: 'cosmetic' },
  { label: 'Upgrades', value: 'upgrade' },
  { label: 'Collectibles', value: 'collectible' },
];

const ASSET_FILTERS: Array<{ label: string; value: Asset['type'] | 'all' }> = [
  { label: 'All assets', value: 'all' },
  { label: 'Materials', value: 'material' },
  { label: 'Models', value: 'model' },
  { label: 'Textures', value: 'texture' },
  { label: 'Scripts', value: 'script' },
];

type TabType = 'items' | 'assets';

export function ShopPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wallet, setWallet] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActiveFilter('all');
  }, [activeTab]);

  useEffect(() => {
    void loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [itemsResponse, assetsResponse, cartResponse, walletResponse, ownedResponse] = await Promise.all([
        shopApi.getItems({ limit: 50 }),
        shopApi.getAssets({ limit: 50 }),
        shopApi.getCart(),
        shopApi.getWallet(),
        shopApi.getOwned(),
      ]);

      setItems(itemsResponse.items);
      setAssets(assetsResponse.items);
      setCart(cartResponse.items);
      setWallet(walletResponse.balances);

      const ownedSet = new Set<string>();
      for (const item of ownedResponse.items) {
        ownedSet.add(`${item.itemId}:${item.itemType}`);
      }
      setOwnedItems(ownedSet);
    } catch (error) {
      console.error('Failed to load shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (itemId: string, type: CartItem['type']) => {
    if (!user) return;

    setCartLoading(true);
    try {
      await shopApi.addToCart({ itemId, type, quantity: 1 });
      const cartResponse = await shopApi.getCart();
      setCart(cartResponse.items);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setCartLoading(false);
    }
  };

  const handleRemoveFromCart = async (itemId: string, itemType: CartItem['type']) => {
    if (!user) return;

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
    if (!user) return;

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
    if (!user || cart.length === 0) return;

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

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.description?.toLowerCase().includes(query) ?? false);
      const matchesFilter = activeFilter === 'all' || item.category === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, activeFilter]);

  const filteredAssets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesSearch =
        !query ||
        asset.name.toLowerCase().includes(query) ||
        (asset.description?.toLowerCase().includes(query) ?? false);
      const matchesFilter = activeFilter === 'all' || asset.type === activeFilter || asset.category === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [assets, searchTerm, activeFilter]);

  const catalogLookup = useMemo(() => {
    const lookup = new Map<string, { name: string; price: { currency: string; amount: number } }>();
    for (const item of items) {
      lookup.set(`${item.id}:shop-item`, { name: item.name, price: item.price });
    }
    for (const asset of assets) {
      lookup.set(`${asset.id}:asset`, { name: asset.name, price: asset.price });
    }
    return lookup;
  }, [items, assets]);

  const cartItems = useMemo(() => {
    return cart.map((item) => {
      const details = catalogLookup.get(`${item.itemId}:${item.type}`);
      return {
        ...item,
        name: details?.name ?? item.itemId,
        price: details?.price,
      };
    });
  }, [cart, catalogLookup]);

  const cartTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of cartItems) {
      if (!item.price) continue;
      const { currency, amount } = item.price;
      totals.set(currency, (totals.get(currency) ?? 0) + amount * item.quantity);
    }
    return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount }));
  }, [cartItems]);

  if (!user) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Shop</h1>
          <p>Please log in to access the shop.</p>
        </div>
      </Layout>
    );
  }

  const activeFilters = activeTab === 'items' ? ITEM_FILTERS : ASSET_FILTERS;
  const visibleItems = activeTab === 'items' ? filteredItems : filteredAssets;
  const heroStats = [
    { label: 'Virtual items', value: items.length },
    { label: 'Creator assets', value: assets.length },
    { label: 'Owned', value: ownedItems.size },
  ];
  const featuredBalances = wallet.slice(0, 3);

  return (
    <Layout>
      <div className="shop-page">
        <section className="shop-hero">
          <div className="shop-hero__content">
            <p className="shop-eyebrow">Marketplace</p>
            <h1>Forge Shop</h1>
            <p className="shop-hero__subtitle">
              Curated items, assets, and add-ons tailored to your world-building workflow.
            </p>
            <div className="shop-hero__stats">
              {heroStats.map((stat) => (
                <div key={stat.label} className="shop-hero__stat">
                  <span className="shop-hero__stat-value">{stat.value}</span>
                  <span className="shop-hero__stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="shop-hero__panel">
            <div className="shop-hero__panel-header">
              <p className="shop-eyebrow">Wallet snapshot</p>
              <span className="shop-pill">Synced</span>
            </div>
            <div className="shop-hero__balances">
              {featuredBalances.length === 0 && <span className="shop-muted">No funds available.</span>}
              {featuredBalances.map((balance) => (
                <div key={balance.currency} className="shop-hero__balance">
                  <span className="shop-hero__balance-label">{balance.currency}</span>
                  <span className="shop-hero__balance-value">{balance.balance}</span>
                </div>
              ))}
            </div>
            <div className="shop-hero__hint">
              Instant fulfillment, secure checkout, unified pricing for your team.
            </div>
          </div>
        </section>

        <div className="shop-toolbar">
          <div className="shop-search">
            <input
              type="search"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="shop-tabs">
            <button
              onClick={() => setActiveTab('items')}
              className={`shop-tab-button ${activeTab === 'items' ? 'active' : ''}`}
            >
              Virtual Items ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('assets')}
              className={`shop-tab-button ${activeTab === 'assets' ? 'active' : ''}`}
            >
              Assets ({assets.length})
            </button>
          </div>
        </div>

        <div className="shop-filters">
          {activeFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={`shop-filter-chip ${activeFilter === filter.value ? 'active' : ''}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="shop-content-wrapper">
          <div className="shop-main-content">
            <div className="shop-grid-header">
              <div>
                <p className="shop-kicker">{activeTab === 'items' ? 'Virtual items' : 'Creator assets'}</p>
                <h2 className="shop-section-title">
                  {activeTab === 'items' ? 'Equip your worlds' : 'Expand your creator toolkit'}
                </h2>
                <p className="shop-section-subtitle">
                  {activeTab === 'items'
                    ? 'Skins, boosts, and collectibles ready to drop in.'
                    : 'Materials, models, and scripts for fast production.'}
                </p>
              </div>
              <span className="shop-pill neutral">{visibleItems.length} results</span>
            </div>

            {loading ? (
              <div className="shop-loading">
                Loading shop content...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="shop-empty-state">
                <p>No results for the current filters.</p>
                <p className="shop-muted">Try adjusting the search or category.</p>
              </div>
            ) : (
              <div className="shop-items-grid">
                {activeTab === 'items'
                  ? visibleItems.map((item) => (
                      <ShopItemCard
                        key={item.id}
                        item={item}
                        owned={ownedItems.has(`${item.id}:shop-item`)}
                        onAddToCart={() => handleAddToCart(item.id, 'shop-item')}
                      />
                    ))
                  : visibleItems.map((asset) => (
                      <ShopAssetCard
                        key={asset.id}
                        asset={asset}
                        owned={ownedItems.has(`${asset.id}:asset`)}
                        onAddToCart={() => handleAddToCart(asset.id, 'asset')}
                      />
                    ))}
              </div>
            )}
          </div>

          <div className="shop-sidebar">
            <WalletDisplay balances={wallet} loading={loading} />
            <div className="shop-sidebar-card">
              <ShoppingCart
                items={cartItems}
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

