import { EventBus } from '@engine/core/event';
import type { IDisposable } from '@engine/core/utils';
import { DisposableGroup } from '@engine/core/utils';
import type { CurrencyAmount, CreatorId, GameId, WalletId } from './types';
import { PLATFORM_CURRENCY, ItemCategory } from './types';
import { CurrencyManager } from './CurrencyManager';
import { RevenueSplit } from './RevenueSplit';
import { CurrencySinks, FeeType } from './CurrencySinks';
import { AntiP2WCompliance, type ItemDefinition } from './AntiP2WCompliance';

/**
 * In-game shop item
 */
export interface ShopItem {
  itemId: string;
  itemDefinition: ItemDefinition;
  price: CurrencyAmount;
  available: boolean;
  /** Optional limited quantity */
  quantity?: number;
  /** Optional purchase limit per player */
  purchaseLimit?: number;
}

/**
 * Season pass tier
 */
export interface SeasonPassTier {
  tierId: string;
  tierNumber: number;
  /** Rewards for this tier */
  rewards: ShopItem[];
  /** Required XP/points to unlock */
  requiredPoints: number;
}

/**
 * Season pass configuration
 */
export interface SeasonPass {
  passId: string;
  gameId: GameId;
  creatorId: CreatorId;
  name: string;
  description?: string;
  /** Free tier rewards */
  freeTiers: SeasonPassTier[];
  /** Premium tier rewards (requires purchase) */
  premiumTiers: SeasonPassTier[];
  /** Premium pass price */
  premiumPrice: CurrencyAmount;
  /** Season start timestamp */
  startTime: number;
  /** Season end timestamp */
  endTime: number;
  active: boolean;
}

/**
 * Game pass (subscription-like access)
 */
export interface GamePass {
  passId: string;
  gameId: GameId;
  creatorId: CreatorId;
  name: string;
  description?: string;
  /** Monthly price */
  monthlyPrice: CurrencyAmount;
  /** Benefits description */
  benefits: string[];
  active: boolean;
}

/**
 * Purchase result
 */
export interface PurchaseResult {
  /** Purchase transaction */
  transaction: {
    itemId: string;
    buyerId: WalletId;
    creatorId: CreatorId;
    amount: CurrencyAmount;
    timestamp: number;
  };
  /** Revenue split result */
  revenueSplit: {
    creator: CurrencyAmount;
    platform: CurrencyAmount;
    processing: CurrencyAmount;
  };
}

/**
 * Creator monetization configuration
 */
export interface CreatorMonetizationConfig {
  /** Optional logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Creator monetization system - handles in-game shops, season passes, and game passes.
 * All items must pass anti-P2W compliance checks.
 */
export class CreatorMonetization implements IDisposable {
  private readonly shops = new Map<GameId, Map<string, ShopItem>>();
  private readonly seasonPasses = new Map<string, SeasonPass>();
  private readonly gamePasses = new Map<string, GamePass>();
  private readonly playerPurchases = new Map<WalletId, Set<string>>(); // Track purchases for limits
  private readonly currencyManager: CurrencyManager;
  private readonly revenueSplit: RevenueSplit;
  private readonly sinks: CurrencySinks;
  private readonly compliance: AntiP2WCompliance;
  // @ts-expect-error Reserved for future use
  private readonly _eventBus: EventBus;
  private readonly disposables: DisposableGroup;
  private disposed = false;

  private readonly logger: CreatorMonetizationConfig['logger'];

  constructor(
    currencyManager: CurrencyManager,
    revenueSplit: RevenueSplit,
    sinks: CurrencySinks,
    compliance: AntiP2WCompliance,
    eventBus: EventBus,
    config: CreatorMonetizationConfig = {}
  ) {
    this.currencyManager = currencyManager;
    this.revenueSplit = revenueSplit;
    this.sinks = sinks;
    this.compliance = compliance;
    this._eventBus = eventBus;
    this.disposables = new DisposableGroup();
    this.logger = config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
  }

