/**
 * @vitest-environment node
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createGamesRoutes } from '../games.routes.js';
import type { RouteDependencies } from '../index.js';
import type { StudioProject, StudioProjectsStorage } from '../../storage/StudioProjectsStorage.js';
import type { MarketplaceItem, MarketplaceStorage } from '../../storage/MarketplaceStorage.js';

interface TestContext {
  projects: StudioProject[];
  marketplaceItems: MarketplaceItem[];
  playersByGame: Record<string, number>;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('Games routes - discoverability', () => {
  let app: FastifyInstance;
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = Fastify();
    await app.register(createGamesRoutes, {
      prefix: '/api/games',
      dependencies: createMockDependencies(ctx),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns discover payload with sections populated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/games/discover',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body) as {
      featured: any[];
      categories: any[];
      fresh: { games: any[] };
      curated: any[];
      fairness: { slots: any[] };
    };

    expect(Array.isArray(data.featured)).toBe(true);
    expect(data.featured.length).toBeGreaterThan(0);
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.fresh.games.every((game) => typeof game.publishedHoursAgo === 'number')).toBe(true);
    expect(data.curated.length).toBeGreaterThan(0);
    expect(data.fairness.slots.length).toBeGreaterThan(0);
  });

  it('boosts underexposed games in fairness slots', async () => {
    // Ensure we have at least one long-tail candidate
    const underdogItem = ctx.marketplaceItems.find((item) => item.id === 'item-underdog');
    if (underdogItem) {
      underdogItem.downloads = 4;
      underdogItem.likes = 1;
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/games/discover',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body) as {
      fairness: { slots: Array<{ game: { id: string }; boostMultiplier: number }> };
    };

    const fairnessIds = data.fairness.slots.map((slot) => slot.game.id);
    expect(fairnessIds).toContain('item-underdog');

    const underdogSlot = data.fairness.slots.find((slot) => slot.game.id === 'item-underdog');
    expect(underdogSlot).toBeDefined();
    expect(underdogSlot?.boostMultiplier).toBeGreaterThan(1);
  });

  it('still supports classic listing endpoint with pagination', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/games?limit=2&sortBy=popular',
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as { items: { id: string }[]; total: number; limit: number };

    expect(payload.items.length).toBeLessThanOrEqual(2);
    expect(payload.total).toBeGreaterThanOrEqual(payload.items.length);
  });
});

function createTestContext(): TestContext {
  const now = Date.now();

  const projects: StudioProject[] = [
    makeProject({
      id: 'proj-1',
      userId: 'user-1',
      name: 'Arena Blitz',
      marketplaceId: 'item-arena',
      createdAt: now - DAY_MS * 2,
      updatedAt: now - HOUR_MS * 6,
      tags: ['PvP', 'Arena'],
    }),
    makeProject({
      id: 'proj-2',
      userId: 'user-2',
      name: 'Cozy Builders',
      marketplaceId: 'item-builder',
      createdAt: now - DAY_MS * 5,
      updatedAt: now - DAY_MS,
      tags: ['Builder', 'Creative'],
    }),
    makeProject({
      id: 'proj-3',
      userId: 'user-3',
      name: 'Star Caravan',
      marketplaceId: 'item-adventure',
      createdAt: now - DAY_MS * 10,
      updatedAt: now - DAY_MS * 2,
      tags: ['Adventure', 'Story'],
    }),
    makeProject({
      id: 'proj-4',
      userId: 'user-4',
      name: 'Club Night',
      marketplaceId: 'item-social',
      createdAt: now - DAY_MS,
      updatedAt: now - HOUR_MS * 2,
      tags: ['Social', 'Hangout'],
    }),
    makeProject({
      id: 'proj-5',
      userId: 'user-5',
      name: 'Underdog Quest',
      marketplaceId: 'item-underdog',
      createdAt: now - DAY_MS * 3,
      updatedAt: now - DAY_MS,
      tags: ['Adventure'],
    }),
  ];

  const marketplaceItems: MarketplaceItem[] = [
    makeItem({
      id: 'item-arena',
      title: 'Arena Blitz',
      authorId: 'user-1',
      tags: ['pvp', 'arena', 'combat'],
      downloads: 120,
      likes: 48,
      createdAt: now - DAY_MS * 2,
    }),
    makeItem({
      id: 'item-builder',
      title: 'Cozy Builders',
      authorId: 'user-2',
      tags: ['builder', 'creative', 'sandbox'],
      downloads: 80,
      likes: 30,
      createdAt: now - DAY_MS * 5,
    }),
    makeItem({
      id: 'item-adventure',
      title: 'Star Caravan',
      authorId: 'user-3',
      tags: ['adventure', 'story'],
      downloads: 60,
      likes: 22,
      createdAt: now - DAY_MS * 10,
    }),
    makeItem({
      id: 'item-social',
      title: 'Club Night',
      authorId: 'user-4',
      tags: ['social', 'hangout'],
      downloads: 40,
      likes: 15,
      createdAt: now - DAY_MS,
    }),
    makeItem({
      id: 'item-underdog',
      title: 'Underdog Quest',
      authorId: 'user-5',
      tags: ['adventure'],
      downloads: 15,
      likes: 5,
      createdAt: now - DAY_MS * 3,
    }),
  ];

  const playersByGame: Record<string, number> = {
    'item-arena': 35,
    'item-builder': 12,
    'item-adventure': 6,
    'item-social': 20,
    'item-underdog': 2,
  };

  return { projects, marketplaceItems, playersByGame };
}

function makeProject({
  id,
  userId,
  name,
  marketplaceId,
  createdAt,
  updatedAt,
  tags,
}: {
  id: string;
  userId: string;
  name: string;
  marketplaceId: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}): StudioProject {
  return {
    id,
    userId,
    name,
    description: `${name} description`,
    projectData: { metadata: { marketplaceItemId: marketplaceId } } as any,
    thumbnailUrl: `/thumbs/${id}.png`,
    isPublished: true,
    createdAt,
    updatedAt,
    version: 1,
    tags,
  };
}

function makeItem({
  id,
  title,
  authorId,
  tags,
  downloads,
  likes,
  createdAt,
}: {
  id: string;
  title: string;
  authorId: string;
  tags: string[];
  downloads: number;
  likes: number;
  createdAt: number;
}): MarketplaceItem {
  return {
    id,
    type: 'build',
    title,
    description: `${title} description`,
    authorId,
    authorName: `${authorId}-name`,
    thumbnailUrl: `/thumbs/${id}.png`,
    fileUrl: `/files/${id}.bin`,
    tags,
    createdAt,
    updatedAt: createdAt,
    downloads,
    likes,
    public: true,
  };
}

function createMockDependencies(context: TestContext): RouteDependencies {
  const studioProjectsStorage = {
    listPublishedProjectsGlobal: vi.fn(async () => context.projects),
    updateProject: vi.fn(async () => {}),
  } as unknown as StudioProjectsStorage;

  const marketplaceStorage = {
    getItems: vi.fn(async () => context.marketplaceItems),
  } as unknown as MarketplaceStorage;

  const gameSessionTracker = {
    getPlayerCount: (gameId: string) => context.playersByGame[gameId] ?? 0,
  } as any;

  return {
    authManager: {} as any,
    authMiddleware: async () => {},
    requireAdmin: () => async () => {},
    requireModerator: () => async () => {},
    sessionManager: {} as any,
    gameSessionTracker,
    messageHandler: {} as any,
    forumHandler: {} as any,
    storage: {} as any,
    profileStorage: {} as any,
    marketplaceStorage: marketplaceStorage as any,
    buildStorage: null,
    likesStorage: {} as any,
    resaleStorage: null,
    friendsStorage: {} as any,
    messagesStorage: {} as any,
    blockedUsersStorage: {} as any,
    notificationsStorage: {} as any,
    userSettingsStorage: {} as any,
    forumStorage: {} as any,
    supportStorage: {} as any,
    newsStorage: {} as any,
    releaseStorage: {} as any,
    githubService: {} as any,
    shopStorage: {} as any,
    assetStorage: {} as any,
    purchaseStorage: {} as any,
    studioProjectsStorage,
    studioTeamStorage: {} as any,
    studioSettingsStorage: {} as any,
    avatarStorage: {} as any,
    currencyService: {} as any,
    purchaseService: {} as any,
    ledgerService: {} as any,
    isProduction: false,
    THUMBNAIL_DIR: '',
    FRONTEND_URL: '',
    generateAndSaveThumbnail: async () => '',
    dbPool: null,
    path: {} as any,
    fs: {} as any,
    cacheGet: () => null,
    cacheSet: () => {},
    userCarts: new Map(),
    resaleListings: new Map(),
    authLimiter: { max: 5, timeWindow: '1m', errorResponseBuilder: () => ({ error: '' }) },
    economyLimiter: { max: 5, timeWindow: '1m', errorResponseBuilder: () => ({ error: '' }) },
    publishLimiter: { max: 5, timeWindow: '1m', errorResponseBuilder: () => ({ error: '' }) },
    marketplaceLikeLimiter: { max: 5, timeWindow: '1m', errorResponseBuilder: () => ({ error: '' }) },
    securityLogger: {
      logAuthSuccess: () => {},
      logAuthFailure: () => {},
      logRateLimitViolation: () => {},
    },
    getUserIdFromToken: async () => null,
    ValidationError: class extends Error {},
    BuildDataError: class extends Error {},
    PayloadTooLargeError: class extends Error {},
    DatabaseError: class extends Error {},
    sanitizeMarketplacePublishRequest: (body: Record<string, unknown>) => body,
    publishItemSchema: {} as any,
    resaleListingSchema: {} as any,
    searchQuerySchema: {} as any,
    marketplaceItemIdParamSchema: {} as any,
    validateQuery: () => async () => {},
    ECONOMY_MIN_PRICE: {},
    ECONOMY_PRICE_CHANGE_COOLDOWN_SEC: 0,
    ECONOMY_LISTING_FEE: {},
    ECONOMY_PLATFORM_FEE_BPS: 0,
  };
}

