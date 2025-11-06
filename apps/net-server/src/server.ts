import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import {
  getCorsConfig,
  isOriginAllowed,
  describeAllowedOrigins,
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
} from '@shared/config/cors';
import { ProjectStorage } from './storage/ProjectStorage.js';
import { AuthManager } from './auth/AuthManager.js';
import { createAuthMiddleware, requireAdmin, requireModerator } from './auth/middleware.js';
import { securityHeadersHook } from './middleware/securityHeaders.js';
import { assertConfigValid } from './config/validateConfig.js';
import { securityLogger } from './logging/SecurityLogger.js';
import { validateQuery } from './validation/middleware.js';
import {
  publishItemSchema,
  resaleListingSchema,
  searchQuerySchema,
  marketplaceItemIdParamSchema,
} from './validation/schemas/marketplace';
import jwt from 'jsonwebtoken';
import type { JWTPayload } from './types/auth.js';

// Helper to extract user ID from token (optional, doesn't fail if invalid)
async function getUserIdFromToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded.userId;
  } catch {
    return null;
  }
}
import { SessionManager } from './websocket/SessionManager.js';
import { WebSocketHandler } from './websocket/WebSocketHandler.js';
import { GameSessionTracker } from './websocket/GameSessionTracker.js';
import { MessageHandler } from './websocket/MessageHandler.js';
import { ForumHandler } from './websocket/ForumHandler.js';
import { UserProfileStorage } from './storage/UserProfileStorage.js';
import { sanitizeMarketplacePublishRequest } from './validation/marketplace.js';
import { MarketplaceStorage } from './storage/MarketplaceStorage.js';
import { MarketplaceStorageDB } from './storage/MarketplaceStorageDB.js';
import { BuildStorage } from './storage/BuildStorage.js';
import {
  ValidationError,
  BuildDataError,
  PayloadTooLargeError,
  DatabaseError,
} from './errors/MarketplaceErrors.js';
import { LikesStorage } from './storage/LikesStorage.js';
import { FriendsStorage } from './storage/FriendsStorage.js';
import { MessagesStorage } from './storage/MessagesStorage.js';
import { BlockedUsersStorage } from './storage/BlockedUsersStorage.js';
import { NotificationsStorage } from './storage/NotificationsStorage.js';
import { UserSettingsStorage } from './storage/UserSettingsStorage.js';
import { ForumStorage } from './storage/ForumStorage.js';
import { ShopStorage } from './storage/ShopStorage.js';
import { ShopStorageDB } from './storage/ShopStorageDB.js';
import { AssetStorage } from './storage/AssetStorage.js';
import { AssetStorageDB } from './storage/AssetStorageDB.js';
import { PurchaseStorage } from './storage/PurchaseStorage.js';
import { PurchaseStorageDB } from './storage/PurchaseStorageDB.js';
import { StudioProjectsStorage, StudioProjectsStorageDB } from './storage/StudioProjectsStorage.js';
import { StudioSettingsStorage, StudioSettingsStorageDB } from './storage/StudioSettingsStorage.js';
import { StudioTeamStorage, StudioTeamStorageDB } from './storage/StudioTeamStorage.js';
import { CurrencyService } from './services/CurrencyService.js';
import { PurchaseService } from './services/PurchaseService.js';
import { LedgerService } from './services/LedgerService.js';
import { CurrencyEventNames, type CurrencyAmount } from '@engine/economy';
import { generateAndSaveThumbnail } from './utils/thumbnailGenerator.js';
import { createDbPool, ensureSchema, getPrismaClient, disconnectPrisma } from './lib/db.js';

// Note: Fastify handles async errors natively, no need for asyncHandler

// Import route modules
import { createAuthRoutes } from './routes/auth.routes.js';
import { createUsersRoutes } from './routes/users.routes.js';
import { createMarketplaceRoutes } from './routes/marketplace.routes.js';
import { createFriendsRoutes } from './routes/friends.routes.js';
import { createMessagesRoutes } from './routes/messages.routes.js';
import { createShareRoutes } from './routes/share.routes.js';
import { createNotificationsRoutes } from './routes/notifications.routes.js';
import { createSettingsRoutes } from './routes/settings.routes.js';
import { createShopRoutes } from './routes/shop.routes.js';
import { createStudioRoutes } from './routes/studio.routes.js';
import { createForumRoutes } from './routes/forum.routes.js';
import { createAdminRoutes } from './routes/admin.routes.js';
import { createGamesRoutes } from './routes/games.routes.js';
import type { RouteDependencies } from './routes/index.js';