  /**
   * Creates or updates an in-game shop.
   */
  setShopItem(gameId: GameId, item: ShopItem): void {
    this.ensureNotDisposed();

    // Check compliance
    const game = this.compliance.getGame(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} is not registered`);
    }

    const compliance = this.compliance.checkItemCompliance(gameId, item.itemDefinition);
    if (!compliance.allowed) {
      throw new Error(`Item not compliant: ${compliance.reason}`);
    }

    if (compliance.warning) {
      this.logger?.warn(`Item compliance warning: ${compliance.warning}`);
    }

    // Get or create shop
    if (!this.shops.has(gameId)) {
      this.shops.set(gameId, new Map());
    }

    const shop = this.shops.get(gameId)!;
    shop.set(item.itemId, { ...item });

    this.logger?.debug(`Shop item set: ${item.itemId} in game ${gameId}`);
  }

  /**
   * Purchases an item from in-game shop.
   */
  purchaseItem(gameId: GameId, itemId: string, buyerId: WalletId): PurchaseResult {
    this.ensureNotDisposed();

    const shop = this.shops.get(gameId);
    if (!shop) {
      throw new Error(`Shop not found for game: ${gameId}`);
    }

    const item = shop.get(itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    if (!item.available) {
      throw new Error(`Item not available: ${itemId}`);
    }

    // Check quantity
    if (item.quantity !== undefined && item.quantity <= 0) {
      throw new Error(`Item out of stock: ${itemId}`);
    }

    // Check purchase limit
    if (item.purchaseLimit !== undefined) {
      const purchases = this.playerPurchases.get(buyerId) ?? new Set();
      const purchaseCount = Array.from(purchases).filter((id) => id === itemId).length;
      if (purchaseCount >= item.purchaseLimit) {
        throw new Error(`Purchase limit reached for item: ${itemId}`);
      }
    }

    // Get buyer wallet
    const buyerWallet = this.currencyManager.getWallet(buyerId);
    if (!buyerWallet) {
      throw new Error(`Buyer wallet not found: ${buyerId}`);
    }

    // Check balance
    if (!buyerWallet.hasBalance(PLATFORM_CURRENCY, item.price.amount)) {
      throw new Error(`Insufficient balance: need ${item.price.amount} coins`);
    }

    // Get game info for creator ID
    const game = this.compliance.getGame(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} is not registered`);
    }

    // Withdraw from buyer
    buyerWallet.withdraw(item.price, `In-game purchase: ${itemId}`);

    // Calculate revenue split
    const split = this.revenueSplit.calculateInGameSplit(item.price, game.creatorId);

    // Pay creator
    const creatorWalletId = `creator_${game.creatorId}`;
    const creatorWallet = this.currencyManager.getWallet(creatorWalletId);
    if (!creatorWallet) {
      throw new Error(`Creator wallet not found: ${creatorWalletId}`);
    }

    creatorWallet.deposit(split.creator, `In-game sale: ${itemId}`);

    // Process platform and processing fees through sinks
    const platformFee = split.platform.amount + split.processing.amount;
    if (platformFee > 0) {
      this.sinks.processFee(
        { currency: PLATFORM_CURRENCY, amount: platformFee },
        FeeType.PLATFORM_SERVICE,
        `In-game purchase: ${itemId}`
      );
    }

    // Update quantity
    if (item.quantity !== undefined) {
      item.quantity--;
    }

    // Track purchase
    if (!this.playerPurchases.has(buyerId)) {
      this.playerPurchases.set(buyerId, new Set());
    }
    this.playerPurchases.get(buyerId)!.add(itemId);

    const result: PurchaseResult = {
      transaction: {
        itemId,
        buyerId,
        creatorId: game.creatorId,
        amount: item.price,
        timestamp: Date.now(),
      },
      revenueSplit: {
        creator: split.creator,
        platform: split.platform,
        processing: split.processing,
      },
    };

    this.logger?.debug(`Item purchased: ${itemId} by ${buyerId} for ${item.price.amount} coins`);

