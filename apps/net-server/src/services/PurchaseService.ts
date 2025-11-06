/**
 * Purchase Service - Handles purchase logic and checkout
 */

import type { CurrencyService } from './CurrencyService.js';
import type { CurrencyAmount } from '@engine/economy';
import type { ShopItem } from '../storage/ShopStorage.js';
import type { Asset } from '../storage/AssetStorage.js';
import type { PurchaseItem, PurchaseItemType } from '../storage/PurchaseStorage.js';
import type { MarketplaceItem } from '../storage/MarketplaceStorage.js';

export interface CartItem {
  itemId: string;
  type: PurchaseItemType;
  quantity: number;
}

export interface CheckoutRequest {
  items: CartItem[];
}

export interface CheckoutResult {
  success: boolean;
  purchaseId?: string;
  error?: string;
}

interface IShopStorage {
  getItem(id: string): Promise<ShopItem | null>;
  updateItem(
    id: string,
    updates: Partial<Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ShopItem | null>;
}

interface IAssetStorage {
  getAsset(id: string): Promise<Asset | null>;
}

interface IPurchaseStorage {
  isOwned(userId: string, itemId: string, itemType: PurchaseItemType): Promise<boolean>;
  createPurchase(purchase: {
    userId: string;
    items: PurchaseItem[];
    totalCost: CurrencyAmount;
    status: 'pending';
  }): Promise<{
    id: string;
    userId: string;
    items: PurchaseItem[];
    totalCost: CurrencyAmount;
    status: string;
    createdAt: number;
  }>;
  updatePurchaseStatus(id: string, status: 'completed' | 'failed'): Promise<{ id: string } | null>;
}

interface IMarketplaceStorage {
  getItem(id: string): Promise<MarketplaceItem | null>;
}

export class PurchaseService {
  private readonly priceMultiplier: number;
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly shopStorage: IShopStorage,
    private readonly assetStorage: IAssetStorage,
    private readonly purchaseStorage: IPurchaseStorage,
    private readonly marketplaceStorage: IMarketplaceStorage
  ) {
    const m = parseFloat(String(process.env.ECONOMY_PRICE_MULTIPLIER ?? '1'));
    this.priceMultiplier = Number.isFinite(m) && m > 0 ? m : 1;
  }

  /**
   * Calculate total cost for cart items
   */
  async calculateTotal(
    userId: string,
    items: CartItem[],
    overrideMultiplier?: number
  ): Promise<{ total: CurrencyAmount | null; errors: string[] }> {
    const errors: string[] = [];
    const totals = new Map<string, number>();

    for (const cartItem of items) {
      let item: ShopItem | Asset | MarketplaceItem | null = null;
      let price: CurrencyAmount | null = null;

      if (cartItem.type === 'shop-item') {
        item = await this.shopStorage.getItem(cartItem.itemId);
        if (item) {
          price = item.price;
        }
      } else if (cartItem.type === 'asset') {
        item = await this.assetStorage.getAsset(cartItem.itemId);
        if (item) {
          price = item.price;
        }
      } else if (cartItem.type === 'marketplace-item') {
        item = await this.marketplaceStorage.getItem(cartItem.itemId);
        if (item && 'price' in item && item.price) {
          price = item.price;
        }
      }

      if (!item) {
        errors.push(`Item ${cartItem.itemId} (${cartItem.type}) not found`);
        continue;
      }

      if (!price) {
        errors.push(`Item ${cartItem.itemId} has no price`);
        continue;
      }

      // Check availability based on item type
      if (cartItem.type === 'shop-item') {
        const shopItem = item as ShopItem;
        if (!shopItem.available || shopItem.stock === 0) {
          errors.push(`Item ${cartItem.itemId} is not available`);
          continue;
        }
      } else if (cartItem.type === 'asset') {
        const asset = item as Asset;
        if (!asset.available) {
          errors.push(`Item ${cartItem.itemId} is not available`);
          continue;
        }
      } else if (cartItem.type === 'marketplace-item') {
        const marketplaceItem = item as MarketplaceItem;
        if (!marketplaceItem.public) {
          errors.push(`Item ${cartItem.itemId} is not available`);
          continue;
        }
      }

      // Check stock for shop items
      if (cartItem.type === 'shop-item') {
        const shopItem = item as ShopItem;
        if (shopItem.stock !== undefined && shopItem.stock < cartItem.quantity) {
          errors.push(`Insufficient stock for ${shopItem.name}`);
          continue;
        }
      }

      // Check ownership
      const isOwned = await this.purchaseStorage.isOwned(userId, cartItem.itemId, cartItem.type);
      if (isOwned) {
        errors.push(
          `You already own ${(item as ShopItem).name || (item as Asset).name || (item as MarketplaceItem).title}`
        );
        continue;
      }

      const currentTotal = totals.get(price.currency) ?? 0;
      const multiplier =
        Number.isFinite(overrideMultiplier) && (overrideMultiplier as number) > 0
          ? (overrideMultiplier as number)
          : this.priceMultiplier;
      const adjusted = Math.max(0, price.amount * multiplier);
      totals.set(price.currency, currentTotal + adjusted * cartItem.quantity);
    }

    if (errors.length > 0 || totals.size === 0) {
      return { total: null, errors };
    }

    // For now, we only support single currency purchases
    // In future, we could support multi-currency or exchange
    if (totals.size > 1) {
      return {
        total: null,
        errors: ['Cannot purchase items with different currencies in one transaction'],
      };
    }

    const [currency, amount] = Array.from(totals.entries())[0]!;
    return {
      total: { currency, amount },
      errors,
    };
  }