// Type for Prisma Client (backward compatibility)
// Note: This is PrismaClient, not pg.Pool, but kept name for compatibility
import path from 'path';
import { promises as fs } from 'fs';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
// Use dynamic port in test environment to avoid conflicts between parallel test workers
// Port is based on worker thread ID if available, otherwise PID modulo
const getTestPort = (basePort: number): number => {
  if (process.env.VITEST_WORKER_ID) {
    return basePort + parseInt(process.env.VITEST_WORKER_ID, 10);
  }
  return basePort + (process.pid % 100); // Use PID modulo for uniqueness
};
const WS_PORT = process.env.WS_PORT
  ? parseInt(process.env.WS_PORT, 10)
  : process.env.NODE_ENV === 'test' || process.env.VITEST
    ? getTestPort(3001)
    : 3001;
const DATA_DIR = process.env.DATA_DIR || './data';
const THUMBNAIL_DIR = path.join(DATA_DIR, 'thumbnails');
const isProduction = process.env.NODE_ENV === 'production';

// Set default JWT secrets for development if not provided (must be at least 32 chars)
// Must be set BEFORE validateConfig() is called
if (!process.env.JWT_SECRET && !isProduction) {
  process.env.JWT_SECRET = 'dev-secret-key-change-me-in-production-12345678';
}
if (!process.env.JWT_REFRESH_SECRET && !isProduction) {
  process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret-key-change-me-in-production-12345678';
}

// Economy configuration (basic feature flags / anti-abuse controls)
const ECONOMY_MIN_PRICE: Record<string, number> = {
  credits: parseFloat(String(process.env.ECONOMY_MIN_PRICE_CREDITS ?? '0.1')),
};
const ECONOMY_PRICE_CHANGE_COOLDOWN_SEC = parseInt(
  String(process.env.ECONOMY_PRICE_CHANGE_COOLDOWN_SEC ?? '3600'),
  10
);
const ECONOMY_LISTING_FEE: Record<string, number> = {
  credits: parseFloat(String(process.env.ECONOMY_LISTING_FEE_CREDITS ?? '0.1')),
};
const ECONOMY_PLATFORM_FEE_BPS = parseInt(
  String(process.env.ECONOMY_PLATFORM_FEE_BPS ?? '800'),
  10
); // 8%

// Validate configuration on startup
assertConfigValid();

const app: FastifyInstance = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024, // 10MB default
  trustProxy: true, // Trust proxy for correct IP detection
});

// Database connection (optional) - using Prisma Client
let dbPool: Awaited<ReturnType<typeof getPrismaClient>> | null = null;
if (process.env.DATABASE_URL) {
  try {
    dbPool = await createDbPool();
    console.log('Database connection pool created');
  } catch (error) {
    console.error('Failed to create database connection pool:', error);
    console.warn('Continuing with JSON file storage...');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectPrisma();
  process.exit(0);
});

const storage = new ProjectStorage(DATA_DIR);
const authManager = new AuthManager(DATA_DIR, dbPool);
const authMiddleware = createAuthMiddleware(authManager);
const sessionManager = new SessionManager(authManager);
const gameSessionTracker = new GameSessionTracker();
const profileStorage = new UserProfileStorage(DATA_DIR);
// Use database storage if available, otherwise fallback to JSON
const marketplaceStorage = dbPool
  ? new MarketplaceStorageDB(dbPool)
  : new MarketplaceStorage(DATA_DIR);
const buildStorage = dbPool ? new BuildStorage(dbPool) : null;
const likesStorage = dbPool
  ? new LikesStorage(dbPool)
  : new LikesStorage(DATA_DIR, marketplaceStorage as MarketplaceStorage);