    return result;
  }

  /**
   * Creates a season pass.
   */
  createSeasonPass(pass: Omit<SeasonPass, 'passId' | 'active'>): string {
    this.ensureNotDisposed();

    // Validate all rewards are cosmetic
    const allTiers = [...pass.freeTiers, ...pass.premiumTiers];
    for (const tier of allTiers) {
      for (const reward of tier.rewards) {
        if (reward.itemDefinition.category !== ItemCategory.COSMETIC) {
          throw new Error(
            `Season pass rewards must be cosmetic only. Tier ${tier.tierNumber} contains non-cosmetic item: ${reward.itemId}`
          );
        }
      }
    }

    const passId = `season_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const seasonPass: SeasonPass = {
      ...pass,
      passId,
      active: true,
    };

    this.seasonPasses.set(passId, seasonPass);
    this.logger?.debug(`Season pass created: ${passId} for game ${pass.gameId}`);

    return passId;
  }

  /**
   * Purchases premium season pass.
   */
  purchaseSeasonPass(passId: string, buyerId: WalletId): PurchaseResult {
    this.ensureNotDisposed();

    const pass = this.seasonPasses.get(passId);
    if (!pass) {
      throw new Error(`Season pass not found: ${passId}`);
    }

    if (!pass.active) {
      throw new Error(`Season pass not active: ${passId}`);
    }

    const now = Date.now();
    if (now < pass.startTime || now > pass.endTime) {
      throw new Error(`Season pass not available: outside season period`);
    }

    // Get buyer wallet
    const buyerWallet = this.currencyManager.getWallet(buyerId);
    if (!buyerWallet) {
      throw new Error(`Buyer wallet not found: ${buyerId}`);
    }

    // Check balance
    if (!buyerWallet.hasBalance(PLATFORM_CURRENCY, pass.premiumPrice.amount)) {
      throw new Error(`Insufficient balance: need ${pass.premiumPrice.amount} coins`);
    }

    // Withdraw from buyer
    buyerWallet.withdraw(pass.premiumPrice, `Season pass purchase: ${pass.name}`);

    // Calculate revenue split
    const split = this.revenueSplit.calculateInGameSplit(pass.premiumPrice, pass.creatorId);

    // Pay creator
    const creatorWalletId = `creator_${pass.creatorId}`;
    const creatorWallet = this.currencyManager.getWallet(creatorWalletId);
    if (!creatorWallet) {
      throw new Error(`Creator wallet not found: ${creatorWalletId}`);
    }

    creatorWallet.deposit(split.creator, `Season pass sale: ${pass.name}`);

    // Process platform fees
    const platformFee = split.platform.amount + split.processing.amount;
    if (platformFee > 0) {
      this.sinks.processFee(
        { currency: PLATFORM_CURRENCY, amount: platformFee },
        FeeType.PLATFORM_SERVICE,
        `Season pass: ${pass.name}`
      );
    }

    const result: PurchaseResult = {
      transaction: {
        itemId: passId,
        buyerId,
        creatorId: pass.creatorId,
        amount: pass.premiumPrice,
        timestamp: Date.now(),
      },
      revenueSplit: {
        creator: split.creator,
        platform: split.platform,
        processing: split.processing,
      },
    };

    this.logger?.debug(`Season pass purchased: ${passId} by ${buyerId}`);

    return result;
  }

  /**
   * Creates a game pass (subscription-like).
   */
  createGamePass(pass: Omit<GamePass, 'passId' | 'active'>): string {
    this.ensureNotDisposed();

    const passId = `gamepass_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const gamePass: GamePass = {
      ...pass,
      passId,
      active: true,
    };

    this.gamePasses.set(passId, gamePass);
    this.logger?.debug(`Game pass created: ${passId} for game ${pass.gameId}`);

    return passId;
  }

  /**
   * Purchases game pass subscription (monthly).
   */
  purchaseGamePass(passId: string, buyerId: WalletId): PurchaseResult {
    this.ensureNotDisposed();

    const pass = this.gamePasses.get(passId);
    if (!pass) {
      throw new Error(`Game pass not found: ${passId}`);
    }

    if (!pass.active) {
      throw new Error(`Game pass not active: ${passId}`);
    }

    // Get buyer wallet
    const buyerWallet = this.currencyManager.getWallet(buyerId);
    if (!buyerWallet) {
      throw new Error(`Buyer wallet not found: ${buyerId}`);
    }

    // Check balance
    if (!buyerWallet.hasBalance(PLATFORM_CURRENCY, pass.monthlyPrice.amount)) {
      throw new Error(`Insufficient balance: need ${pass.monthlyPrice.amount} coins`);
    }

    // Withdraw from buyer
    buyerWallet.withdraw(pass.monthlyPrice, `Game pass subscription: ${pass.name}`);

    // Calculate revenue split
    const split = this.revenueSplit.calculateInGameSplit(pass.monthlyPrice, pass.creatorId);

    // Pay creator
    const creatorWalletId = `creator_${pass.creatorId}`;
    const creatorWallet = this.currencyManager.getWallet(creatorWalletId);
    if (!creatorWallet) {
      throw new Error(`Creator wallet not found: ${creatorWalletId}`);
    }

    creatorWallet.deposit(split.creator, `Game pass subscription: ${pass.name}`);

    // Process platform fees
    const platformFee = split.platform.amount + split.processing.amount;
    if (platformFee > 0) {
      this.sinks.processFee(
        { currency: PLATFORM_CURRENCY, amount: platformFee },
        FeeType.PLATFORM_SERVICE,
        `Game pass: ${pass.name}`
      );
    }

    const result: PurchaseResult = {
      transaction: {
        itemId: passId,
        buyerId,
        creatorId: pass.creatorId,
        amount: pass.monthlyPrice,
        timestamp: Date.now(),
      },
      revenueSplit: {
        creator: split.creator,
        platform: split.platform,
        processing: split.processing,
      },
    };

    this.logger?.debug(`Game pass purchased: ${passId} by ${buyerId}`);

    return result;
  }

  /**
   * Gets shop items for a game.
   */
  getShopItems(gameId: GameId): ShopItem[] {
    this.ensureNotDisposed();
    const shop = this.shops.get(gameId);
    return shop ? Array.from(shop.values()) : [];
  }

  /**
   * Gets season pass by ID.
   */
  getSeasonPass(passId: string): SeasonPass | null {
    this.ensureNotDisposed();
    return this.seasonPasses.get(passId) ?? null;
  }

  /**
   * Gets game pass by ID.
   */
  getGamePass(passId: string): GamePass | null {
    this.ensureNotDisposed();
    return this.gamePasses.get(passId) ?? null;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.disposables.dispose();
    this.shops.clear();
    this.seasonPasses.clear();
    this.gamePasses.clear();
    this.playerPurchases.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('CreatorMonetization has been disposed');
    }
  }
}

