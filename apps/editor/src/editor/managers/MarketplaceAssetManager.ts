/**
 * MarketplaceAssetManager - Manages purchased assets from marketplace
 * 
 * Features:
 * - Cache purchased assets in IndexedDB
 * - Purchase assets via marketplace API
 * - Load and provide assets for AssetPalette
 * - Integration with EconomyApiClient for payments
 */

import { MarketplaceApiClient } from '../../utils/marketplaceApi';
import { EconomyApiClient} from '@engine/economy';
import { Logger } from '../../utils/logger';

export interface PurchasedAsset {
  itemId: string;
  type: 'build' | 'avatar';
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl: string;
  tags: string[];
  purchasedAt: number;
  price?: { currency: string; amount: number };
}

/**
 * Manages purchased marketplace assets
 */
export class MarketplaceAssetManager {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'ugc-editor-marketplace-assets';
  private readonly storeName = 'assets';
  private readonly version = 1;
  private readonly marketplaceClient: MarketplaceApiClient;
  private readonly economyClient: EconomyApiClient;
  private readonly storageReady: Promise<void>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.marketplaceClient = new MarketplaceApiClient({
      baseUrl: '/api',
      getAuthToken: () => localStorage.getItem('forge_token') || null,
    });
    this.economyClient = new EconomyApiClient({
      baseUrl: '/api',
      getAuthToken: () => localStorage.getItem('forge_token') || null,
    });
    this.storageReady = this.initialize();
  }

  /**
   * Initialize IndexedDB storage
   */
  private async initialize(): Promise<void> {
    if (this.db || typeof indexedDB === 'undefined') return;

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.version);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'itemId' });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('purchasedAt', 'purchasedAt', { unique: false });
          }
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Wait for storage to be ready
   */
  private async ensureReady(): Promise<void> {
    await this.storageReady;
  }

  /**
   * Purchase an asset from marketplace
   */
  async purchaseAsset(itemId: string): Promise<PurchasedAsset> {
    await this.ensureReady();

    // Check if already purchased
    const existing = await this.getAsset(itemId);
    if (existing) {
      Logger.debug(`Asset ${itemId} already purchased`);
      return existing;
    }

    // Get item details
    const item = await this.marketplaceClient.getItem(itemId);

    // Check if free or paid
    if (item.price && item.price.amount > 0) {
      // Check wallet balance
      const wallet = await this.economyClient.getWallet();
      const currency = item.price.currency;
      const balance = wallet.balances?.find(b => b.currency === currency)?.balance ?? 0;

      if (balance < item.price.amount) {
        throw new Error(`Insufficient balance. Required: ${item.price.amount} ${currency}, Available: ${balance} ${currency}`);
      }

      // Purchase via marketplace API
      await this.marketplaceClient.purchaseItem(itemId);
    } else {
      // Free item - just download
      await this.marketplaceClient.downloadFreeItem(itemId);
    }

    // Save to cache
    const purchasedAsset: PurchasedAsset = {
      itemId: item.id,
      type: item.type,
      title: item.title,
      fileUrl: item.fileUrl,
      tags: item.tags,
      purchasedAt: Date.now(),
    };

    if (item.description !== undefined) {
      purchasedAsset.description = item.description;
    }

    if (item.thumbnailUrl !== undefined) {
      purchasedAsset.thumbnailUrl = item.thumbnailUrl;
    }

    if (item.price) {
      purchasedAsset.price = item.price;
    }

    await this.saveAsset(purchasedAsset);
    this.notifyListeners();

    Logger.debug(`Purchased asset: ${item.title} (${itemId})`);
    return purchasedAsset;
  }

  /**
   * Get a purchased asset by ID
   */
  async getAsset(itemId: string): Promise<PurchasedAsset | null> {
    await this.ensureReady();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.get(itemId);

        request.onsuccess = () => {
          resolve((request.result as PurchasedAsset | undefined) ?? null);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Check if asset is purchased
   */
  async hasAsset(itemId: string): Promise<boolean> {
    const asset = await this.getAsset(itemId);
    return asset !== null;
  }

  /**
   * List all purchased assets
   */
  async listAssets(options?: { type?: 'build' | 'avatar' }): Promise<PurchasedAsset[]> {
    await this.ensureReady();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const targetType = options?.type;
        const index = targetType ? store.index('type') : null;
        const request = index ? index.openCursor(IDBKeyRange.only(targetType)) : store.openCursor(null, 'prev');

        const results: PurchasedAsset[] = [];
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            results.push(cursor.value as PurchasedAsset);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Save asset to IndexedDB
   */
  private async saveAsset(asset: PurchasedAsset): Promise<void> {
    await this.ensureReady();
    if (!this.db) throw new Error('MarketplaceAssetManager not initialized');

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.put(asset);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Remove asset from cache (for testing/cleanup)
   */
  async removeAsset(itemId: string): Promise<void> {
    await this.ensureReady();
    if (!this.db) throw new Error('MarketplaceAssetManager not initialized');

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.delete(itemId);

        request.onsuccess = () => {
          this.notifyListeners();
          resolve();
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Add change listener
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get marketplace client (for external use)
   */
  getMarketplaceClient(): MarketplaceApiClient {
    return this.marketplaceClient;
  }

  /**
   * Get economy client (for external use)
   */
  getEconomyClient(): EconomyApiClient {
    return this.economyClient;
  }
}

