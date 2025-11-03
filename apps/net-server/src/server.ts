import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ProjectStorage } from './storage/ProjectStorage';
import { AuthManager } from './auth/AuthManager';
import { createAuthMiddleware, requireAdmin, requireModerator } from './auth/middleware';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { assertConfigValid } from './config/validateConfig';
import { securityLogger } from './logging/SecurityLogger';
import { validateQuery } from './validation/middleware';
import {
  publishItemSchema,
  resaleListingSchema,
  searchQuerySchema,
  marketplaceItemIdParamSchema,
} from './validation/schemas/marketplace';
import jwt from 'jsonwebtoken';
import type { JWTPayload } from './types/auth';

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
import { SessionManager } from './websocket/SessionManager';
import { WebSocketHandler } from './websocket/WebSocketHandler';
import { GameSessionTracker } from './websocket/GameSessionTracker';
import { MessageHandler } from './websocket/MessageHandler';
import { ForumHandler } from './websocket/ForumHandler';
import { UserProfileStorage } from './storage/UserProfileStorage';
import { sanitizeMarketplacePublishRequest } from './validation/marketplace';
import { MarketplaceStorage } from './storage/MarketplaceStorage';
import { MarketplaceStorageDB } from './storage/MarketplaceStorageDB';
import { BuildStorage } from './storage/BuildStorage';
import {
  ValidationError,
  BuildDataError,
  PayloadTooLargeError,
  DatabaseError,
} from './errors/MarketplaceErrors';
import { LikesStorage } from './storage/LikesStorage';
import { FriendsStorage } from './storage/FriendsStorage';
import { MessagesStorage } from './storage/MessagesStorage';
import { BlockedUsersStorage } from './storage/BlockedUsersStorage';
import { NotificationsStorage } from './storage/NotificationsStorage';
import { UserSettingsStorage } from './storage/UserSettingsStorage';
import { ForumStorage } from './storage/ForumStorage';
import { ShopStorage } from './storage/ShopStorage';
import { ShopStorageDB } from './storage/ShopStorageDB';
import { AssetStorage } from './storage/AssetStorage';
import { AssetStorageDB } from './storage/AssetStorageDB';
import { PurchaseStorage } from './storage/PurchaseStorage';
import { PurchaseStorageDB } from './storage/PurchaseStorageDB';
import { StudioProjectsStorage, StudioProjectsStorageDB } from './storage/StudioProjectsStorage';
import { StudioSettingsStorage, StudioSettingsStorageDB } from './storage/StudioSettingsStorage';
import { StudioTeamStorage, StudioTeamStorageDB } from './storage/StudioTeamStorage';
import { CurrencyService } from './services/CurrencyService';
import { PurchaseService } from './services/PurchaseService';
import { LedgerService } from './services/LedgerService';
import { CurrencyEventNames, type CurrencyAmount } from '@engine/economy';
import { generateAndSaveThumbnail } from './utils/thumbnailGenerator';
import { createDbPool, ensureSchema, getPrismaClient, disconnectPrisma } from './lib/db';

// Helper to wrap async route handlers and catch errors
function asyncHandler(
  fn: (req: Request, res: Response, next: express.NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Import route modules
import { createAuthRoutes } from './routes/auth.routes';
import { createUsersRoutes } from './routes/users.routes';
import { createMarketplaceRoutes } from './routes/marketplace.routes';
import { createFriendsRoutes } from './routes/friends.routes';
import { createMessagesRoutes } from './routes/messages.routes';
import { createShareRoutes } from './routes/share.routes';
import { createNotificationsRoutes } from './routes/notifications.routes';
import { createSettingsRoutes } from './routes/settings.routes';
import { createShopRoutes } from './routes/shop.routes';
import { createStudioRoutes } from './routes/studio.routes';
import { createForumRoutes } from './routes/forum.routes';
import { createAdminRoutes } from './routes/admin.routes';
import type { RouteDependencies } from './routes/index';

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
  : (process.env.NODE_ENV === 'test' || process.env.VITEST ? getTestPort(3001) : 3001);
const DATA_DIR = process.env.DATA_DIR || './data';
const THUMBNAIL_DIR = path.join(DATA_DIR, 'thumbnails');
// Default frontend URLs: editor (5173) and platform (5174)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174';
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

const app: Express = express();

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
  manager.events.on(CurrencyEventNames.TRANSACTION_COMPLETED, (data) => {
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

// Trust proxy for correct IP and protocol detection behind reverse proxy
app.set('trust proxy', 1);

// Security headers middleware (must be early in the chain)
app.use(securityHeadersMiddleware);

// HTTPS enforcement in production
if (isProduction) {
  app.use((req: Request, res: Response, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// CORS configuration - hardened
const allowedOrigins = FRONTEND_URL.split(',').map((origin) => origin.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  })
);

// Body parser with default limit (can be overridden per route)
app.use(express.json({ limit: '10mb' })); // Default limit, increased per endpoint as needed

// Rate limiting for auth endpoints with security logging
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10), // Configurable, default 5
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    securityLogger.logRateLimitViolation(ip, '/api/auth/*', 5);
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
    });
  },
});

