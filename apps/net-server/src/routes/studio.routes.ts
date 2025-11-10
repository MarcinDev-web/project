import type { FastifyInstance } from 'fastify';
import type { RouteDependencies } from './index.js';
import type { StudioProject } from '../storage/StudioProjectsStorage.js';
import type { ProjectTeamAccess } from '../storage/StudioTeamStorage.js';
import type { MarketplaceItem } from '../storage/MarketplaceStorage.js';
import type { CreateAvatarPresetRequest } from '../storage/AvatarStorage.js';
import type { ProjectData } from '../types.js';

/**
 * Create studio routes for Fastify
 */
export async function createStudioRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const {
    authMiddleware,
    studioProjectsStorage,
    studioTeamStorage,
    studioSettingsStorage,
    marketplaceStorage,
    buildStorage,
    purchaseStorage,
    profileStorage,
    authManager,
    friendsStorage,
    notificationsStorage,
    avatarStorage,
    cacheGet,
    cacheSet,
    dbPool,
  } = opts.dependencies;

  // Helper function: periodToDays
  function periodToDays(period: string | undefined): number {
    switch (period) {
      case 'week':
        return 7;
      case 'quarter':
        return 90;
      case 'month':
      default:
        return 30;
    }
  }

  // Helper function: computeStudioScore
  async function computeStudioScore(userId: string): Promise<{
    score: number;
    breakdown: {
      revenueVelocity: number;
      shippingCadence: number;
      customerLove: number;
      portfolioBreadth: number;
      communityImpact: number;
    };
  }> {
    // Revenue (30d net) → log normalized up to 10k
    const rev = await (async () => {
      const cached = cacheGet<any>(`rev:${userId}:30`);
      if (cached) return cached;
      return null;
    })();

    let net30 = 0;
    if (rev && typeof rev.net === 'number') {
      net30 = rev.net;
    } else {
      // Compute quickly if not in cache
      const allPurchases = await purchaseStorage.getPurchases({
        status: 'completed',
        limit: 100000,
      });
      const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const p of allPurchases) {
        if (p.createdAt < since) continue;
        for (const it of p.items) {
          if (it.type !== 'marketplace-item') continue;
          const mp = await marketplaceStorage.getItem(it.itemId);
          if (!mp || mp.authorId !== userId) continue;
          net30 += Number(it.price.amount) * 0.9;
        }
      }
    }

    const revenueVelocity = Math.min(
      100,
      Math.round((Math.log10(1 + net30) / Math.log10(1 + 10000)) * 100)
    );

    // ShippingCadence
    const now = Date.now();
    const since90 = now - 90 * 24 * 60 * 60 * 1000;
    const since30 = now - 30 * 24 * 60 * 60 * 1000;
    const builds90 = await marketplaceStorage.getItems({ authorId: userId, type: 'build' });
    const releases90 = builds90.filter((b) => b.createdAt && b.createdAt >= since90).length;
    const userProjects = await studioProjectsStorage.listProjects(userId, {
      limit: 10000,
      offset: 0,
    });
    const updates30 = userProjects.filter((p) => p.updatedAt >= since30).length;
    const cadenceTarget = 2;
    const shippingCadence = Math.min(
      100,
      Math.round(((releases90 / 3 + updates30 / (cadenceTarget || 1)) / 2) * 100)
    );

    // CustomerLove using likes/downloads ratio last 30d
    let likes = 0;
    let downloads = 0;
    for (const b of builds90) {
      if (!b.createdAt || b.createdAt < since30) continue;
      likes += b.likes || 0;
      downloads += b.downloads || 0;
    }
    const ratio = downloads > 0 ? likes / downloads : 0;
    const customerLove = Math.min(100, Math.round(ratio * 100));

    // PortfolioBreadth based on presence of both builds and other assets
    const allItems = await marketplaceStorage.getItems({ authorId: userId });
    const gamesCnt = allItems.filter((i) => i.type === 'build').length;
    const assetsCnt = allItems.filter((i) => i.type !== 'build').length;
    const breadth = gamesCnt > 0 && assetsCnt > 0 ? 1 : gamesCnt + assetsCnt > 0 ? 0.6 : 0;
    const portfolioBreadth = Math.round(breadth * 100);

    // CommunityImpact (placeholder 0 until we track followers/comments)
    const communityImpact = 0;

    const score = Math.round(
      0.4 * revenueVelocity +
        0.25 * shippingCadence +
        0.2 * customerLove +
        0.1 * portfolioBreadth +
        0.05 * communityImpact
    );

    return {
      score,
      breakdown: {
        revenueVelocity,
        shippingCadence,
        customerLove,
        portfolioBreadth,
        communityImpact,
      },
    };
  }

  // STUDIO PROJECTS ROUTES
  app.get('/projects', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const query = request.query as { limit?: number | string; offset?: number | string };
      const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
      const offset = query.offset ? parseInt(String(query.offset), 10) : 0;

      const projects = await studioProjectsStorage.listProjects(request.user.id, { limit, offset });
      reply.send({ projects });
    } catch (error) {
      console.error('List studio projects error:', error);
      reply.code(500).send({
        error: 'Failed to list projects',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/projects/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id?: string };
      if (!id) {
        return reply.code(400).send({ error: 'Project ID required' });
      }

      const project = await studioProjectsStorage.getProject(request.user.id, id);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      reply.send(project);
    } catch (error) {
      console.error('Get studio project error:', error);
      reply.code(500).send({
        error: 'Failed to get project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/projects', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as {
        name: string;
        description?: string;
        projectData: ProjectData;
        thumbnailUrl?: string;
        tags?: string[];
      };

      if (!body.name || typeof body.name !== 'string') {
        return reply.code(400).send({ error: 'Project name is required' });
      }

      if (!body.projectData || typeof body.projectData !== 'object') {
        return reply.code(400).send({ error: 'Project data is required' });
      }

      const project = await studioProjectsStorage.createProject(request.user.id, {
        name: body.name,
        ...(body.description && { description: body.description }),
        projectData: body.projectData,
        ...(body.thumbnailUrl && { thumbnailUrl: body.thumbnailUrl }),
        ...(body.tags && { tags: body.tags }),
      });

      reply.code(201).send(project);
    } catch (error) {
      console.error('Create studio project error:', error);
      reply.code(500).send({
        error: 'Failed to create project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put('/projects/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as Record<string, string>);
      if (!id) {
        return reply.code(400).send({ error: 'Project ID required' });
      }

      const body = request.body as {
        name?: string;
        description?: string;
        projectData?: ProjectData;
        thumbnailUrl?: string;
        tags?: string[];
        isPublished?: boolean;
      };

      const project = await studioProjectsStorage.updateProject(request.user.id, id, body);
      reply.send(project);
    } catch (error) {
      console.error('Update studio project error:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      reply.code(500).send({
        error: 'Failed to update project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete('/projects/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as Record<string, string>);
      if (!id) {
        return reply.code(400).send({ error: 'Project ID required' });
      }

      const deleted = await studioProjectsStorage.deleteProject(request.user.id, id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      reply.code(204).send();
    } catch (error) {
      console.error('Delete studio project error:', error);
      reply.code(500).send({
        error: 'Failed to delete project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post(
    '/studio/projects/:id/publish',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as Record<string, string>);
        if (!id) {
          return reply.code(400).send({ error: 'Project ID required' });
        }

        const body = request.body as {
          title: string;
          description?: string;
          tags?: string[];
          price?: { currency: string; amount: number };
        };

        if (!body.title || typeof body.title !== 'string') {
          return reply.code(400).send({ error: 'Title is required for publishing' });
        }

        const project = await studioProjectsStorage.getProject(request.user.id, id);
        if (!project) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        const profile = await profileStorage.getProfile(request.user.id);
        const user = await authManager.getUserById(request.user.id);
        const authorName = user?.username || profile?.displayName || user?.email || request.user.email;

        const marketplaceItemInput: Omit<
          MarketplaceItem,
          'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'likes'
        > = {
          type: 'build' as const,
          title: body.title,
          ...(body.description && { description: body.description }),
          ...(project.description && !body.description && { description: project.description }),
          authorId: request.user.id,
          ...(authorName && { authorName }),
          ...(project.thumbnailUrl && { thumbnailUrl: project.thumbnailUrl }),
          fileUrl: '',
          tags: body.tags || project.tags || [],
          public: true,
          ...(body.price && { price: body.price }),
        };

        const createdItem = await marketplaceStorage.createItem(marketplaceItemInput);

        const updatedProjectData = {
          ...project.projectData,
          metadata: {
            ...project.projectData.metadata,
            marketplaceItemId: createdItem.id,
          },
        };

        if (buildStorage) {
          await buildStorage.saveBuild(createdItem.id, updatedProjectData);
        }

        const updatedProject = await studioProjectsStorage.updateProject(request.user.id, id, {
          isPublished: true,
          projectData: updatedProjectData,
        });

        reply.code(201).send({
          marketplaceItem: createdItem,
          project: updatedProject,
        });
      } catch (error) {
        console.error('Publish studio project error:', error);
        reply.code(500).send({
          error: 'Failed to publish project',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get('/stats', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const counts = await studioProjectsStorage.countProjects(request.user.id);
      const userBuilds = await marketplaceStorage.getItems({
        authorId: request.user.id,
        type: 'build',
      });
      let totalViews = 0;
      let totalDownloads = 0;
      let totalLikes = 0;

      for (const build of userBuilds) {
        totalViews += build.downloads;
        totalDownloads += build.downloads;
        totalLikes += build.likes;
      }

      const stats = {
        userId: request.user.id,
        totalProjects: counts.total,
        publishedProjects: counts.published,
        totalViews,
        totalDownloads,
        totalLikes,
        lastUpdated: Date.now(),
      };

      const revCached = cacheGet<any>(`rev:${request.user.id}:30`);
      let netRevenue30d = revCached?.net ?? 0;
      if (revCached == null) {
        const allPurchases = await purchaseStorage.getPurchases({
          status: 'completed',
          limit: 100000,
        });
        const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (const p of allPurchases) {
          if (p.createdAt < since) continue;
          for (const it of p.items) {
            if (it.type !== 'marketplace-item') continue;
            const mp = await marketplaceStorage.getItem(it.itemId);
            if (!mp || mp.authorId !== request.user.id) continue;
            netRevenue30d += Number(it.price.amount) * 0.9;
          }
        }
      }
      const { score } = await computeStudioScore(request.user.id);

      reply.send({ ...stats, netRevenue30d, studioScore: score });
    } catch (error) {
      console.error('Get studio stats error:', error);
      reply.code(500).send({
        error: 'Failed to get studio stats',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/leaderboard', async (request, reply) => {
    try {
      const query = request.query as {
        metric?:
          | 'views'
          | 'downloads'
          | 'likes'
          | 'projects'
          | 'revenue'
          | 'score'
          | 'growth';
        period?: 'all' | 'week' | 'month';
        limit?: number | string;
      };
      const metric = query.metric || 'views';
      const period = query.period || 'all';
      const limit = query.limit ? parseInt(String(query.limit), 10) : 100;

      const allBuilds = await marketplaceStorage.getItems({ type: 'build' });

      const userStats = new Map<
        string,
        {
          userId: string;
          userName?: string;
          views: number;
          downloads: number;
          likes: number;
          projects: number;
        }
      >();

      for (const build of allBuilds) {
        const existingStats = userStats.get(build.authorId);
        const stats = existingStats || {
          userId: build.authorId,
          ...(build.authorName && { userName: build.authorName }),
          views: 0,
          downloads: 0,
          likes: 0,
          projects: 0,
        };
        stats.views += build.downloads;
        stats.downloads += build.downloads;
        stats.likes += build.likes;
        stats.projects += 1;
        userStats.set(build.authorId, stats);
      }

      let enriched: Array<{
        userId: string;
        userName?: string;
        views: number;
        downloads: number;
        likes: number;
        projects: number;
        revenue?: number;
        score?: number;
        growth?: number;
      }> = Array.from(userStats.values());

      if (metric === 'revenue' || metric === 'growth' || metric === 'score') {
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 30;

        const revenueByAuthor = new Map<string, number>();
        if (dbPool) {
          const rows = await dbPool.$queryRaw<Array<{ author_id: string; gross: string }>>`
            SELECT mi.author_id, SUM(pi.price_amount) AS gross
            FROM purchases p
            JOIN purchase_items pi ON pi.purchase_id = p.id
            JOIN marketplace_items mi ON mi.id = pi.item_id AND pi.item_type = 'marketplace-item'
            WHERE p.status = 'completed' AND p.created_at >= NOW() - INTERVAL '${String(days)} days'
            GROUP BY mi.author_id
          `;
          for (const r of rows) revenueByAuthor.set(r.author_id, Number(r.gross) * 0.9);
        } else {
          const allPurchases = await purchaseStorage.getPurchases({
            status: 'completed',
            limit: 100000,
          });
          const since = Date.now() - days * 24 * 60 * 60 * 1000;
          for (const p of allPurchases) {
            if (p.createdAt < since) continue;
            for (const it of p.items) {
              if (it.type !== 'marketplace-item') continue;
              const mp = await marketplaceStorage.getItem(it.itemId);
              if (!mp) continue;
              const cur = revenueByAuthor.get(mp.authorId) || 0;
              revenueByAuthor.set(mp.authorId, cur + Number(it.price.amount) * 0.9);
            }
          }
        }

        let growthByAuthor = new Map<string, number>();
        if (metric === 'growth') {
          if (dbPool) {
            const rows = await dbPool.$queryRaw<
              Array<{ author_id: string; period: string; gross: string }>
            >`
              WITH r AS (
                SELECT mi.author_id, CASE WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN 'cur' ELSE 'prev' END AS period,
                       SUM(pi.price_amount) AS gross
                FROM purchases p
                JOIN purchase_items pi ON pi.purchase_id = p.id
                JOIN marketplace_items mi ON mi.id = pi.item_id AND pi.item_type = 'marketplace-item'
                WHERE p.status = 'completed' AND p.created_at >= NOW() - INTERVAL '14 days'
                GROUP BY mi.author_id, CASE WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN 'cur' ELSE 'prev' END
              )
              SELECT author_id, period, gross FROM r
            `;
            const map = new Map<string, { cur: number; prev: number }>();
            for (const r of rows) {
              const m = map.get(r.author_id) || { cur: 0, prev: 0 };
              if (r.period === 'cur') m.cur = Number(r.gross) * 0.9;
              else m.prev = Number(r.gross) * 0.9;
              map.set(r.author_id, m);
            }
            growthByAuthor = new Map(
              Array.from(map.entries()).map(([k, v]) => [
                k,
                v.prev > 0 ? v.cur / v.prev - 1 : v.cur > 0 ? 1 : 0,
              ])
            );
          } else {
            const all = await purchaseStorage.getPurchases({ status: 'completed', limit: 100000 });
            const now = Date.now();
            const curSince = now - 7 * 24 * 60 * 60 * 1000;
            const prevSince = now - 14 * 24 * 60 * 60 * 1000;
            const map = new Map<string, { cur: number; prev: number }>();
            for (const p of all) {
              const inCur = p.createdAt >= curSince;
              const inPrev = p.createdAt >= prevSince && p.createdAt < curSince;
              if (!inCur && !inPrev) continue;
              for (const it of p.items) {
                if (it.type !== 'marketplace-item') continue;
                const mp = await marketplaceStorage.getItem(it.itemId);
                if (!mp) continue;
                const rec = map.get(mp.authorId) || { cur: 0, prev: 0 };
                const val = Number(it.price.amount) * 0.9;
                if (inCur) rec.cur += val;
                else if (inPrev) rec.prev += val;
                map.set(mp.authorId, rec);
              }
            }
            growthByAuthor = new Map(
              Array.from(map.entries()).map(([k, v]) => [
                k,
                v.prev > 0 ? v.cur / v.prev - 1 : v.cur > 0 ? 1 : 0,
              ])
            );
          }
        }

        enriched = enriched.map((e) => {
          const base = { ...e };
          const revenue = revenueByAuthor.get(e.userId) || 0;
          const growth = growthByAuthor.get(e.userId) || 0;
          const result: typeof base & { revenue?: number; growth?: number; score?: number } = {
            ...base,
            ...(revenue > 0 && { revenue }),
            ...(growth !== 0 && { growth }),
          };
          if (metric === 'score') {
            result.score = Math.round(
              0.6 * Math.min(100, (Math.log10(1 + revenue) / Math.log10(1 + 10000)) * 100) +
                0.4 * Math.min(100, e.downloads)
            );
          } else if ('score' in e && e.score !== undefined) {
            result.score = e.score;
          }
          return result;
        });
      }

      const leaderboard = enriched
        .sort((a, b) => {
          switch (metric) {
            case 'views':
              return b.views - a.views;
            case 'downloads':
              return b.downloads - a.downloads;
            case 'likes':
              return b.likes - a.likes;
            case 'projects':
              return b.projects - a.projects;
            case 'revenue':
              return (b.revenue || 0) - (a.revenue || 0);
            case 'score':
              return (b.score || 0) - (a.score || 0);
            case 'growth':
              return (b.growth || 0) - (a.growth || 0);
            default:
              return b.views - a.views;
          }
        })
        .slice(0, limit)
        .map((stat, index) => ({
          ...stat,
          rank: index + 1,
        }));

      reply.send({ leaderboard, metric, period });
    } catch (error) {
      console.error('Get studio leaderboard error:', error);
      reply.code(500).send({
        error: 'Failed to get leaderboard',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/compare/:userId', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { userId } = (request.params as Record<string, string>);
      if (!userId) {
        return reply.code(400).send({ error: 'User ID required' });
      }

      const currentUserCounts = await studioProjectsStorage.countProjects(request.user.id);
      const currentUserBuilds = await marketplaceStorage.getItems({
        authorId: request.user.id,
        type: 'build',
      });
      const currentUserStats = {
        userId: request.user.id,
        totalProjects: currentUserCounts.total,
        publishedProjects: currentUserCounts.published,
        totalViews: currentUserBuilds.reduce((sum, b) => sum + b.downloads, 0),
        totalDownloads: currentUserBuilds.reduce((sum, b) => sum + b.downloads, 0),
        totalLikes: currentUserBuilds.reduce((sum, b) => sum + b.likes, 0),
      };

      let comparedUserCounts = { total: 0, published: 0 };
      try {
        comparedUserCounts = await studioProjectsStorage.countProjects(userId);
      } catch {
        // User might not have studio yet
      }
      const comparedUserBuilds = await marketplaceStorage.getItems({
        authorId: userId,
        type: 'build',
      });
      const comparedUserStats = {
        userId,
        totalProjects: comparedUserCounts.total,
        publishedProjects: comparedUserCounts.published,
        totalViews: comparedUserBuilds.reduce((sum, b) => sum + b.downloads, 0),
        totalDownloads: comparedUserBuilds.reduce((sum, b) => sum + b.downloads, 0),
        totalLikes: comparedUserBuilds.reduce((sum, b) => sum + b.likes, 0),
      };

      reply.send({
        currentUser: currentUserStats,
        comparedUser: comparedUserStats,
      });
    } catch (error) {
      console.error('Compare studio stats error:', error);
      reply.code(500).send({
        error: 'Failed to compare studio stats',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // STUDIO TEAM ROUTES (continuing in next part due to size...)
  app.post('/team', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as { name: string; description?: string };

      if (!body.name || typeof body.name !== 'string') {
        return reply.code(400).send({ error: 'Team name is required' });
      }

      const team = await studioTeamStorage.createTeam(request.user.id, {
        name: body.name.trim(),
        ...(body.description && { description: body.description.trim() }),
      });

      reply.code(201).send(team);
    } catch (error) {
      console.error('Create team error:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.code(409).send({ error: error.message });
      }
      reply.code(500).send({
        error: 'Failed to create team',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/team', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const team = await studioTeamStorage.getTeamByStudioOwner(request.user.id);
      if (!team) {
        return reply.code(404).send({ error: 'Team not found' });
      }

      reply.send(team);
    } catch (error) {
      console.error('Get team error:', error);
      reply.code(500).send({
        error: 'Failed to get team',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put('/team/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as Record<string, string>);
      if (!id) {
        return reply.code(400).send({ error: 'Team ID required' });
      }
      const team = await studioTeamStorage.getTeam(id);
      if (!team) {
        return reply.code(404).send({ error: 'Team not found' });
      }

      if (team.studioOwnerId !== request.user.id) {
        return reply.code(403).send({ error: 'Only team owner can update team' });
      }

      const body = request.body as { name?: string; description?: string };
      const updated = await studioTeamStorage.updateTeam(id, body);
      reply.send(updated);
    } catch (error) {
      console.error('Update team error:', error);
      reply.code(500).send({
        error: 'Failed to update team',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete('/team/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as Record<string, string>);
      if (!id) {
        return reply.code(400).send({ error: 'Team ID required' });
      }
      const team = await studioTeamStorage.getTeam(id);
      if (!team) {
        return reply.code(404).send({ error: 'Team not found' });
      }

      if (team.studioOwnerId !== request.user.id) {
        return reply.code(403).send({ error: 'Only team owner can delete team' });
      }

      await studioTeamStorage.deleteTeam(id);
      reply.code(204).send();
    } catch (error) {
      console.error('Delete team error:', error);
      reply.code(500).send({
        error: 'Failed to delete team',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/team/members', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const team = await studioTeamStorage.getTeamByStudioOwner(request.user.id);
      if (!team) {
        return reply.code(404).send({ error: 'Team not found' });
      }

      const member = await studioTeamStorage.getMember(team.id, request.user.id);
      if (!member) {
        return reply.code(403).send({ error: 'Not a team member' });
      }

      const members = await studioTeamStorage.getMembers(team.id);

      const enrichedMembers = await Promise.all(
        members.map(async (m) => {
          const user = await authManager.getUserById(m.userId);
          const profile = user ? await profileStorage.getProfile(m.userId) : null;
          return {
            ...m,
            userName: user?.username || profile?.displayName || user?.email,
            userEmail: user?.email,
          };
        })
      );

      reply.send({ members: enrichedMembers });
    } catch (error) {
      console.error('Get team members error:', error);
      reply.code(500).send({
        error: 'Failed to get team members',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/team/invite', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const team = await studioTeamStorage.getTeamByStudioOwner(request.user.id);
      if (!team) {
        return reply.code(404).send({ error: 'Team not found' });
      }

      const member = await studioTeamStorage.getMember(team.id, request.user.id);
      if (!member || member.role !== 'owner') {
        return reply.code(403).send({ error: 'Only team owner can invite members' });
      }

      const body = request.body as { userId?: string; username?: string; email?: string };
      let inviteeUserId: string | undefined;

      if (body.userId) {
        const user = await authManager.getUserById(body.userId);
        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }
        inviteeUserId = user.id;
      } else if (body.username) {
        const friends = await friendsStorage.getFriends(request.user.id);
        for (const friendId of friends) {
          const profile = await profileStorage.getProfile(friendId);
          if (profile?.displayName?.toLowerCase() === body.username.toLowerCase()) {
            inviteeUserId = friendId;
            break;
          }
        }
        if (!inviteeUserId) {
          return reply.code(404).send({ error: 'User not found by username' });
        }
      } else if (body.email) {
        const user = await authManager['userStorage'].findUserByEmail(body.email);
        if (!user) {
          return reply.code(404).send({ error: 'User not found by email' });
        }
        inviteeUserId = user.id;
      } else {
        return reply.code(400).send({ error: 'userId, username, or email is required' });
      }

      if (!inviteeUserId) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const existingMember = await studioTeamStorage.getMember(team.id, inviteeUserId);
      if (existingMember) {
        return reply.code(409).send({ error: 'User is already a team member' });
      }

      const existingInvitations = await studioTeamStorage.getInvitations(team.id, inviteeUserId);
      const pendingInvitation = existingInvitations.find((inv) => inv.status === 'pending');
      if (pendingInvitation) {
        return reply.code(409).send({ error: 'Invitation already sent' });
      }

      const inviteeProfile = await profileStorage.getProfile(inviteeUserId);
      const inviteeUser = await authManager.getUserById(inviteeUserId);

      const invitation = await studioTeamStorage.createInvitation(team.id, request.user.id, {
        userId: inviteeUserId,
        ...(inviteeProfile?.displayName && { username: inviteeProfile.displayName }),
        ...(inviteeUser?.email && { email: inviteeUser.email }),
      });

      try {
        await notificationsStorage.createNotification({
          userId: inviteeUserId,
          type: 'team_invitation',
          title: 'Team Invitation',
          message: `You've been invited to join ${team.name} team`,
          metadata: { teamId: team.id, invitationId: invitation.id },
        });
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
      }

      reply.code(201).send(invitation);
    } catch (error) {
      console.error('Invite member error:', error);
      reply.code(500).send({
        error: 'Failed to invite member',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put(
    '/studio/team/invitations/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as Record<string, string>);
        if (!id) {
          return reply.code(400).send({ error: 'Invitation ID required' });
        }
        const body = request.body as { action: 'accept' | 'decline' };

        if (!body.action || (body.action !== 'accept' && body.action !== 'decline')) {
          return reply.code(400).send({ error: 'action must be "accept" or "decline"' });
        }

        const invitation = await studioTeamStorage.getInvitation(id);
        if (!invitation) {
          return reply.code(404).send({ error: 'Invitation not found' });
        }

        if (invitation.inviteeUserId !== request.user.id) {
          return reply.code(403).send({ error: 'This invitation is not for you' });
        }

        if (invitation.status !== 'pending') {
          return reply.code(400).send({ error: 'Invitation is no longer pending' });
        }

        if (invitation.expiresAt < Date.now()) {
          await studioTeamStorage.updateInvitation(id, 'expired');
          return reply.code(400).send({ error: 'Invitation has expired' });
        }

        if (body.action === 'accept') {
          await studioTeamStorage.addMember(invitation.teamId, request.user.id, invitation.inviterId);
          await studioTeamStorage.updateInvitation(id, 'accepted');

          try {
            await notificationsStorage.createNotification({
              userId: invitation.inviterId,
              type: 'team_invitation_accepted',
              title: 'Team Invitation Accepted',
              message: `${request.user.email} accepted your team invitation`,
              metadata: { teamId: invitation.teamId },
            });
          } catch (notificationError) {
            console.error('Failed to create notification:', notificationError);
          }
        } else {
          if (id) {
            await studioTeamStorage.updateInvitation(id, 'declined');
          }
        }

        const updated = id ? await studioTeamStorage.getInvitation(id) : null;
        reply.send(updated);
      } catch (error) {
        console.error('Update invitation error:', error);
        reply.code(500).send({
          error: 'Failed to update invitation',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get(
    '/studio/team/invitations',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query as { teamId?: string | number };
        const team = query.teamId
          ? await studioTeamStorage.getTeam(String(query.teamId))
          : null;

        if (team) {
          const member = await studioTeamStorage.getMember(team.id, request.user.id);
          if (!member || member.role !== 'owner') {
            return reply.code(403).send({ error: 'Only team owner can view team invitations' });
          }
        }

        const invitations = team
          ? await studioTeamStorage.getInvitations(team.id)
          : await studioTeamStorage.getInvitations(undefined, request.user.id);

        await studioTeamStorage.cleanupExpiredInvitations();

        reply.send({ invitations });
      } catch (error) {
        console.error('Get invitations error:', error);
        reply.code(500).send({
          error: 'Failed to get invitations',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete(
    '/studio/team/members/:userId',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { userId } = (request.params as Record<string, string>);
        if (!userId) {
          return reply.code(400).send({ error: 'User ID required' });
        }
        const team = await studioTeamStorage.getTeamByStudioOwner(request.user.id);
        if (!team) {
          return reply.code(404).send({ error: 'Team not found' });
        }

        const member = await studioTeamStorage.getMember(team.id, request.user.id);
        if (!member || member.role !== 'owner') {
          return reply.code(403).send({ error: 'Only team owner can remove members' });
        }

        if (userId === request.user.id) {
          return reply.code(400).send({ error: 'Cannot remove yourself' });
        }

        const removed = await studioTeamStorage.removeMember(team.id, userId);
        if (!removed) {
          return reply.code(404).send({ error: 'Member not found' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Remove member error:', error);
        if (error instanceof Error && error.message.includes('Cannot remove team owner')) {
          return reply.code(400).send({ error: error.message });
        }
        reply.code(500).send({
          error: 'Failed to remove member',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post(
    '/studio/projects/:id/share-team',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as Record<string, string>);
        if (!id) {
          return reply.code(400).send({ error: 'Project ID required' });
        }
        const body = request.body as { accessLevel: 'read' | 'write'; userId?: string };

        if (!body.accessLevel || !['read', 'write'].includes(body.accessLevel)) {
          return reply.code(400).send({ error: 'accessLevel must be "read" or "write"' });
        }

        const project = await studioProjectsStorage.getProject(request.user.id, id);
        if (!project) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        const team = await studioTeamStorage.getTeamByStudioOwner(request.user.id);
        if (!team) {
          return reply.code(404).send({ error: 'Team not found' });
        }

        const member = await studioTeamStorage.getMember(team.id, request.user.id);
        if (!member || member.role !== 'owner') {
          return reply.code(403).send({ error: 'Only team owner can share projects' });
        }

        if (body.userId) {
          const assignedMember = await studioTeamStorage.getMember(team.id, body.userId);
          if (!assignedMember) {
            return reply.code(404).send({ error: 'User is not a team member' });
          }
        }

        const access = await studioTeamStorage.shareProjectWithTeam(
          id,
          team.id,
          body.accessLevel,
          body.userId
        );

        const members = await studioTeamStorage.getMembers(team.id);
        for (const teamMember of members) {
          if (
            teamMember.userId !== request.user.id &&
            (!body.userId || teamMember.userId === body.userId)
          ) {
            try {
              await notificationsStorage.createNotification({
                userId: teamMember.userId,
                type: 'project_shared',
                title: 'Project Shared',
                message: `Project "${project.name}" has been shared with the team`,
                metadata: { projectId: id, teamId: team.id },
              });
            } catch (notificationError) {
              console.error('Failed to create notification:', notificationError);
            }
          }
        }

        reply.code(201).send(access);
      } catch (error) {
        console.error('Share project with team error:', error);
        reply.code(500).send({
          error: 'Failed to share project',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get(
    '/studio/projects/:id/team-access',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as Record<string, string>);
        if (!id) {
          return reply.code(400).send({ error: 'Project ID required' });
        }

        const project = await studioProjectsStorage.getProject(request.user.id, id);
        if (!project) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        const team = await studioTeamStorage.getTeamByStudioOwner(request.user.id);
        if (!team) {
          return reply.code(404).send({ error: 'No team found' });
        }

        const access = await studioTeamStorage.getProjectTeamAccess(id, team.id);
        reply.send({ access: access || null });
      } catch (error) {
        console.error('Get project team access error:', error);
        reply.code(500).send({
          error: 'Failed to get project team access',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete(
    '/studio/projects/:id/share-team',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as Record<string, string>);
        if (!id) {
          return reply.code(400).send({ error: 'Project ID required' });
        }

        const project = await studioProjectsStorage.getProject(request.user.id, id);
        if (!project) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        const team = await studioTeamStorage.getTeamByStudioOwner(request.user.id);
        if (!team) {
          return reply.code(404).send({ error: 'Team not found' });
        }

        const member = await studioTeamStorage.getMember(team.id, request.user.id);
        if (!member || member.role !== 'owner') {
          return reply.code(403).send({ error: 'Only team owner can remove project access' });
        }

        await studioTeamStorage.removeProjectTeamAccess(id, team.id);
        reply.code(204).send();
      } catch (error) {
        console.error('Remove project team access error:', error);
        reply.code(500).send({
          error: 'Failed to remove project team access',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get('/shared-projects', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const sharedProjects = await studioTeamStorage.getProjectsForUser(request.user.id);
      const projects = await Promise.all(
        sharedProjects.map(async (access) => {
          const team = await studioTeamStorage.getTeam(access.teamId);
          if (!team) {
            return null;
          }
          const project = await studioProjectsStorage.getProject(
            team.studioOwnerId,
            access.projectId
          );
          return project ? { project, access } : null;
        })
      );

      reply.send({
        projects: projects.filter(
          (p): p is { project: StudioProject; access: ProjectTeamAccess } => p !== null
        ),
      });
    } catch (error) {
      console.error('Get shared projects error:', error);
      reply.code(500).send({
        error: 'Failed to get shared projects',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // STUDIO SETTINGS ROUTES
  app.get('/settings', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const settings = await studioSettingsStorage.get(request.user.id);
      const result =
        settings ||
        ({
          userId: request.user.id,
          focus: 'balanced',
          goals: {},
          cadenceTarget: 2,
          showRevenue: true,
          featureFlags: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as const);

      reply.send(result);
    } catch (error) {
      console.error('Get studio settings error:', error);
      reply.code(500).send({
        error: 'Failed to get studio settings',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put('/settings', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as {
        focus?: 'games' | 'assets' | 'balanced';
        goals?: {
          monthlyRevenueTarget?: number;
          monthlyReleasesTarget?: number;
          monthlyUpdatesTarget?: number;
        };
        cadenceTarget?: number;
        showRevenue?: boolean;
        featureFlags?: Record<string, unknown>;
      };

      if (body.focus && !['games', 'assets', 'balanced'].includes(body.focus)) {
        return reply.code(400).send({ error: 'Invalid focus' });
      }

      if (
        body.cadenceTarget !== undefined &&
        (typeof body.cadenceTarget !== 'number' || body.cadenceTarget < 0)
      ) {
        return reply.code(400).send({ error: 'Invalid cadenceTarget' });
      }

      const updated = await studioSettingsStorage.upsert(request.user.id, body);
      reply.send(updated);
    } catch (error) {
      console.error('Update studio settings error:', error);
      reply.code(500).send({
        error: 'Failed to update studio settings',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // STUDIO REVENUE ROUTE
  app.get('/revenue', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { period: periodParam } = request.query as { period?: string };
      const period = String(periodParam || 'month');
      const days = periodToDays(period);
      const cacheKey = `rev:${request.user.id}:${days}`;

      const cached = cacheGet<typeof result>(cacheKey);
      if (cached) {
        return reply.send(cached);
      }

      const since = Date.now() - days * 24 * 60 * 60 * 1000;

      let gross = 0;
      const byDay = new Map<string, number>();
      const byItem = new Map<string, { title?: string; gross: number }>();

      if (dbPool) {
        const userId = request.user.id;
        const dayRows = await dbPool.$queryRaw<
          Array<{
            day: Date;
            gross: string;
          }>
        >`
          SELECT DATE_TRUNC('day', p.created_at) AS day, SUM(pi.price_amount) AS gross
          FROM purchases p
          JOIN purchase_items pi ON pi.purchase_id = p.id
          JOIN marketplace_items mi ON mi.id = pi.item_id AND pi.item_type = 'marketplace-item'
          WHERE mi.author_id = ${userId} AND p.status = 'completed' AND p.created_at >= NOW() - INTERVAL '${String(days)} days'
          GROUP BY 1
          ORDER BY 1
        `;
        for (const row of dayRows) {
          const dayKey = row.day.toISOString().slice(0, 10);
          const val = Number(row.gross) || 0;
          byDay.set(dayKey, val);
          gross += val;
        }

        const topRows = await dbPool.$queryRaw<
          Array<{
            item_id: string;
            title: string | null;
            gross: string;
          }>
        >`
          SELECT pi.item_id, mi.title, SUM(pi.price_amount) AS gross
          FROM purchases p
          JOIN purchase_items pi ON pi.purchase_id = p.id
          JOIN marketplace_items mi ON mi.id = pi.item_id AND pi.item_type = 'marketplace-item'
          WHERE mi.author_id = ${userId} AND p.status = 'completed' AND p.created_at >= NOW() - INTERVAL '${String(days)} days'
          GROUP BY pi.item_id, mi.title
          ORDER BY SUM(pi.price_amount) DESC
          LIMIT 10
        `;
        for (const row of topRows) {
          const item: { gross: number; title?: string } = { gross: Number(row.gross) || 0 };
          if (row.title) {
            item.title = row.title;
          }
          byItem.set(row.item_id, item);
        }
      } else {
        const allPurchases = await purchaseStorage.getPurchases({
          status: 'completed',
          limit: 100000,
        });
        for (const p of allPurchases) {
          if (p.createdAt < since) continue;
          const dayKey = new Date(p.createdAt).toISOString().slice(0, 10);
          for (const it of p.items) {
            if (it.type !== 'marketplace-item') continue;
            const mp = await marketplaceStorage.getItem(it.itemId);
            if (!mp || mp.authorId !== request.user.id) continue;
            const amount = Number(it.price.amount) || 0;
            gross += amount;
            byDay.set(dayKey, (byDay.get(dayKey) || 0) + amount);
            const cur = byItem.get(it.itemId) || { title: mp.title, gross: 0 };
            cur.gross += amount;
            cur.title = cur.title || mp.title;
            byItem.set(it.itemId, cur);
          }
        }
      }

      const platformFee = gross * 0.1;
      const net = gross - platformFee;

      const trend = Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, gross: value, net: value * 0.9 }));

      const topItems = Array.from(byItem.entries())
        .map(([itemId, v]) => ({ itemId, title: v.title, gross: v.gross }))
        .sort((a, b) => b.gross - a.gross)
        .slice(0, 10);

      const result = { gross, platformFee, net, topItems, trend, period };
      cacheSet(cacheKey, result);
      reply.send(result);
    } catch (error) {
      console.error('Get studio revenue error:', error);
      reply.code(500).send({
        error: 'Failed to get studio revenue',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // STUDIO SCORE ROUTE
  app.get('/score', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
      const cacheKey = `score:${request.user.id}`;
      const cached = cacheGet<typeof result>(cacheKey);
      if (cached) return reply.send(cached);
      const result = await computeStudioScore(request.user.id);
      cacheSet(cacheKey, result);
      reply.send(result);
    } catch (error) {
      console.error('Get studio score error:', error);
      reply.code(500).send({
        error: 'Failed to get studio score',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // STUDIO INSIGHTS ROUTE
  app.get('/insights', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });

      const [settings, score] = await Promise.all([
        studioSettingsStorage.get(request.user.id),
        computeStudioScore(request.user.id),
      ]);

      const days = 30;
      const since30 = Date.now() - days * 24 * 60 * 60 * 1000;
      const since14 = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const projects = await studioProjectsStorage.listProjects(request.user.id, {
        limit: 10000,
        offset: 0,
      });
      const updatedRecently = projects.some((p) => p.updatedAt >= since14);

      const rev = await (async () => {
        if (!request.user) return null;
        const cached = cacheGet<any>(`rev:${request.user.id}:30`);
        return cached || null;
      })();

      const insights: Array<{
        id: string;
        message: string;
        impact: 'low' | 'medium' | 'high';
        action?: { type: string; href?: string };
      }> = [];

      if (!updatedRecently) {
        insights.push({
          id: 'nudge-inactive',
          message:
            'Brak aktualizacji od 14 dni — wypuść mały update projektu lub popraw miniaturę, aby utrzymać zainteresowanie.',
          impact: 'medium',
          action: { type: 'navigate', href: '/studio?tab=projects' },
        });
      }

      if (settings?.goals?.monthlyRevenueTarget && rev?.net) {
        const target = settings.goals.monthlyRevenueTarget;
        if (target > 0 && rev.net >= 0.8 * target) {
          insights.push({
            id: 'goal-proximity',
            message:
              'Jesteś blisko celu przychodu w tym miesiącu (≥80%). Rozważ promocję bestsellera, aby go przekroczyć.',
            impact: 'high',
          });
        }
      }

      const items = await marketplaceStorage.getItems({ authorId: request.user.id });
      const assetsLast30 = items.filter(
        (i) => i.type !== 'build' && i.createdAt && i.createdAt >= since30
      ).length;
      if ((settings?.focus === 'assets' || settings?.focus === 'balanced') && assetsLast30 === 0) {
        insights.push({
          id: 'mix-advice-assets',
          message:
            'Masz fokus na zasoby, ale w ostatnich 30 dniach nie dodałeś nowych assetów. Dodaj model/avatar/blok do marketplace.',
          impact: 'medium',
          action: { type: 'navigate', href: '/studio?tab=projects' },
        });
      }

      const revData = rev || { topItems: [] };
      if (Array.isArray(revData.topItems) && revData.topItems.length > 0) {
        const top = revData.topItems[0];
        insights.push({
          id: 'bundle-or-update',
          message: `Twój bestseller: "${top.title || top.itemId}". Rozważ aktualizację lub bundlowanie z powiązanymi elementami.`,
          impact: 'medium',
        });
      }

      if (score.score < 50) {
        insights.push({
          id: 'health-low',
          message:
            'Wskaźnik zdrowia studia jest poniżej 50. Skup się na regularnych publikacjach i jakości (miniatury, opisy, tagi).',
          impact: 'high',
        });
      }

      reply.send({ insights });
    } catch (error) {
      console.error('Get studio insights error:', error);
      reply.code(500).send({
        error: 'Failed to get insights',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // STUDIO AVATAR PRESETS ROUTES
  app.get('/avatars', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const presets = await avatarStorage.getPresets(request.user.id, false);
      reply.send({ presets });
    } catch (error) {
      console.error('Get avatar presets error:', error);
      reply.code(500).send({
        error: 'Failed to get avatar presets',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/avatars', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as {
        name: string;
        description?: string;
        avatarData: Record<string, unknown>;
        thumbnailUrl?: string;
        tags?: string[];
      };

      if (!body.name || !body.avatarData) {
        return reply.code(400).send({ error: 'Name and avatarData are required' });
      }

      const presetData: CreateAvatarPresetRequest = {
        name: body.name,
        avatarData: body.avatarData,
        tags: body.tags || [],
      };
      if (body.description) {
        presetData.description = body.description;
      }
      if (body.thumbnailUrl) {
        presetData.thumbnailUrl = body.thumbnailUrl;
      }

      const preset = await avatarStorage.createPreset(request.user.id, presetData);

      reply.code(201).send(preset);
    } catch (error) {
      console.error('Create avatar preset error:', error);
      reply.code(500).send({
        error: 'Failed to create avatar preset',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/avatars/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id?: string };
      if (!id) {
        return reply.code(400).send({ error: 'Avatar preset ID required' });
      }

      const preset = await avatarStorage.getPreset(request.user.id, id);
      if (!preset) {
        return reply.code(404).send({ error: 'Avatar preset not found' });
      }

      reply.send(preset);
    } catch (error) {
      console.error('Get avatar preset error:', error);
      reply.code(500).send({
        error: 'Failed to get avatar preset',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put('/avatars/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id?: string };
      if (!id) {
        return reply.code(400).send({ error: 'Avatar preset ID required' });
      }

      const body = request.body as {
        name?: string;
        description?: string;
        avatarData?: Record<string, unknown>;
        thumbnailUrl?: string;
        tags?: string[];
        isPublished?: boolean;
      };

      const preset = await avatarStorage.updatePreset(request.user.id, id, body);
      reply.send(preset);
    } catch (error) {
      console.error('Update avatar preset error:', error);
      reply.code(500).send({
        error: 'Failed to update avatar preset',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete('/avatars/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id?: string };
      if (!id) {
        return reply.code(400).send({ error: 'Avatar preset ID required' });
      }

      await avatarStorage.deletePreset(request.user.id, id);
      reply.code(204).send();
    } catch (error) {
      console.error('Delete avatar preset error:', error);
      reply.code(500).send({
        error: 'Failed to delete avatar preset',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/avatars/:id/publish', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id?: string };
      if (!id) {
        return reply.code(400).send({ error: 'Avatar preset ID required' });
      }

      const body = request.body as {
        title: string;
        description?: string;
        tags?: string[];
      };

      if (!body.title) {
        return reply.code(400).send({ error: 'Title is required' });
      }

      const preset = await avatarStorage.getPreset(request.user.id, id);
      if (!preset) {
        return reply.code(404).send({ error: 'Avatar preset not found' });
      }

      // Create marketplace item
      const user = await authManager.getUserById(request.user.id);
      const authorName = user?.username || user?.email || 'Unknown';

      const itemData: Omit<MarketplaceItem, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'likes'> = {
        type: 'avatar',
        title: body.title,
        authorId: request.user.id,
        fileUrl: '', // Will be updated after item creation
        tags: body.tags || preset.tags || [],
        public: true,
      };
      if (authorName) {
        itemData.authorName = authorName;
      }
      if (preset.thumbnailUrl) {
        itemData.thumbnailUrl = preset.thumbnailUrl;
      }
      if (body.description || preset.description) {
        const desc = body.description || preset.description;
        if (desc) {
          itemData.description = desc;
        }
      }

      const marketplaceItem = await marketplaceStorage.createItem(itemData);

      const itemId = marketplaceItem.id;
      
      // Update fileUrl with correct itemId
      await marketplaceStorage.updateItem(itemId, {
        fileUrl: `/api/marketplace/avatars/${itemId}`,
        thumbnailUrl: preset.thumbnailUrl || `/api/marketplace/thumbnails/${itemId}`,
      });

      // Store avatar data
      if (dbPool) {
        const jsonData = JSON.stringify(preset.avatarData);
        const buffer = Buffer.from(jsonData, 'utf-8');
        await dbPool.marketplaceAvatar.create({
          data: {
            marketplaceId: itemId,
            avatarData: buffer,
            version: 1,
          },
        });
      }

      // Generate thumbnail if not provided
      if (!preset.thumbnailUrl) {
        const { generateAndSaveThumbnail, THUMBNAIL_DIR } = opts.dependencies;
        await generateAndSaveThumbnail(
          THUMBNAIL_DIR,
          itemId,
          body.title,
          body.tags || preset.tags || [],
          'avatar'
        );
      }

      // Mark preset as published
      await avatarStorage.updatePreset(request.user.id, id, { isPublished: true });

      reply.code(201).send(marketplaceItem);
    } catch (error) {
      console.error('Publish avatar preset error:', error);
      reply.code(500).send({
        error: 'Failed to publish avatar preset',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

}