const friendsStorage = new FriendsStorage(DATA_DIR);
const messagesStorage = new MessagesStorage(DATA_DIR);
const blockedUsersStorage = new BlockedUsersStorage(DATA_DIR);
const notificationsStorage = new NotificationsStorage(DATA_DIR);
const userSettingsStorage = new UserSettingsStorage(DATA_DIR);
const forumStorage = new ForumStorage(DATA_DIR);
const messageHandler = new MessageHandler(messagesStorage, sessionManager);
const forumHandler = new ForumHandler(sessionManager, forumStorage);

// Shop storage (use database if available, otherwise JSON)
const shopStorage = dbPool ? new ShopStorageDB(dbPool) : new ShopStorage(DATA_DIR);
const assetStorage = dbPool ? new AssetStorageDB(dbPool) : new AssetStorage(DATA_DIR);
const purchaseStorage = dbPool ? new PurchaseStorageDB(dbPool) : new PurchaseStorage(DATA_DIR);

// Studio projects storage (use database if available, otherwise JSON)
const studioProjectsStorage = dbPool
  ? new StudioProjectsStorageDB(dbPool)
  : new StudioProjectsStorage(DATA_DIR);

// Studio team storage (use database if available, otherwise JSON)
const studioTeamStorage = dbPool
  ? new StudioTeamStorageDB(dbPool)
  : new StudioTeamStorage(DATA_DIR);

// Studio settings storage (use database if available, otherwise JSON)
const studioSettingsStorage = dbPool
  ? new StudioSettingsStorageDB(dbPool)
  : new StudioSettingsStorage(DATA_DIR);

// Initialize shop storage (only for JSON storage)
if (!dbPool) {
  if ('initialize' in shopStorage) {
    await (shopStorage as ShopStorage).initialize();
  }
  if ('initialize' in assetStorage) {
    await (assetStorage as AssetStorage).initialize();
  }
  if ('initialize' in purchaseStorage) {
    await (purchaseStorage as PurchaseStorage).initialize();
  }
  if ('initialize' in studioProjectsStorage) {
    await (studioProjectsStorage as StudioProjectsStorage).initialize();
  }
  if ('initialize' in studioTeamStorage) {
    await (studioTeamStorage as StudioTeamStorage).initialize();
  }
  if ('initialize' in studioSettingsStorage) {
    await (studioSettingsStorage as StudioSettingsStorage).initialize();
  }
}

// Currency and purchase services
const currencyService = new CurrencyService();
const ledgerService = new LedgerService();

// Subscribe to currency transactions to populate ledger
try {
  const manager = currencyService.getManager();
  manager.events.on(CurrencyEventNames.TRANSACTION_COMPLETED, (data: unknown) => {
    const tx = (data as { transaction?: any }).transaction;
    if (!tx) return;
    switch (tx.type) {
      case 'deposit':
        ledgerService.addFromTransaction(tx, 'DEPOSIT', 1);
        break;
      case 'withdrawal':
        ledgerService.addFromTransaction(tx, 'WITHDRAW', -1);
        break;
      case 'transfer': {
        // record both sides using the same tx id for traceability
        ledgerService.addFromTransaction(tx, 'TRANSFER', -1);
        ledgerService.addFromTransaction(tx, 'TRANSFER', 1);
        break;
      }
      case 'exchange':
        // ignore for now
        break;
      default:
        break;
    }
  });
} catch (e) {
  console.warn('Failed to subscribe ledger to currency events:', e);
}
const purchaseService = new PurchaseService(
  currencyService,
  shopStorage as unknown as ShopStorage, // Type workaround for interface compatibility
  assetStorage as unknown as AssetStorage,
  purchaseStorage as unknown as PurchaseStorage,
  marketplaceStorage as unknown as MarketplaceStorage
);

// Cart storage (in-memory for MVP, per-user)
const userCarts = new Map<
  string,
  Array<{ itemId: string; type: 'shop-item' | 'asset' | 'marketplace-item'; quantity: number }>
>();

// In-memory secondary resale listings (keyed by marketplace item id)
type ResaleListing = { sellerId: string; price: CurrencyAmount; createdAt: number };
const resaleListings = new Map<string, ResaleListing[]>();

