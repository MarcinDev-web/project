import type { AuthManager } from '../auth/AuthManager.js';
import type { SessionManager } from '../websocket/SessionManager.js';
import type { GameSessionTracker } from '../websocket/GameSessionTracker.js';
import type { MessageHandler } from '../websocket/MessageHandler.js';
import type { ForumHandler } from '../websocket/ForumHandler.js';
import type { ProjectStorage } from '../storage/ProjectStorage.js';
import type { UserProfileStorage } from '../storage/UserProfileStorage.js';
import type { MarketplaceStorage } from '../storage/MarketplaceStorage.js';
import type { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import type { BuildStorage } from '../storage/BuildStorage.js';
import type { LikesStorage } from '../storage/LikesStorage.js';
import type { FriendsStorage } from '../storage/FriendsStorage.js';
import type { MessagesStorage } from '../storage/MessagesStorage.js';
import type { BlockedUsersStorage } from '../storage/BlockedUsersStorage.js';
import type { NotificationsStorage } from '../storage/NotificationsStorage.js';
import type { UserSettingsStorage } from '../storage/UserSettingsStorage.js';
import type { ForumStorage } from '../storage/ForumStorage.js';
import type { ShopStorage } from '../storage/ShopStorage.js';
import type { AssetStorage } from '../storage/AssetStorage.js';
import type { PurchaseStorage } from '../storage/PurchaseStorage.js';
import type { StudioProjectsStorage } from '../storage/StudioProjectsStorage.js';
import type { StudioTeamStorage } from '../storage/StudioTeamStorage.js';
import type { StudioSettingsStorage } from '../storage/StudioSettingsStorage.js';
import type { CurrencyService } from '../services/CurrencyService.js';
import type { PurchaseService } from '../services/PurchaseService.js';
import type { LedgerService } from '../services/LedgerService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CurrencyAmount } from '@engine/economy';
import type { PrismaClient } from '../../node_modules/.prisma/net-client/index.js';

/**
 * RouteDependencies - all dependencies needed by route handlers
 */
export interface RouteDependencies {
  // Auth & Session
  authManager: AuthManager;
  authMiddleware: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAdmin: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireModerator: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
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

  // Rate limiters (Fastify rate limit configs)
  authLimiter: {
    max: number;
    timeWindow: string;
    errorResponseBuilder: (request: FastifyRequest) => { error: string };
  };
  economyLimiter: {
    max: number;
    timeWindow: string;
    errorResponseBuilder: (request: FastifyRequest) => { error: string };
  };
  publishLimiter: {
    max: number;
    timeWindow: string;
    errorResponseBuilder: () => { error: string };
  };

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

  // Note: Fastify handles async errors natively, asyncHandler not needed

  // Economy config
  ECONOMY_MIN_PRICE: Record<string, number>;
  ECONOMY_PRICE_CHANGE_COOLDOWN_SEC: number;
  ECONOMY_LISTING_FEE: Record<string, number>;
  ECONOMY_PLATFORM_FEE_BPS: number;
}


