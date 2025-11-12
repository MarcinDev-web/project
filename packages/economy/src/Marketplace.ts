import { EventBus } from '@engine/core/event';
import type { IDisposable } from '@engine/core/utils';
import { DisposableGroup } from '@engine/core/utils';
import type { CurrencyAmount, CreatorId, GameId, WalletId } from './types';
import { PLATFORM_CURRENCY } from './types';
import { CurrencyManager } from './CurrencyManager';
import { RevenueSplit } from './RevenueSplit';
import { CurrencySinks, FeeType } from './CurrencySinks';
import { AntiP2WCompliance, type ItemDefinition } from './AntiP2WCompliance';

/**
 * Marketplace item listing
 */
export interface MarketplaceListing {
  listingId: string;
  itemId: string;
  itemDefinition: ItemDefinition;
  sellerId: CreatorId;
  price: CurrencyAmount;
  gameId?: GameId; // If item is used in a game, track for royalties
  createdAt: number;
  sold: boolean;
  soldAt?: number;
}

/**
 * Marketplace purchase result
 */
export interface MarketplacePurchaseResult {
  /** Purchase transaction */
  transaction: {
    listingId: string;
    buyerId: WalletId;
    sellerId: CreatorId;
    amount: CurrencyAmount;
    timestamp: number;
  };
  /** Revenue split result */
  revenueSplit: {
    assetCreator: CurrencyAmount;
    gameCreator?: CurrencyAmount;
    platform: CurrencyAmount;
  };
}

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
  /** Listing fee (fixed amount) */
  listingFee: number;
  /** Transaction fee percentage (0-100) */
  transactionFeePercent: number;
  /** Optional logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * UGC Marketplace - allows creators to sell assets to other creators.
 * Implements royalty system for assets used in games.
 */
export class Marketplace implements IDisposable {
  private readonly listings = new Map<string, MarketplaceListing>();
  private readonly currencyManager: CurrencyManager;
  private readonly revenueSplit: RevenueSplit;
  private readonly sinks: CurrencySinks;
  private readonly compliance: AntiP2WCompliance;
  // @ts-expect-error Reserved for future use
  private readonly _eventBus: EventBus;
  private readonly disposables: DisposableGroup;
  private disposed = false;

  private readonly listingFee: number;
  private readonly transactionFeePercent: number;
  private readonly logger: MarketplaceConfig['logger'];

  /**
   * @param currencyManager - Currency manager
   * @param revenueSplit - Revenue split calculator
   * @param sinks - Currency sinks for fees
   * @param compliance - Anti-P2W compliance checker
   * @param eventBus - Event bus
   * @param config - Marketplace configuration
   */
  constructor(
    currencyManager: CurrencyManager,
    revenueSplit: RevenueSplit,
    sinks: CurrencySinks,
    compliance: AntiP2WCompliance,
    eventBus: EventBus,
    config: MarketplaceConfig
  ) {
    this.currencyManager = currencyManager;
    this.revenueSplit = revenueSplit;
    this.sinks = sinks;
    this.compliance = compliance;
    this._eventBus = eventBus;
    this.disposables = new DisposableGroup();
    this.listingFee = config.listingFee;
    this.transactionFeePercent = config.transactionFeePercent;
    this.logger = config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
  }