const corsConfig = getCorsConfig();
const FRONTEND_URL = corsConfig.primaryOrigin;
const allowedOriginsDescription = describeAllowedOrigins(corsConfig);

// Register plugins
await app.register(cookie);
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return cb(null, true);
    }

    if (isOriginAllowed(origin, corsConfig)) {
      return cb(null, true);
    }

    securityLogger.logSuspiciousActivity(
      undefined,
      `Blocked CORS origin: ${origin}. Allowed: ${allowedOriginsDescription}`
    );
    cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: CORS_ALLOWED_METHODS,
  allowedHeaders: CORS_ALLOWED_HEADERS,
  maxAge: 86400, // 24 hours
});

// Security headers hook (must be early in the chain)
app.addHook('onSend', securityHeadersHook);

// HTTPS enforcement in production
if (isProduction) {
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers['x-forwarded-proto'] !== 'https') {
      const host = request.headers.host ?? '';
      return reply.redirect(`https://${host}${request.url}`, 301);
    }
  });
}

// Rate limiting configuration for auth endpoints
const authLimiterConfig = {
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10),
  timeWindow: '15 minutes',
  errorResponseBuilder: (request: any) => {
    const ip = request.ip || 'unknown';
    securityLogger.logRateLimitViolation(ip, '/api/auth/*', authLimiterConfig.max);
    return {
      error: 'Too many authentication attempts, please try again later.',
    };
  },
};

// Rate limiting configuration for economy endpoints
const economyLimiterConfig = {
  max: parseInt(process.env.ECONOMY_RATE_LIMIT_MAX || '20', 10),
  timeWindow: '1 minute',
  errorResponseBuilder: (request: any) => {
    const ip = request.ip || 'unknown';
    securityLogger.logRateLimitViolation(ip, request.url, economyLimiterConfig.max);
    return {
      error: 'Too many economy requests, slow down.',
    };
  },
};

// Rate limiting configuration for marketplace publishing
const publishLimiterConfig = {
  max: 5,
  timeWindow: '15 minutes',
  errorResponseBuilder: () => ({
    error: 'Too many publications, please try again later.',
  }),
};

// Export rate limiter configs for use in routes
export const authLimiter = authLimiterConfig;
export const economyLimiter = economyLimiterConfig;
export const publishLimiter = publishLimiterConfig;

// Initialize storage on startup
void storage.initialize().then(() => {
  console.log('Storage initialized');
});

void authManager.initialize().then(async () => {
  console.log('Auth manager initialized');

  // Initialize database schema if database is available
  if (dbPool) {
    try {
      await ensureSchema();
      console.log('Database schema ensured');
    } catch (error) {
      console.error('Failed to ensure database schema:', error);
      throw error;
    }
  }

  // Initialize new storage systems
  await profileStorage.initialize();
  await marketplaceStorage.initialize();
  await likesStorage.initialize();
  await friendsStorage.initialize();
  await messagesStorage.initialize();
  await blockedUsersStorage.initialize();
  await notificationsStorage.initialize();
  await userSettingsStorage.initialize();
  await forumStorage.initialize();
  console.log('All storage systems initialized');

  // Auto-seed marketplace if empty (development only, skip in tests)
  if (!isProduction && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    const existingItems = await marketplaceStorage.getItems({ limit: 100 });
    if (existingItems.length === 0) {
      console.log('Marketplace is empty, seeding mock builds and avatars...');
      try {
        // Dynamic import to avoid circular dependency
        const seedModule = await import('./scripts/seedMarketplace.js');
        if (seedModule.seedMarketplace) {
          await seedModule.seedMarketplace(gameSessionTracker);
        }
      } catch (error) {
        console.warn('Failed to auto-seed marketplace:', error);
      }
    } else {
      // Add mock players and regenerate thumbnails for existing items (to remove old "GAME" badge)
      console.log(
        `Adding mock players and regenerating thumbnails for ${existingItems.length} existing items...`
      );
      for (const item of existingItems) {
        // Always regenerate thumbnail to ensure latest format (no "GAME" badge)
        try {
          await generateAndSaveThumbnail(THUMBNAIL_DIR, item.id, item.title, item.tags);
          const thumbnailUrl = `/api/marketplace/thumbnails/${item.id}`;
          await marketplaceStorage.updateItem(item.id, { thumbnailUrl });
          console.log(`  → ${item.title}: Regenerated thumbnail`);
        } catch (error) {
          console.warn(`  → ${item.title}: Failed to regenerate thumbnail:`, error);
        }

        // Add mock players (if no players already)
        const currentPlayers = gameSessionTracker.getPlayerCount(item.id);
        if (currentPlayers === 0) {
          const playersOnline = Math.floor(Math.random() * 20); // 0-19 players
          if (playersOnline > 0) {
            for (let i = 0; i < playersOnline; i++) {
              const mockUserId = `mock_player_${item.id}_${i}_${Date.now()}`;
              gameSessionTracker.joinGame(item.id, mockUserId);
            }
            console.log(`  → ${item.title}: ${playersOnline} mock players online`);
          }
        }
      }
    }
  }

  // Initialize WebSocket server after auth is ready

  const wsHandler = isProduction
    ? new WebSocketHandler(
        { server: app.server, path: '/ws' },
        sessionManager,
        authManager,
        messageHandler,
        friendsStorage,
        corsConfig
      )
    : new WebSocketHandler(
        { port: WS_PORT },
        sessionManager,
        authManager,
        messageHandler,
        friendsStorage,
        corsConfig
      );
  // wsHandler is kept alive by its internal WebSocket server
  void wsHandler;
});

