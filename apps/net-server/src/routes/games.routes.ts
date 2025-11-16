import type { FastifyInstance } from 'fastify';
import type { RouteDependencies } from './index.js';
import type { StudioProject } from '../storage/StudioProjectsStorage.js';
import type { MarketplaceItem } from '../storage/MarketplaceStorage.js';

interface GamesQuery {
  limit?: number | string;
  offset?: number | string;
  sortBy?: 'newest' | 'updated' | 'popular' | 'trending';
  search?: string;
  tags?: string;
}

export interface GameSummary {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  authorId: string;
  authorName?: string;
  thumbnailUrl?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  downloads: number;
  likes: number;
  playersOnline: number;
}

export interface GamesResponse {
  items: GameSummary[];
  total: number;
  limit: number;
  offset: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FRESH_WINDOW_DAYS = 7;
const MAX_FRESH_GAMES = 12;
const MAX_CATEGORY_GAMES = 6;
const MAX_FEATURED_GAMES = 6;
const FAIRNESS_SLOT_COUNT = 8;
const LONG_TAIL_MAX_EXPOSURE = 800;

interface DiscoverCategoryDefinition {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  tags: string[];
}

interface DiscoverCategorySection extends DiscoverCategoryDefinition {
  games: GameSummary[];
}

interface CuratedTheme {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  preferNewerThanDays?: number;
  minLikes?: number;
}

interface CuratedPick {
  id: string;
  title: string;
  description: string;
  tags: string[];
  game: GameSummary | null;
  reason: string;
}

interface FairnessSlot {
  slot: number;
  game: GameSummary;
  boostMultiplier: number;
  score: number;
  exposureDebt: number;
  expectedExposure: number;
  actualExposure: number;
  reason: string;
}

interface DiscoverResponse {
  generatedAt: number;
  totalGames: number;
  featured: GameSummary[];
  categories: DiscoverCategorySection[];
  fresh: {
    windowDays: number;
    games: Array<GameSummary & { freshnessScore: number; publishedHoursAgo: number }>;
  };
  curated: CuratedPick[];
  fairness: {
    strategy: string;
    slots: FairnessSlot[];
  };
}

const DISCOVERY_CATEGORIES: DiscoverCategoryDefinition[] = [
  {
    id: 'pvp',
    title: 'Competitive PvP',
    tagline: 'Arenas, duels, and high-intensity combat.',
    icon: '⚔️',
    tags: ['pvp', 'arena', 'battle', 'combat', 'shooter'],
  },
  {
    id: 'builders',
    title: 'Builder Sanctuaries',
    tagline: 'Creative sandboxes, sims, and tycoons.',
    icon: '🛠️',
    tags: ['builder', 'creative', 'sandbox', 'tycoon', 'city', 'sim'],
  },
  {
    id: 'social',
    title: 'Social Hangouts',
    tagline: 'Chill spaces and roleplay hubs.',
    icon: '🎉',
    tags: ['social', 'hangout', 'club', 'roleplay', 'rp', 'chill'],
  },
  {
    id: 'adventure',
    title: 'Adventure & Story',
    tagline: 'Narrative quests and explorations.',
    icon: '🧭',
    tags: ['adventure', 'story', 'quest', 'rpg', 'exploration'],
  },
  {
    id: 'quickplay',
    title: 'Quick Play Sessions',
    tagline: 'Five-minute fun, party, and arcade modes.',
    icon: '⚡',
    tags: ['arcade', 'runner', 'party', 'mini-game', 'casual'],
  },
];

const CURATED_THEMES: CuratedTheme[] = [
  {
    id: 'staff-spotlight',
    title: 'Forge Team Spotlight',
    description: 'High polish experiences we keep returning to.',
    minLikes: 20,
    preferNewerThanDays: 45,
  },
  {
    id: 'builders-choice',
    title: "Builder's Choice",
    description: 'Standout creative tools and sandboxes.',
    tags: ['builder', 'creative', 'sandbox', 'tycoon', 'sim'],
  },
  {
    id: 'high-intensity',
    title: 'High-Intensity PvP',
    description: 'Skill-demanding arenas and ranked play.',
    tags: ['pvp', 'arena', 'combat', 'shooter'],
    preferNewerThanDays: 30,
  },
  {
    id: 'social-nights',
    title: 'Social Nights',
    description: 'Cozy hangouts for squads and communities.',
    tags: ['social', 'hangout', 'roleplay', 'co-op', 'multiplayer'],
  },
];

function parseNumber(value: number | string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function buildSummary(
  project: StudioProject,
  item: MarketplaceItem,
  playersOnline: number
): GameSummary {
  const description = item.description ?? project.description;
  const thumbnailUrl = item.thumbnailUrl ?? project.thumbnailUrl;
  return {
    id: item.id,
    projectId: project.id,
    title: item.title || project.name,
    ...(description !== undefined && { description }),
    authorId: item.authorId,
    ...(item.authorName !== undefined && { authorName: item.authorName }),
    ...(thumbnailUrl !== undefined && { thumbnailUrl }),
    tags: Array.from(new Set([...(item.tags || []), ...((project.tags as string[] | undefined) ?? [])])),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    downloads: item.downloads ?? 0,
    likes: item.likes ?? 0,
    playersOnline,
  };
}

function sortGames(games: GameSummary[], sortBy: 'newest' | 'updated' | 'popular' | 'trending'): void {
  switch (sortBy) {
    case 'updated':
      games.sort((a, b) => b.updatedAt - a.updatedAt);
      break;
    case 'popular':
      games.sort((a, b) => {
        const scoreA = a.downloads * 2 + a.likes;
        const scoreB = b.downloads * 2 + b.likes;
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        return b.updatedAt - a.updatedAt;
      });
      break;
    case 'trending':
      games.sort((a, b) => {
        if (a.playersOnline !== b.playersOnline) {
          return b.playersOnline - a.playersOnline;
        }
        const momentumA = a.downloads + a.likes;
        const momentumB = b.downloads + b.likes;
        if (momentumA !== momentumB) {
          return momentumB - momentumA;
        }
        return b.updatedAt - a.updatedAt;
      });
      break;
    case 'newest':
    default:
      games.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function hasMatchingTags(game: GameSummary, tags: string[]): boolean {
  if (tags.length === 0) {
    return false;
  }
  const tagSet = new Set(game.tags.map(normalizeTag));
  return tags.some((tag) => tagSet.has(normalizeTag(tag)));
}

function computeQualityScore(game: GameSummary, now: number): number {
  const likes = game.likes ?? 0;
  const downloads = game.downloads ?? 0;
  const players = game.playersOnline ?? 0;
  const recencyDays = Math.max(0, (now - game.updatedAt) / DAY_MS);
  const recencyWeight = Math.max(0, 1.5 - recencyDays / 14);
  return likes * 4 + downloads * 0.6 + players * 35 + recencyWeight * 120;
}

function computeFreshnessScore(game: GameSummary, now: number): number {
  const hoursSincePublish = Math.max(1, (now - game.createdAt) / HOUR_MS);
  const momentum = (game.likes ?? 0) * 4 + (game.playersOnline ?? 0) * 25;
  const decay = Math.max(0.15, 48 / hoursSincePublish);
  return momentum * decay;
}

interface FairnessCandidate {
  game: GameSummary;
  fairnessScore: number;
  fairnessBoost: number;
  exposureDebt: number;
  expectedExposure: number;
  actualExposure: number;
  ageHours: number;
}

function buildFairnessReason(candidate: FairnessCandidate): string {
  const ageDays = candidate.ageHours / 24;
  const boostPercent = Math.round(candidate.fairnessBoost * 100);
  const debt = Math.max(0, Math.round(candidate.exposureDebt));
  if (debt <= 0) {
    return 'Balanced exposure – boosting diversity';
  }
  const ageLabel = ageDays < 1 ? '<24h' : `${Math.round(ageDays)}d`;
  return `+${boostPercent}% boost · ${debt} exposure gap after ${ageLabel}`;
}

function computeFairnessSlots(games: GameSummary[], now: number): { strategy: string; slots: FairnessSlot[] } {
  if (games.length === 0) {
    return {
      strategy: 'No games available',
      slots: [],
    };
  }

  const candidates: FairnessCandidate[] = games.map((game) => {
    const ageHours = Math.max(1, (now - game.createdAt) / HOUR_MS);
    const actualExposure =
      (game.downloads ?? 0) + (game.likes ?? 0) * 4 + (game.playersOnline ?? 0) * 25;
    const expectedExposure = Math.pow(ageHours, 0.7) * 35;
    const exposureDebt = Math.max(0, expectedExposure - actualExposure);
    const fairnessBoost = exposureDebt / (expectedExposure + 1);
    const fairnessScore = (computeQualityScore(game, now) + 50) * (1 + fairnessBoost);
    return {
      game,
      fairnessScore,
      fairnessBoost,
      exposureDebt,
      expectedExposure,
      actualExposure,
      ageHours,
    };
  });

  const longTailPool = candidates.filter(
    (candidate) => candidate.actualExposure < LONG_TAIL_MAX_EXPOSURE
  );
  const pool = (longTailPool.length > 0 ? longTailPool : candidates)
    .sort((a, b) => b.fairnessScore - a.fairnessScore)
    .slice(0, FAIRNESS_SLOT_COUNT);

  const slots: FairnessSlot[] = pool.map((candidate, index) => ({
    slot: index + 1,
    game: candidate.game,
    boostMultiplier: Number((1 + candidate.fairnessBoost).toFixed(2)),
    score: Number(candidate.fairnessScore.toFixed(2)),
    exposureDebt: Math.round(candidate.exposureDebt),
    expectedExposure: Math.round(candidate.expectedExposure),
    actualExposure: Math.round(candidate.actualExposure),
    reason: buildFairnessReason(candidate),
  }));

  return {
    strategy: 'Blending quality score with exposure debt to boost under-served games',
    slots,
  };
}

function computeCategorySections(games: GameSummary[], now: number): DiscoverCategorySection[] {
  return DISCOVERY_CATEGORIES.map((definition) => {
    const matches = games
      .filter((game) => hasMatchingTags(game, definition.tags))
      .sort((a, b) => computeQualityScore(b, now) - computeQualityScore(a, now))
      .slice(0, MAX_CATEGORY_GAMES);

    return {
      ...definition,
      games: matches,
    };
  }).filter((section) => section.games.length > 0);
}

function computeCuratedPicks(games: GameSummary[], now: number): CuratedPick[] {
  const usedIds = new Set<string>();

  return CURATED_THEMES.map((theme) => {
    const matches = games.filter((game) => {
      if (theme.tags && theme.tags.length > 0 && !hasMatchingTags(game, theme.tags)) {
        return false;
      }
      if (theme.minLikes !== undefined && (game.likes ?? 0) < theme.minLikes) {
        return false;
      }
      return true;
    });

    const scored = matches
      .map((game) => {
        const base = computeQualityScore(game, now);
        if (!theme.preferNewerThanDays) {
          return { game, score: base };
        }
        const ageDays = Math.max(0, (now - game.createdAt) / DAY_MS);
        const recencyBonus = Math.max(0, theme.preferNewerThanDays - ageDays) * 8;
        return { game, score: base + recencyBonus };
      })
      .sort((a, b) => b.score - a.score);

    const pick = scored.find((entry) => !usedIds.has(entry.game.id));
    if (pick) {
      usedIds.add(pick.game.id);
    }

    return {
      id: theme.id,
      title: theme.title,
      description: theme.description,
      tags: theme.tags ?? [],
      game: pick?.game ?? null,
      reason: pick
        ? `Top score ${Math.round(pick.score)} with ${pick.game.likes} likes`
        : 'No eligible games yet',
    };
  });
}

function computeFreshDrops(
  games: GameSummary[],
  now: number
): DiscoverResponse['fresh'] {
  const freshWindowMs = FRESH_WINDOW_DAYS * DAY_MS;
  const freshGames = games
    .filter((game) => now - game.createdAt <= freshWindowMs)
    .map((game) => {
      const hours = Math.max(1, (now - game.createdAt) / HOUR_MS);
      const freshnessScore = computeFreshnessScore(game, now);
      return {
        ...game,
        freshnessScore,
        publishedHoursAgo: Math.round(hours),
      };
    })
    .sort((a, b) => b.freshnessScore - a.freshnessScore)
    .slice(0, MAX_FRESH_GAMES);

  return {
    windowDays: FRESH_WINDOW_DAYS,
    games: freshGames,
  };
}

function buildFeaturedSet(
  games: GameSummary[],
  fairness: { slots: FairnessSlot[] },
  now: number
): GameSummary[] {
  const picks: GameSummary[] = [];
  const seen = new Set<string>();

  const push = (game: GameSummary | undefined): void => {
    if (!game) return;
    if (seen.has(game.id)) return;
    picks.push(game);
    seen.add(game.id);
  };

  const trending = [...games]
    .sort((a, b) => computeQualityScore(b, now) - computeQualityScore(a, now))
    .slice(0, MAX_FEATURED_GAMES);

  trending.forEach((game) => push(game));
  fairness.slots.slice(0, 2).forEach((slot) => push(slot.game));

  return picks.slice(0, MAX_FEATURED_GAMES);
}

async function fetchGameSummaries(
  dependencies: RouteDependencies,
  filters?: { search?: string; tags?: string[] }
): Promise<GameSummary[]> {
  const { studioProjectsStorage, marketplaceStorage, gameSessionTracker } = dependencies;

  const search = filters?.search?.trim();
  const tagList = filters?.tags?.map(normalizeTag).filter((tag) => tag.length > 0) ?? [];

  const publishedProjects = await studioProjectsStorage.listPublishedProjectsGlobal({
    ...(search && { search }),
    ...(tagList.length > 0 && { tags: tagList }),
  });

  if (!publishedProjects.length) {
    return [];
  }

  const marketplaceBuilds = await marketplaceStorage.getItems({
    type: 'build',
    public: true,
    limit: 1000,
  });

  const buildsById = new Map<string, MarketplaceItem>();
  const buildsByAuthor = new Map<string, MarketplaceItem[]>();

  for (const item of marketplaceBuilds) {
    buildsById.set(item.id, item);
    const list = buildsByAuthor.get(item.authorId) ?? [];
    list.push(item);
    buildsByAuthor.set(item.authorId, list);
  }

  const summaries: GameSummary[] = [];

  for (const project of publishedProjects) {
    const metadata = project.projectData?.metadata ?? {};
    const candidateIds = new Set<string>();
    if (metadata.marketplaceItemId) {
      candidateIds.add(metadata.marketplaceItemId);
    }

    let linkedItem: MarketplaceItem | undefined;
    for (const id of candidateIds) {
      const match = buildsById.get(id);
      if (match && match.type === 'build') {
        linkedItem = match;
        break;
      }
    }

    if (!linkedItem) {
      const candidates = buildsByAuthor.get(project.userId) ?? [];
      linkedItem = candidates.find((candidate) => candidate.title === project.name);
      if (!linkedItem) {
        linkedItem = candidates.find((candidate) =>
          candidate.description?.includes(project.name)
        );
      }
    }

    if (!linkedItem) {
      continue;
    }

    if (!metadata.marketplaceItemId) {
      const backfilledData: StudioProject['projectData'] = {
        ...project.projectData,
        metadata: {
          ...metadata,
          marketplaceItemId: linkedItem.id,
        },
      };
      try {
        await studioProjectsStorage.updateProject(project.userId, project.id, {
          projectData: backfilledData,
        });
      } catch (error) {
        console.error(
          'Failed to backfill marketplaceItemId for project',
          project.id,
          error
        );
      }
    }

    const playersOnline = gameSessionTracker.getPlayerCount(linkedItem.id);
    summaries.push(buildSummary(project, linkedItem, playersOnline));
  }

  if (search && search.length > 0) {
    const term = search.toLowerCase();
    const filtered = summaries.filter((summary) => {
      const titleMatch = summary.title.toLowerCase().includes(term);
      const descriptionMatch = summary.description
        ? summary.description.toLowerCase().includes(term)
        : false;
      const authorMatch = summary.authorName
        ? summary.authorName.toLowerCase().includes(term)
        : false;
      return titleMatch || descriptionMatch || authorMatch;
    });
    summaries.splice(0, summaries.length, ...filtered);
  }

  if (tagList.length > 0) {
    const filtered = summaries.filter((summary) =>
      summary.tags.some((tag) => tagList.includes(normalizeTag(tag)))
    );
    summaries.splice(0, summaries.length, ...filtered);
  }

  return summaries;
}

export async function createGamesRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { dependencies } = opts;

  app.get('/', async (request, reply) => {
    try {
      const { limit: rawLimit, offset: rawOffset, sortBy: rawSort, search, tags } =
        request.query as GamesQuery;

      const limit = parseNumber(rawLimit, 20, 1, 100);
      const offset = parseNumber(rawOffset, 0, 0, 1000);
      const sortBy: 'newest' | 'updated' | 'popular' | 'trending' =
        rawSort && ['newest', 'updated', 'popular', 'trending'].includes(rawSort)
          ? rawSort
          : 'newest';

      const tagList =
        typeof tags === 'string' && tags.length > 0
          ? tags.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0)
          : [];

      const summaries = await fetchGameSummaries(dependencies, {
        search,
        tags: tagList,
      });

      if (summaries.length === 0) {
        const empty: GamesResponse = {
          items: [],
          total: 0,
          limit,
          offset,
        };
        return reply.send(empty);
      }

      sortGames(summaries, sortBy);

      const total = summaries.length;
      const paginated = summaries.slice(offset, offset + limit);

      const response: GamesResponse = {
        items: paginated,
        total,
        limit,
        offset,
      };

      reply.send(response);
    } catch (error) {
      console.error('Failed to list games:', error);
      reply.code(500).send({
        error: 'Failed to load games',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/discover', async (_request, reply) => {
    try {
      const games = await fetchGameSummaries(dependencies);
      const now = Date.now();
      const fairness = computeFairnessSlots(games, now);
      const categories = computeCategorySections(games, now);
      const fresh = computeFreshDrops(games, now);
      const curated = computeCuratedPicks(games, now);
      const featured = buildFeaturedSet(games, fairness, now);

      const response: DiscoverResponse = {
        generatedAt: now,
        totalGames: games.length,
        featured,
        categories,
        fresh,
        curated,
        fairness,
      };

      reply.send(response);
    } catch (error) {
      console.error('Failed to build discovery payload:', error);
      reply.code(500).send({
        error: 'Failed to load discovery data',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