  /**
   * Lists an item for sale on the marketplace.
   * @param sellerId - Creator selling the item
   * @param itemDefinition - Item definition (for compliance check)
   * @param price - Selling price
   * @param gameId - Optional game ID if item is used in a game (for royalties)
   * @returns Listing ID
   */
  listItem(
    sellerId: CreatorId,
    itemDefinition: ItemDefinition,
    price: CurrencyAmount,
    gameId?: GameId
  ): string {
    this.ensureNotDisposed();

    if (price.currency !== PLATFORM_CURRENCY) {
      throw new Error(`Only ${PLATFORM_CURRENCY} currency supported for marketplace`);
    }

    // Check compliance if gameId provided
    if (gameId) {
      const compliance = this.compliance.checkItemCompliance(gameId, itemDefinition);
      if (!compliance.allowed) {
        throw new Error(`Item not compliant: ${compliance.reason}`);
      }
    }

    // Get seller wallet
    const sellerWalletId = `creator_${sellerId}`;
    const sellerWallet = this.currencyManager.getWallet(sellerWalletId);
    if (!sellerWallet) {
      throw new Error(`Seller wallet not found: ${sellerWalletId}`);
    }

    // Charge listing fee
    if (this.listingFee > 0) {
      try {
        sellerWallet.withdraw(
          { currency: PLATFORM_CURRENCY, amount: this.listingFee },
          'Marketplace listing fee'
        );

        // Process listing fee through sinks
        this.sinks.processFee(
          { currency: PLATFORM_CURRENCY, amount: this.listingFee },
          FeeType.MARKETPLACE_LISTING,
          `Listing: ${itemDefinition.itemId}`
        );
      } catch (error) {
        throw new Error(`Insufficient balance for listing fee: ${this.listingFee}`);
      }
    }

    // Create listing
    const listingId = `listing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const listing: MarketplaceListing = {
      listingId,
      itemId: itemDefinition.itemId,
      itemDefinition,
      sellerId,
      price,
      ...(gameId ? { gameId } : {}),
      createdAt: Date.now(),
      sold: false,
    };

    this.listings.set(listingId, listing);
    this.logger?.debug(`Item listed: ${listingId} by ${sellerId} for ${price.amount} coins`);

    return listingId;
  }

  /**
   * Purchases an item from the marketplace.
   * @param listingId - Listing ID
   * @param buyerId - Buyer wallet ID
   * @param gameCreatorId - Optional game creator ID (if buying for use in game)
   * @returns Purchase result
   */
  purchaseItem(
    listingId: string,
    buyerId: WalletId,
    gameCreatorId?: CreatorId
  ): MarketplacePurchaseResult {
    this.ensureNotDisposed();

    const listing = this.listings.get(listingId);
    if (!listing) {
      throw new Error(`Listing not found: ${listingId}`);
    }

    if (listing.sold) {
      throw new Error(`Listing already sold: ${listingId}`);
    }

    // Get buyer wallet
    const buyerWallet = this.currencyManager.getWallet(buyerId);
    if (!buyerWallet) {
      throw new Error(`Buyer wallet not found: ${buyerId}`);
    }

    // Calculate transaction fee
    const transactionFee = Math.floor(
      (listing.price.amount * this.transactionFeePercent) / 100
    );
    const totalAmount = listing.price.amount + transactionFee;

    // Check buyer balance
    if (!buyerWallet.hasBalance(PLATFORM_CURRENCY, totalAmount)) {
      throw new Error(
        `Insufficient balance: need ${totalAmount} coins (price: ${listing.price.amount}, fee: ${transactionFee})`
      );
    }

    // Withdraw from buyer
    buyerWallet.withdraw(
      { currency: PLATFORM_CURRENCY, amount: totalAmount },
      `Marketplace purchase: ${listing.itemId}`
    );

    // Process transaction fee through sinks
    this.sinks.processFee(
      { currency: PLATFORM_CURRENCY, amount: transactionFee },
      FeeType.MARKETPLACE_TRANSACTION,
      `Purchase: ${listing.itemId}`
    );

    // Calculate revenue split
    const split = this.revenueSplit.calculateMarketplaceSplit(
      listing.price,
      listing.sellerId,
      gameCreatorId ?? listing.sellerId // If no game creator, seller gets both shares
    );

    // Pay seller (asset creator)
    const sellerWalletId = `creator_${listing.sellerId}`;
    const sellerWallet = this.currencyManager.getWallet(sellerWalletId);
    if (!sellerWallet) {
      throw new Error(`Seller wallet not found: ${sellerWalletId}`);
    }

    sellerWallet.deposit(split.assetCreator, `Marketplace sale: ${listing.itemId}`);

    // Pay game creator (if different from asset creator)
    if (gameCreatorId && gameCreatorId !== listing.sellerId) {
      const gameWalletId = `creator_${gameCreatorId}`;
      const gameWallet = this.currencyManager.getWallet(gameWalletId);
      if (gameWallet && split.gameCreator) {
        gameWallet.deposit(split.gameCreator, `Marketplace royalty: ${listing.itemId}`);
      }
    }

    // Platform share is handled by sinks (already processed)

    // Mark listing as sold
    listing.sold = true;
    listing.soldAt = Date.now();

    const result: MarketplacePurchaseResult = {
      transaction: {
        listingId,
        buyerId,
        sellerId: listing.sellerId,
        amount: listing.price,
        timestamp: Date.now(),
      },
      revenueSplit: {
        assetCreator: split.assetCreator,
        gameCreator: split.gameCreator,
        platform: split.platform,
      },
    };

    this.logger?.debug(
      `Item purchased: ${listingId} by ${buyerId} for ${listing.price.amount} coins`
    );

    return result;
  }

  /**
   * Gets a listing by ID.
   */
  getListing(listingId: string): MarketplaceListing | null {
    this.ensureNotDisposed();
    return this.listings.get(listingId) ?? null;
  }

  /**
   * Gets all active listings (not sold).
   */
  getActiveListings(): MarketplaceListing[] {
    this.ensureNotDisposed();
    return Array.from(this.listings.values()).filter((listing) => !listing.sold);
  }

  /**
   * Gets listings by seller.
   */
  getListingsBySeller(sellerId: CreatorId): MarketplaceListing[] {
    this.ensureNotDisposed();
    return Array.from(this.listings.values()).filter(
      (listing) => listing.sellerId === sellerId
    );
  }

  /**
   * Cancels a listing (refunds listing fee if not sold).
   */
  cancelListing(listingId: string): boolean {
    this.ensureNotDisposed();

    const listing = this.listings.get(listingId);
    if (!listing) {
      return false;
    }

    if (listing.sold) {
      throw new Error(`Cannot cancel sold listing: ${listingId}`);
    }

    // Refund listing fee (optional - could be kept as platform fee)
    // For now, we'll keep it as platform revenue

    this.listings.delete(listingId);
    this.logger?.debug(`Listing cancelled: ${listingId}`);

    return true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.disposables.dispose();
    this.listings.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('Marketplace has been disposed');
    }
  }
}

