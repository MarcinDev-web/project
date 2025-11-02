/**
 * Shop API calls
 */

import { apiClient } from './client';

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description?: string;
  category: 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
  price: CurrencyAmount;
  imageUrl?: string;
  available: boolean;
  stock?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  type: 'material' | 'model' | 'texture' | 'script';
  category?: string;
  price: CurrencyAmount;
  previewUrl?: string;
  fileUrl: string;
  metadata: Record<string, unknown>;
  authorId: string;
  available: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CartItem {
  itemId: string;
  type: 'shop-item' | 'asset' | 'marketplace-item';
  quantity: number;
}

export interface PurchaseItem {
  itemId: string;
  type: 'shop-item' | 'asset' | 'marketplace-item';
  name: string;
  price: CurrencyAmount;
}

export interface Purchase {
  id: string;
  userId: string;
  items: PurchaseItem[];
  totalCost: CurrencyAmount;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
}

export interface ShopResponse {
  items: ShopItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AssetResponse {
  items: Asset[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Cart {
  items: CartItem[];
}

export interface OwnedItem {
  itemId: string;
  itemType: 'shop-item' | 'asset' | 'marketplace-item';
  purchasedAt: number;
}

export interface OwnedItems {
  items: OwnedItem[];
}

export interface WalletBalance {
  currency: string;
  balance: number;
}

export interface Wallet {
  balances: WalletBalance[];
}

export const shopApi = {
  async getItems(options?: {
    category?: ShopItem['category'];
    currency?: string;
    available?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<ShopResponse> {
    const params = new URLSearchParams();
    if (options?.category) {
      params.append('category', options.category);
    }
    if (options?.currency) {
      params.append('currency', options.currency);
    }
    if (options?.available !== undefined) {
      params.append('available', String(options.available));
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }
    if (options?.search) {
      params.append('search', options.search);
    }

    const query = params.toString();
    return apiClient.get<ShopResponse>(`/shop/items${query ? `?${query}` : ''}`);
  },

  async getItem(id: string): Promise<ShopItem> {
    return apiClient.get<ShopItem>(`/shop/items/${id}`);
  },

  async getAssets(options?: {
    type?: Asset['type'];
    category?: string;
    authorId?: string;
    available?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<AssetResponse> {
    const params = new URLSearchParams();
    if (options?.type) {
      params.append('type', options.type);
    }
    if (options?.category) {
      params.append('category', options.category);
    }
    if (options?.authorId) {
      params.append('authorId', options.authorId);
    }
    if (options?.available !== undefined) {
      params.append('available', String(options.available));
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }
    if (options?.search) {
      params.append('search', options.search);
    }

    const query = params.toString();
    return apiClient.get<AssetResponse>(`/shop/assets${query ? `?${query}` : ''}`);
  },

  async getAsset(id: string): Promise<Asset> {
    return apiClient.get<Asset>(`/shop/assets/${id}`);
  },

  async getCart(): Promise<Cart> {
    return apiClient.get<Cart>('/shop/cart');
  },

  async addToCart(item: CartItem): Promise<Cart> {
    return apiClient.post<Cart>('/shop/cart', item);
  },

  async removeFromCart(itemId: string, itemType: CartItem['type']): Promise<Cart> {
    return apiClient.delete<Cart>(`/shop/cart/${itemId}?type=${itemType}`);
  },

  async clearCart(): Promise<Cart> {
    return apiClient.post<Cart>('/shop/cart/clear', {});
  },

  async checkout(): Promise<{ success: boolean; purchaseId?: string; error?: string }> {
    return apiClient.post<{ success: boolean; purchaseId?: string; error?: string }>('/shop/checkout', {});
  },

  async getPurchases(options?: {
    limit?: number;
    offset?: number;
    status?: Purchase['status'];
  }): Promise<{ purchases: Purchase[] }> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }
    if (options?.status) {
      params.append('status', options.status);
    }

    const query = params.toString();
    return apiClient.get<{ purchases: Purchase[] }>(`/shop/purchases${query ? `?${query}` : ''}`);
  },

  async getPurchase(id: string): Promise<Purchase> {
    return apiClient.get<Purchase>(`/shop/purchases/${id}`);
  },

  async getOwned(): Promise<OwnedItems> {
    return apiClient.get<OwnedItems>('/shop/owned');
  },

  async getWallet(): Promise<Wallet> {
    return apiClient.get<Wallet>('/shop/wallet');
  },

  // Admin methods (require admin token)
  async createItem(item: Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShopItem> {
    return apiClient.post<ShopItem>('/shop/items', item);
  },

  async updateItem(id: string, updates: Partial<Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ShopItem> {
    return apiClient.put<ShopItem>(`/shop/items/${id}`, updates);
  },

  async deleteItem(id: string): Promise<void> {
    return apiClient.delete(`/shop/items/${id}`);
  },

  async updateAsset(id: string, updates: Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'authorId'>>): Promise<Asset> {
    return apiClient.put<Asset>(`/shop/assets/${id}`, updates);
  },

  async deleteAsset(id: string): Promise<void> {
    return apiClient.delete(`/shop/assets/${id}`);
  },
};