// Rate limiting for economy endpoints (anti-abuse) with security logging
const economyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.ECONOMY_RATE_LIMIT_MAX || '20', 10), // Configurable, default 20
  message: {
    error: 'Too many economy requests, slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    securityLogger.logRateLimitViolation(ip, req.path, 20);
    res.status(429).json({
      error: 'Too many economy requests, slow down.',
    });
  },
});

// Rate limiting for marketplace publishing (anti-spam)
const publishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 publishes per window
  message: {
    error: 'Too many publications, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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

  // Auto-seed marketplace if empty (development only)
  if (!isProduction) {
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

  const wsHandler = new WebSocketHandler(WS_PORT, sessionManager, authManager, messageHandler);
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

  // Async handler wrapper (for routes that don't catch errors)
  asyncHandler,

  // Economy config
  ECONOMY_MIN_PRICE,
  ECONOMY_PRICE_CHANGE_COOLDOWN_SEC,
  ECONOMY_LISTING_FEE,
  ECONOMY_PLATFORM_FEE_BPS,
};

// Register all route modules under /api prefix
app.use('/api/auth', createAuthRoutes(routeDeps));
app.use('/api/users', createUsersRoutes(routeDeps));
app.use('/api/marketplace', createMarketplaceRoutes(routeDeps));
app.use('/api/friends', createFriendsRoutes(routeDeps));
app.use('/api/messages', createMessagesRoutes(routeDeps));
app.use('/api/share', createShareRoutes(routeDeps));
app.use('/api/notifications', createNotificationsRoutes(routeDeps));
app.use('/api/settings', createSettingsRoutes(routeDeps));
app.use('/api/shop', createShopRoutes(routeDeps));
app.use('/api/studio', createStudioRoutes(routeDeps));
app.use('/api/forum', createForumRoutes(routeDeps));
app.use('/api/admin', createAdminRoutes(routeDeps));

/**
 * GET /api/projects/:token/preview
 * Get preview information for a shared project (used in forum link previews).
 */
app.get('/api/projects/:token/preview', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }
    const share = await storage.load(token);

    if (!share) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      token,
      createdAt: share.createdAt,
      title: (share.projectData as { title?: string } | undefined)?.title || 'Shared Project',
    });
  } catch (error) {
    console.error('Get project preview error:', error);
    res.status(500).json({
      error: 'Failed to get project preview',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Health check endpoint.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/**
 * Global error handler middleware (must be after all routes).
 * Catches unhandled errors and returns proper error responses.
 */
app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  // Handle known error types
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation failed',
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof BuildDataError) {
    return res.status(400).json({
      error: 'Build data error',
      message: err.message,
    });
  }

  if (err instanceof PayloadTooLargeError) {
    return res.status(413).json({
      error: 'Payload too large',
      message: err.message,
    });
  }

  if (err instanceof DatabaseError) {
    return res.status(500).json({
      error: 'Database error',
      message: isProduction ? 'Database operation failed' : err.message,
    });
  }

  // Handle JWT errors
  if (err instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication token is invalid',
    });
  }

  if (err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Authentication token has expired',
    });
  }

  // Generic error handler
  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = (err as { statusCode?: number })?.statusCode || 500;

  res.status(status).json({
    error: 'Internal server error',
    message: isProduction && status === 500 ? 'An unexpected error occurred' : message,
    ...(isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
});

/**
 * 404 handler (must be after all routes and error handler).
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
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
  dbPool,
};

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`Net server listening on http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}
