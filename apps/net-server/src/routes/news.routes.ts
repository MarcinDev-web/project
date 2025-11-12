/**
 * Public News Routes - for regular users to view published news
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RouteDependencies } from './index.js';

/**
 * Create public news routes for Fastify
 */
export async function createNewsRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { newsStorage, profileStorage } = opts.dependencies;

  // Get published news items (public, no auth required)
  app.get('/news', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        limit?: string | number;
        offset?: string | number;
        search?: string;
      };
      const limit = query.limit ? parseInt(String(query.limit), 10) : 20;
      const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
      const search = query.search;

      const result = await newsStorage.getNews({
        limit,
        offset,
        published: true, // Only published news
        search,
      });

      // Enrich with author names
      const enrichedNews = await Promise.all(
        result.news.map(async (item) => {
          const profile = await profileStorage.getProfile(item.authorId);
          return {
            ...item,
            authorName: profile?.username || item.authorId,
          };
        })
      );

      reply.send({
        news: enrichedNews,
        total: result.total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get news error:', error);
      reply.code(500).send({
        error: 'Failed to get news',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get single news item (public, no auth required)
  app.get<{ Params: { id: string } }>('/news/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const newsItem = await newsStorage.getNewsItem(id);

      if (!newsItem) {
        return reply.code(404).send({ error: 'News item not found' });
      }

      // Only return published news
      if (!newsItem.published) {
        return reply.code(404).send({ error: 'News item not found' });
      }

      // Enrich with author name
      const profile = await profileStorage.getProfile(newsItem.authorId);
      reply.send({
        ...newsItem,
        authorName: profile?.username || newsItem.authorId,
      });
    } catch (error) {
      console.error('Get news item error:', error);
      reply.code(500).send({
        error: 'Failed to get news item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

