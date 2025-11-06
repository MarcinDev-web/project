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

export async function createGamesRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { dependencies } = opts;
  const {
    studioProjectsStorage,
    marketplaceStorage,
    gameSessionTracker,
  } = dependencies;

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

      const publishedProjects = await studioProjectsStorage.listPublishedProjectsGlobal({
        ...(search && { search }),
        ...(tagList.length > 0 && { tags: tagList }),
      });

      if (!publishedProjects.length) {
        const empty: GamesResponse = {
          items: [],
          total: 0,
          limit,
          offset,
        };
        return reply.send(empty);
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

      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        summaries.splice(
          0,
          summaries.length,
          ...summaries.filter((summary) => {
            const titleMatch = summary.title.toLowerCase().includes(term);
            const descriptionMatch = summary.description
              ? summary.description.toLowerCase().includes(term)
              : false;
            const authorMatch = summary.authorName
              ? summary.authorName.toLowerCase().includes(term)
              : false;
            return titleMatch || descriptionMatch || authorMatch;
          })
        );
      }

      if (tagList.length > 0) {
        const requiredTags = new Set(tagList.map((tag) => tag.toLowerCase()));
        summaries.splice(
          0,
          summaries.length,
          ...summaries.filter((summary) =>
            summary.tags.some((tag) => requiredTags.has(tag.toLowerCase()))
          )
        );
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
}
