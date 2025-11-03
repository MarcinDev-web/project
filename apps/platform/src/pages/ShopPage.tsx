/**
 * Shop Page
 */

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { ShopItemCard } from '../components/shop/ShopItemCard';
import { ShopAssetCard } from '../components/shop/ShopAssetCard';
import { ShoppingCart } from '../components/shop/ShoppingCart';
import { WalletDisplay } from '../components/shop/WalletDisplay';
import { shopApi, type ShopItem, type Asset, type CartItem, type WalletBalance } from '../api/shop';
import { useAuth } from '../contexts/AuthContext';

type TabType = 'items' | 'assets' | 'marketplace';

export function ShopPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wallet, setWallet] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadData();
  }, [activeTab, user]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load items/assets based on active tab
      if (activeTab === 'items') {
        const response = await shopApi.getItems({ limit: 50 });
        setItems(response.items);
      } else if (activeTab === 'assets') {
        const response = await shopApi.getAssets({ limit: 50 });
        setAssets(response.items);
      }

      // Load cart
      const cartResponse = await shopApi.getCart();
      setCart(cartResponse.items);

      // Load wallet
      const walletResponse = await shopApi.getWallet();
      setWallet(walletResponse.balances);

      // Load owned items
      const ownedResponse = await shopApi.getOwned();
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

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;

    setCartLoading(true);
    try {
      const result = await shopApi.checkout();
      if (result.success) {
        // Reload data after successful checkout
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

  const calculateTotal = (): { currency: string; amount: number } | undefined => {
    // Simple calculation - in production, use API endpoint
    if (cart.length === 0) return undefined;
    
    // Note: This is a simplified calculation
    // In production, calculate total via API
    return { currency: 'coins', amount: 0 };
  };

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

  const cartItems = cart.map(item => ({
    ...item,
    name: item.itemId, // Would need to fetch item names
  }));
  const cartTotal = calculateTotal();

  return (
    <Layout>
      <div className="shop-page">
        <h1>Shop</h1>

        <div className="shop-content-wrapper">
          <div className="shop-main-content">
            {/* Tabs */}
            <div className="shop-tabs">
              <button
                onClick={() => setActiveTab('items')}
                className={`shop-tab-button ${activeTab === 'items' ? 'active' : ''}`}
              >
                Virtual Items
              </button>
              <button
                onClick={() => setActiveTab('assets')}
                className={`shop-tab-button ${activeTab === 'assets' ? 'active' : ''}`}
              >
                Assets
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="shop-loading">
                Loading...
              </div>
            ) : (
              <>
                {activeTab === 'items' && items.length === 0 ? (
                  <div className="shop-empty-state">
                    <p>No virtual items available at the moment.</p>
                  </div>
                ) : (
                  <div className="shop-items-grid">
                    {activeTab === 'items' && items.map((item) => (
                      <ShopItemCard
                        key={item.id}
                        item={item}
                        owned={ownedItems.has(`${item.id}:shop-item`)}
                        onAddToCart={() => handleAddToCart(item.id, 'shop-item')}
                      />
                    ))}
                  </div>
                )}
                {activeTab === 'assets' && assets.length === 0 ? (
                  <div className="shop-empty-state">
                    <p>No assets available at the moment.</p>
                  </div>
                ) : (
                  <div className="shop-items-grid">
                    {activeTab === 'assets' && assets.map((asset) => (
                      <ShopAssetCard
                        key={asset.id}
                        asset={asset}
                        owned={ownedItems.has(`${asset.id}:asset`)}
                        onAddToCart={() => handleAddToCart(asset.id, 'asset')}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="shop-sidebar">
            <WalletDisplay balances={wallet} loading={loading} />
            <div style={{ marginTop: '1rem' }}>
              <ShoppingCart
                items={cartItems}
                {...(cartTotal ? { total: cartTotal } : {})}
                onRemove={handleRemoveFromCart}
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