// Simple in-memory cache for aggregates (15 minutes TTL) - used by studio routes
const aggregateCache = new Map<string, { expiresAt: number; data: unknown }>();
function cacheGet<T>(key: string): T | null {
  const hit = aggregateCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    aggregateCache.delete(key);
    return null;
  }
  return hit.data as T;
}
function cacheSet<T>(key: string, data: T, ttlMs = 15 * 60 * 1000): void {
  aggregateCache.set(key, { expiresAt: Date.now() + ttlMs, data });
}

// Build RouteDependencies object
const routeDeps: RouteDependencies = {
  // Auth & Session
  authManager,
  authMiddleware,
  requireAdmin,
  requireModerator,
  sessionManager,
  gameSessionTracker,
  messageHandler,
  forumHandler,

  // Storage
  storage,
  profileStorage,
  marketplaceStorage,
  buildStorage,
  likesStorage,
  friendsStorage,
  messagesStorage,
  blockedUsersStorage,
  notificationsStorage,
  userSettingsStorage,
  forumStorage,
  shopStorage: shopStorage as unknown as ShopStorage,
  assetStorage: assetStorage as unknown as AssetStorage,
  purchaseStorage: purchaseStorage as unknown as PurchaseStorage,
  studioProjectsStorage: studioProjectsStorage as unknown as StudioProjectsStorage,
  studioTeamStorage: studioTeamStorage as unknown as StudioTeamStorage,
  studioSettingsStorage: studioSettingsStorage as unknown as StudioSettingsStorage,

  // Services
  currencyService,
  purchaseService,
  ledgerService,

  // Utilities & Config
  isProduction,
  THUMBNAIL_DIR,
  FRONTEND_URL,
  generateAndSaveThumbnail,
  dbPool,
  path,
  fs,

  // Cache functions
  cacheGet,
  cacheSet,

  // In-memory stores
  userCarts,
  resaleListings,

  // Rate limiters
  authLimiter,
  economyLimiter,
  publishLimiter,

  // Security
  securityLogger,

  // Helper functions
  getUserIdFromToken,

  // Error classes (constructors)
  ValidationError,
  BuildDataError,
  PayloadTooLargeError,
  DatabaseError,

  // Validation utilities
  sanitizeMarketplacePublishRequest,

  // Middleware & schemas
  publishItemSchema,
  resaleListingSchema,
  searchQuerySchema,
  marketplaceItemIdParamSchema,
  validateQuery,

  // Economy config
  ECONOMY_MIN_PRICE,
  ECONOMY_PRICE_CHANGE_COOLDOWN_SEC,
  ECONOMY_LISTING_FEE,
  ECONOMY_PLATFORM_FEE_BPS,
};