  /**
   * Process checkout
   */
  async checkout(
    userId: string,
    request: CheckoutRequest,
    overrideMultiplier?: number
  ): Promise<CheckoutResult> {
    // Validate cart
    const { total, errors } = await this.calculateTotal(userId, request.items, overrideMultiplier);

    if (!total || errors.length > 0) {
      return {
        success: false,
        error: errors.join('; '),
      };
    }

    // Check balance
    if (!this.currencyService.hasBalance(userId, total)) {
      return {
        success: false,
        error: `Insufficient balance. Required: ${total.amount} ${total.currency}`,
      };
    }

    // Build purchase items
    const purchaseItems: PurchaseItem[] = [];
    for (const cartItem of request.items) {
      let item: ShopItem | Asset | MarketplaceItem | null = null;
      let price: CurrencyAmount | null = null;
      let name: string = '';

      if (cartItem.type === 'shop-item') {
        item = await this.shopStorage.getItem(cartItem.itemId);
        if (item) {
          price = item.price;
          name = item.name;
        }
      } else if (cartItem.type === 'asset') {
        item = await this.assetStorage.getAsset(cartItem.itemId);
        if (item) {
          price = item.price;
          name = item.name;
        }
      } else if (cartItem.type === 'marketplace-item') {
        item = await this.marketplaceStorage.getItem(cartItem.itemId);
        if (item) {
          if ('price' in item && item.price) {
            price = item.price;
          }
          name = item.title;
        }
      }

      if (!item || !price) {
        return {
          success: false,
          error: `Invalid item: ${cartItem.itemId}`,
        };
      }

      for (let i = 0; i < cartItem.quantity; i++) {
        purchaseItems.push({
          itemId: cartItem.itemId,
          type: cartItem.type,
          name,
          price,
        });
      }

      // Update stock for shop items
      if (cartItem.type === 'shop-item') {
        const shopItem = item as ShopItem;
        if (shopItem.stock !== undefined) {
          await this.shopStorage.updateItem(cartItem.itemId, {
            stock: shopItem.stock - cartItem.quantity,
          });
        }
      }
    }

    // Withdraw currency first (before creating purchase record)
    try {
      this.currencyService.withdraw(userId, total, `Purchase transaction`);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Insufficient balance',
      };
    }

    // Create purchase record
    try {
      const purchase = await this.purchaseStorage.createPurchase({
        userId,
        items: purchaseItems,
        totalCost: total,
        status: 'pending',
      });

      // Mark purchase as completed
      await this.purchaseStorage.updatePurchaseStatus(purchase.id, 'completed');

      // Creator royalty payout for marketplace items (10% MVP)
      try {
        for (const pItem of purchase.items) {
          if (pItem.type === 'marketplace-item') {
            const mpItem = await this.marketplaceStorage.getItem(pItem.itemId);
            if (mpItem && mpItem.authorId) {
              const royaltyAmount = Math.max(0, Math.round(pItem.price.amount * 0.1 * 100) / 100);
              if (royaltyAmount > 0) {
                const payout: CurrencyAmount = {
                  currency: pItem.price.currency,
                  amount: royaltyAmount,
                };
                this.currencyService.deposit(
                  mpItem.authorId,
                  payout,
                  `Royalty payout for ${pItem.name}`
                );
              }
            }
          }
        }
      } catch (e) {
        console.warn('Royalty payout failed:', e);
      }

      return {
        success: true,
        purchaseId: purchase.id,
      };
    } catch (error) {
      // Refund currency if purchase creation fails
      try {
        this.currencyService.deposit(userId, total, 'Refund: Purchase failed');
      } catch (refundError) {
        console.error('Failed to refund after purchase failure:', refundError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase creation failed',
      };
    }
  }
}

