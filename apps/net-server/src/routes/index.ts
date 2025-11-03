import type { AuthManager } from '../auth/AuthManager';
import type { SessionManager } from '../websocket/SessionManager';
import type { GameSessionTracker } from '../websocket/GameSessionTracker';
import type { MessageHandler } from '../websocket/MessageHandler';
import type { ForumHandler } from '../websocket/ForumHandler';
import type { ProjectStorage } from '../storage/ProjectStorage';
import type { UserProfileStorage } from '../storage/UserProfileStorage';
import type { MarketplaceStorage } from '../storage/MarketplaceStorage';
import type { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB';
import type { BuildStorage } from '../storage/BuildStorage';
import type { LikesStorage } from '../storage/LikesStorage';
import type { FriendsStorage } from '../storage/FriendsStorage';
import type { MessagesStorage } from '../storage/MessagesStorage';
import type { BlockedUsersStorage } from '../storage/BlockedUsersStorage';
import type { NotificationsStorage } from '../storage/NotificationsStorage';
import type { UserSettingsStorage } from '../storage/UserSettingsStorage';
import type { ForumStorage } from '../storage/ForumStorage';
import type { ShopStorage } from '../storage/ShopStorage';
import type { AssetStorage } from '../storage/AssetStorage';
import type { PurchaseStorage } from '../storage/PurchaseStorage';
import type { StudioProjectsStorage } from '../storage/StudioProjectsStorage';
import type { StudioTeamStorage } from '../storage/StudioTeamStorage';
import type { StudioSettingsStorage } from '../storage/StudioSettingsStorage';
import type { CurrencyService } from '../services/CurrencyService';
import type { PurchaseService } from '../services/PurchaseService';
import type { LedgerService } from '../services/LedgerService';
import type { Request, Response, NextFunction } from 'express';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import type { CurrencyAmount } from '@engine/economy';
// @ts-expect-error - Prisma client is generated at build time
import type { PrismaClient } from '../../node_modules/.prisma/net-client';

/**
 * RouteDependencies - all dependencies needed by route handlers
 */
export interface RouteDependencies {
  // Auth & Session
  authManager: AuthManager;
  authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  requireAdmin: () => (req: Request, res: Response, next: NextFunction) => void;
  requireModerator: () => (req: Request, res: Response, next: NextFunction) => void;
  sessionManager: SessionManager;
  gameSessionTracker: GameSessionTracker;
  messageHandler: MessageHandler;
  forumHandler: ForumHandler;

  // Storage
  storage: ProjectStorage;
  profileStorage: UserProfileStorage;
  marketplaceStorage: MarketplaceStorage | MarketplaceStorageDB;
  buildStorage: BuildStorage | null;
  likesStorage: LikesStorage;
  friendsStorage: FriendsStorage;
  messagesStorage: MessagesStorage;
  blockedUsersStorage: BlockedUsersStorage;
  notificationsStorage: NotificationsStorage;
  userSettingsStorage: UserSettingsStorage;
  forumStorage: ForumStorage;
  shopStorage: ShopStorage;
  assetStorage: AssetStorage;
  purchaseStorage: PurchaseStorage;
  studioProjectsStorage: StudioProjectsStorage;
  studioTeamStorage: StudioTeamStorage;
  studioSettingsStorage: StudioSettingsStorage;

  // Services
  currencyService: CurrencyService;
  purchaseService: PurchaseService;
  ledgerService: LedgerService;

  // Utilities & Config
  isProduction: boolean;
  THUMBNAIL_DIR: string;
  FRONTEND_URL: string;
  generateAndSaveThumbnail: (
    thumbnailDir: string,
    itemId: string,
    title: string,
    tags: string[]
  ) => Promise<string>;
  dbPool: PrismaClient | null;
  path: typeof import('path');
  fs: typeof import('fs').promises;

  // Cache functions (for studio routes)
  cacheGet: <T>(key: string) => T | null;
  cacheSet: <T>(key: string, data: T, ttlMs?: number) => void;

  // In-memory stores
  userCarts: Map<
    string,
    Array<{ itemId: string; type: 'shop-item' | 'asset' | 'marketplace-item'; quantity: number }>
  >;
  resaleListings: Map<string, { sellerId: string; price: CurrencyAmount; createdAt: number }[]>;

  // Rate limiters
  authLimiter: RateLimitRequestHandler;
  economyLimiter: RateLimitRequestHandler;
  publishLimiter: RateLimitRequestHandler;

  // Security
  securityLogger: {
    logAuthSuccess: (userId: string, email: string, ip: string, userAgent: string) => void;
    logAuthFailure: (email: string, message: string, ip: string, userAgent: string) => void;
    logRateLimitViolation: (ip: string, path: string, limit: number) => void;
  };

  // Helper functions
  getUserIdFromToken: (authHeader: string | undefined) => Promise<string | null>;

  // Error classes (constructors)
  ValidationError: new (
    message: string,
    errors?: Array<{ field: string; message: string }>
  ) => import('../errors/MarketplaceErrors').ValidationError;
  BuildDataError: new (
    message: string,
    originalError?: Error
  ) => import('../errors/MarketplaceErrors').BuildDataError;
  PayloadTooLargeError: new (
    message: string
  ) => import('../errors/MarketplaceErrors').PayloadTooLargeError;
  DatabaseError: new (
    message: string,
    originalError?: Error
  ) => import('../errors/MarketplaceErrors').DatabaseError;

  // Validation utilities
  sanitizeMarketplacePublishRequest: (body: Record<string, unknown>) => Record<string, unknown>;

  // Middleware & schemas
  publishItemSchema: typeof import('../validation/schemas/marketplace').publishItemSchema;
  resaleListingSchema: typeof import('../validation/schemas/marketplace').resaleListingSchema;
  searchQuerySchema: typeof import('../validation/schemas/marketplace').searchQuerySchema;
  marketplaceItemIdParamSchema: typeof import('../validation/schemas/marketplace').marketplaceItemIdParamSchema;
  validateQuery: typeof import('../validation/middleware').validateQuery;

  // Async handler wrapper (for routes that don't catch errors)
  asyncHandler: (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
  ) => (req: Request, res: Response, next: NextFunction) => void;

  // Economy config
  ECONOMY_MIN_PRICE: Record<string, number>;
  ECONOMY_PRICE_CHANGE_COOLDOWN_SEC: number;
  ECONOMY_LISTING_FEE: Record<string, number>;
  ECONOMY_PLATFORM_FEE_BPS: number;
}