// Register all route modules under /api prefix
await app.register(createAuthRoutes, { prefix: '/api/auth', dependencies: routeDeps });
await app.register(createUsersRoutes, { prefix: '/api/users', dependencies: routeDeps });
await app.register(createMarketplaceRoutes, { prefix: '/api/marketplace', dependencies: routeDeps });
await app.register(createGamesRoutes, { prefix: '/api/games', dependencies: routeDeps });
await app.register(createFriendsRoutes, { prefix: '/api/friends', dependencies: routeDeps });
await app.register(createMessagesRoutes, { prefix: '/api/messages', dependencies: routeDeps });
await app.register(createShareRoutes, { prefix: '/api/share', dependencies: routeDeps });
await app.register(createNotificationsRoutes, {
  prefix: '/api/notifications',
  dependencies: routeDeps,
});
await app.register(createSettingsRoutes, { prefix: '/api/settings', dependencies: routeDeps });
await app.register(createShopRoutes, { prefix: '/api/shop', dependencies: routeDeps });
await app.register(createStudioRoutes, { prefix: '/api/studio', dependencies: routeDeps });
await app.register(createForumRoutes, { prefix: '/api/forum', dependencies: routeDeps });
await app.register(createAdminRoutes, { prefix: '/api/admin', dependencies: routeDeps });

/**
 * GET /api/projects/:token/preview
 * Get preview information for a shared project (used in forum link previews).
 */
app.get('/api/projects/:token/preview', async (request, reply) => {
  try {
    const { token } = request.params as { token?: string };
    if (!token || typeof token !== 'string') {
      return reply.code(400).send({ error: 'Token is required' });
    }
    const share = await storage.load(token);

    if (!share) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    reply.send({
      token,
      createdAt: share.createdAt,
      title: (share.projectData as { title?: string } | undefined)?.title || 'Shared Project',
    });
  } catch (error) {
    console.error('Get project preview error:', error);
    reply.code(500).send({
      error: 'Failed to get project preview',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Health check endpoint.
 */
app.get('/health', async () => {
  return { status: 'ok' };
});

/**
 * Global error handler for Fastify.
 * Catches unhandled errors and returns proper error responses.
 */
app.setErrorHandler((error, _request, reply) => {
  console.error('Unhandled error:', error);

  // Handle known error types
  if (error instanceof ValidationError) {
    return reply.code(400).send({
      error: 'Validation failed',
      message: error.message,
      errors: (error as ValidationError).errors,
    });
  }

  if (error instanceof BuildDataError) {
    return reply.code(400).send({
      error: 'Build data error',
      message: error.message,
    });
  }

  if (error instanceof PayloadTooLargeError) {
    return reply.code(413).send({
      error: 'Payload too large',
      message: error.message,
    });
  }

  if (error instanceof DatabaseError) {
    return reply.code(500).send({
      error: 'Database error',
      message: isProduction ? 'Database operation failed' : error.message,
    });
  }

  // Handle JWT errors
  if (error instanceof jwt.JsonWebTokenError) {
    return reply.code(401).send({
      error: 'Invalid token',
      message: 'Authentication token is invalid',
    });
  }

  if (error instanceof jwt.TokenExpiredError) {
    return reply.code(401).send({
      error: 'Token expired',
      message: 'Authentication token has expired',
    });
  }

  // Generic error handler
  const message = error instanceof Error ? error.message : 'Internal server error';
  const statusCode = (error as { statusCode?: number })?.statusCode || 500;

  reply.code(statusCode).send({
    error: 'Internal server error',
    message: isProduction && statusCode === 500 ? 'An unexpected error occurred' : message,
    ...(isProduction ? {} : { stack: error instanceof Error ? error.stack : undefined }),
  });
});

/**
 * 404 handler (must be after all routes and error handler).
 */
app.setNotFoundHandler((_request, reply) => {
  reply.code(404).send({
    error: 'Not found',
    message: 'The requested resource was not found',
  });
});

// Export app and dependencies for testing
export {
  app,
  authManager,
  marketplaceStorage,
  likesStorage,
  buildStorage,
  gameSessionTracker,
  studioProjectsStorage,
  dbPool,
};

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Net server listening on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
}

