/**
 * Forum Storage DB - PostgreSQL implementation using Prisma
 */

import type { PrismaClient as PrismaClientType } from '../../node_modules/.prisma/net-client/index.js';
import { Prisma } from '../../node_modules/.prisma/net-client/index.js';
import type {
  ForumCategory,
  ForumThread,
  ForumPost,
} from './ForumStorage.js';

export class ForumStorageDB {
  constructor(private readonly prisma: PrismaClientType) {}

  async initialize(): Promise<void> {
    // Check if default categories exist
    const existingCategories = await this.prisma.forumCategory.findMany();
    if (existingCategories.length === 0) {
      const defaultCategories = [
        {
          id: 'cat_general',
          name: 'General Discussion',
          description: 'General discussions about FORGE',
          icon: '💬',
          color: '#4ade80',
          order: 1,
          isLocked: false,
        },
        {
          id: 'cat_showcase',
          name: 'Showcase',
          description: 'Share your builds and creations',
          icon: '✨',
          color: '#fbbf24',
          order: 2,
          isLocked: false,
        },
        {
          id: 'cat_help',
          name: 'Help & Support',
          description: 'Get help with using FORGE',
          icon: '❓',
          color: '#3b82f6',
          order: 3,
          isLocked: false,
        },
        {
          id: 'cat_feature',
          name: 'Feature Requests',
          description: 'Suggest new features',
          icon: '💡',
          color: '#a855f7',
          order: 4,
          isLocked: false,
        },
      ];

      await this.prisma.forumCategory.createMany({
        data: defaultCategories,
      });
    }
  }

  // Categories
  async getCategories(): Promise<ForumCategory[]> {
    const categories = await this.prisma.forumCategory.findMany({
      orderBy: { order: 'asc' },
    });

    // Calculate counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const threadCount = await this.prisma.forumThread.count({
          where: { categoryId: cat.id },
        });

        const postCount = await this.prisma.forumPost.count({
          where: {
            thread: {
              categoryId: cat.id,
            },
          },
        });

        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          ...(cat.icon !== null && { icon: cat.icon }),
          ...(cat.color !== null && { color: cat.color }),
          threadCount,
          postCount,
          order: cat.order,
          isLocked: cat.isLocked,
        };
      })
    );

    return categoriesWithCounts;
  }

  async getCategory(id: string): Promise<ForumCategory | null> {
    const category = await this.prisma.forumCategory.findUnique({
      where: { id },
    });

    if (!category) {
      return null;
    }

    const threadCount = await this.prisma.forumThread.count({
      where: { categoryId: id },
    });

    const postCount = await this.prisma.forumPost.count({
      where: {
        thread: {
          categoryId: id,
        },
      },
    });

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      ...(category.icon !== null && { icon: category.icon }),
      ...(category.color !== null && { color: category.color }),
      threadCount,
      postCount,
      order: category.order,
      isLocked: category.isLocked,
    };
  }

  async createCategory(
    category: Omit<ForumCategory, 'threadCount' | 'postCount'>
  ): Promise<ForumCategory> {
    const created = await this.prisma.forumCategory.create({
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon ?? null,
        color: category.color ?? null,
        order: category.order,
        isLocked: category.isLocked,
      },
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      ...(created.icon !== null && { icon: created.icon }),
      ...(created.color !== null && { color: created.color }),
      threadCount: 0,
      postCount: 0,
      order: created.order,
      isLocked: created.isLocked,
    };
  }

  async updateCategory(
    id: string,
    updates: Partial<ForumCategory>
  ): Promise<ForumCategory | null> {
    const updateData: Prisma.ForumCategoryUpdateInput = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.icon !== undefined) updateData.icon = updates.icon ?? null;
    if (updates.color !== undefined) updateData.color = updates.color ?? null;
    if (updates.order !== undefined) updateData.order = updates.order;
    if (updates.isLocked !== undefined) updateData.isLocked = updates.isLocked;

    const updated = await this.prisma.forumCategory.update({
      where: { id },
      data: updateData,
    });

    // Recalculate counts
    const threadCount = await this.prisma.forumThread.count({
      where: { categoryId: id },
    });

    const postCount = await this.prisma.forumPost.count({
      where: {
        thread: {
          categoryId: id,
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      ...(updated.icon !== null && { icon: updated.icon }),
      ...(updated.color !== null && { color: updated.color }),
      threadCount,
      postCount,
      order: updated.order,
      isLocked: updated.isLocked,
    };
  }

  async deleteCategory(id: string): Promise<boolean> {
    const threadCount = await this.prisma.forumThread.count({
      where: { categoryId: id },
    });

    if (threadCount > 0) {
      throw new Error('Cannot delete category with existing threads');
    }

    try {
      await this.prisma.forumCategory.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getAllThreads(params?: {
    limit?: number;
    offset?: number;
    categoryId?: string;
    authorId?: string;
    search?: string;
  }): Promise<{ threads: ForumThread[]; total: number }> {
    const where: Prisma.ForumThreadWhereInput = {};

    if (params?.categoryId) {
      where.categoryId = params.categoryId;
    }
    if (params?.authorId) {
      where.authorId = params.authorId;
    }
    if (params?.search) {
      const lowerQuery = params.search.toLowerCase();
      where.OR = [
        { title: { contains: lowerQuery, mode: 'insensitive' } },
        { content: { contains: lowerQuery, mode: 'insensitive' } },
        { tags: { hasSome: [lowerQuery] } },
      ];
    }

    const [threads, total] = await Promise.all([
      this.prisma.forumThread.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(params?.limit !== undefined && { take: params.limit }),
        ...(params?.offset !== undefined && { skip: params.offset }),
      }),
      this.prisma.forumThread.count({ where }),
    ]);

    const threadsWithStats = await Promise.all(
      threads.map((thread) => this.mapThreadToForumThread(thread))
    );

    return { threads: threadsWithStats, total };
  }

  async getAllPosts(params?: {
    limit?: number;
    offset?: number;
    threadId?: string;
    authorId?: string;
    search?: string;
  }): Promise<{ posts: ForumPost[]; total: number }> {
    const where: Prisma.ForumPostWhereInput = {};

    if (params?.threadId) {
      where.threadId = params.threadId;
    }
    if (params?.authorId) {
      where.authorId = params.authorId;
    }
    if (params?.search) {
      where.content = { contains: params.search, mode: 'insensitive' };
    }

    const [posts, total] = await Promise.all([
      this.prisma.forumPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(params?.limit !== undefined && { take: params.limit }),
        ...(params?.offset !== undefined && { skip: params.offset }),
      }),
      this.prisma.forumPost.count({ where }),
    ]);

    const postsWithReactions = await Promise.all(
      posts.map((post) => this.mapPostToForumPost(post))
    );

    return { posts: postsWithReactions, total };
  }

  async getForumStats(): Promise<{
    categories: {
      total: number;
    };
    threads: {
      total: number;
      last24h: number;
      last7d: number;
      last30d: number;
    };
    posts: {
      total: number;
      last24h: number;
      last7d: number;
      last30d: number;
    };
    topCategories: Array<{
      id: string;
      name: string;
      threadCount: number;
      postCount: number;
    }>;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [categories, threadsTotal, threadsLast24h, threadsLast7d, threadsLast30d, postsTotal, postsLast24h, postsLast7d, postsLast30d] =
      await Promise.all([
        this.prisma.forumCategory.count(),
        this.prisma.forumThread.count(),
        this.prisma.forumThread.count({
          where: { createdAt: { gte: oneDayAgo } },
        }),
        this.prisma.forumThread.count({
          where: { createdAt: { gte: oneWeekAgo } },
        }),
        this.prisma.forumThread.count({
          where: { createdAt: { gte: oneMonthAgo } },
        }),
        this.prisma.forumPost.count(),
        this.prisma.forumPost.count({
          where: { createdAt: { gte: oneDayAgo } },
        }),
        this.prisma.forumPost.count({
          where: { createdAt: { gte: oneWeekAgo } },
        }),
        this.prisma.forumPost.count({
          where: { createdAt: { gte: oneMonthAgo } },
        }),
      ]);

    // Get top categories by thread count
    const categoriesWithCounts = await this.prisma.forumCategory.findMany({
      include: {
        _count: {
          select: {
            threads: true,
          },
        },
      },
      orderBy: {
        threads: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    const topCategories = await Promise.all(
      categoriesWithCounts.map(async (cat) => {
        const postCount = await this.prisma.forumPost.count({
          where: {
            thread: {
              categoryId: cat.id,
            },
          },
        });

        return {
          id: cat.id,
          name: cat.name,
          threadCount: cat._count.threads,
          postCount,
        };
      })
    );

    return {
      categories: { total: categories },
      threads: {
        total: threadsTotal,
        last24h: threadsLast24h,
        last7d: threadsLast7d,
        last30d: threadsLast30d,
      },
      posts: {
        total: postsTotal,
        last24h: postsLast24h,
        last7d: postsLast7d,
        last30d: postsLast30d,
      },
      topCategories,
    };
  }

  // Threads
  async getThreads(
    categoryId?: string,
    sortBy: 'hot' | 'new' | 'top' = 'hot'
  ): Promise<ForumThread[]> {
    const where: Prisma.ForumThreadWhereInput = categoryId
      ? { categoryId }
      : {};

    let orderBy: Prisma.ForumThreadOrderByWithRelationInput | Prisma.ForumThreadOrderByWithRelationInput[];

    if (sortBy === 'new') {
      orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    } else if (sortBy === 'top') {
      orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }]; // Will calculate score in memory
    } else {
      // hot - will calculate in memory
      orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    }

    const threads = await this.prisma.forumThread.findMany({
      where,
      orderBy,
    });

    const threadsWithStats = await Promise.all(
      threads.map((thread) => this.mapThreadToForumThread(thread))
    );

    // Sort by hot/top if needed
    if (sortBy === 'hot' || sortBy === 'top') {
      threadsWithStats.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }

        if (sortBy === 'top') {
          return b.score - a.score;
        }

        // Hot algorithm: score / (hours + 2) ^ 1.5
        const timeA = Date.now() - a.lastPostAt;
        const timeB = Date.now() - b.lastPostAt;
        const hoursA = timeA / (1000 * 60 * 60);
        const hoursB = timeB / (1000 * 60 * 60);
        const hotScoreA = a.score / Math.pow(hoursA + 2, 1.5);
        const hotScoreB = b.score / Math.pow(hoursB + 2, 1.5);
        return hotScoreB - hotScoreA;
      });
    }

    return threadsWithStats;
  }

  async getThread(id: string): Promise<ForumThread | null> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
    });

    if (!thread) {
      return null;
    }

    return this.mapThreadToForumThread(thread);
  }

  async createThread(
    thread: Omit<
      ForumThread,
      | 'id'
      | 'postCount'
      | 'lastPostAt'
      | 'lastPostBy'
      | 'createdAt'
      | 'updatedAt'
      | 'reactions'
      | 'score'
      | 'upvotes'
      | 'downvotes'
    >
  ): Promise<ForumThread> {
    const now = Date.now();
    const threadId = `thread_${now}_${Math.random().toString(36).substring(7)}`;

    // Create thread and first post in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const createdThread = await tx.forumThread.create({
        data: {
          id: threadId,
          categoryId: thread.categoryId,
          authorId: thread.authorId,
          title: thread.title,
          content: thread.content,
          isPinned: thread.isPinned,
          isLocked: thread.isLocked,
          tags: thread.tags || [],
          marketplaceItemId: thread.marketplaceItemId ?? null,
          projectToken: thread.projectToken ?? null,
        },
      });

      // Create first post (thread content)
      await tx.forumPost.create({
        data: {
          id: `post_${now}_${Math.random().toString(36).substring(7)}`,
          threadId: createdThread.id,
          authorId: thread.authorId,
          content: thread.content,
          mentions: [],
        },
      });

      return createdThread;
    });

    return this.mapThreadToForumThread(result);
  }

  async updateThread(
    id: string,
    updates: Partial<ForumThread>,
    _userId: string
  ): Promise<ForumThread | null> {
    const updateData: Prisma.ForumThreadUpdateInput = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.isPinned !== undefined) updateData.isPinned = updates.isPinned;
    if (updates.isLocked !== undefined) updateData.isLocked = updates.isLocked;
    if (updates.marketplaceItemId !== undefined)
      updateData.marketplaceItemId = updates.marketplaceItemId ?? null;
    if (updates.projectToken !== undefined)
      updateData.projectToken = updates.projectToken ?? null;

    try {
      const updated = await this.prisma.forumThread.update({
        where: { id },
        data: updateData,
      });

      return this.mapThreadToForumThread(updated);
    } catch {
      return null;
    }
  }

  async deleteThread(id: string, userId: string, force = false): Promise<boolean> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
    });

    if (!thread) {
      return false;
    }

    if (!force && thread.authorId !== userId) {
      return false;
    }

    // Cascade delete will handle posts, reactions, votes
    await this.prisma.forumThread.delete({
      where: { id },
    });

    return true;
  }

  async pinThread(threadId: string): Promise<boolean> {
    try {
      await this.prisma.forumThread.update({
        where: { id: threadId },
        data: { isPinned: true },
      });
      return true;
    } catch {
      return false;
    }
  }

  async unpinThread(threadId: string): Promise<boolean> {
    try {
      await this.prisma.forumThread.update({
        where: { id: threadId },
        data: { isPinned: false },
      });
      return true;
    } catch {
      return false;
    }
  }

  async lockThread(threadId: string): Promise<boolean> {
    try {
      await this.prisma.forumThread.update({
        where: { id: threadId },
        data: { isLocked: true },
      });
      return true;
    } catch {
      return false;
    }
  }

  async unlockThread(threadId: string): Promise<boolean> {
    try {
      await this.prisma.forumThread.update({
        where: { id: threadId },
        data: { isLocked: false },
      });
      return true;
    } catch {
      return false;
    }
  }

  // Posts
  async getPosts(threadId: string, sortBy: 'new' | 'top' = 'new'): Promise<ForumPost[]> {
    const posts = await this.prisma.forumPost.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });

    const postsWithReactions = await Promise.all(
      posts.map((post) => this.mapPostToForumPost(post))
    );

    if (sortBy === 'top') {
      // Get votes for all posts
      const postIds = posts.map((p) => p.id);
      const votes = await this.prisma.forumPostVote.findMany({
        where: { postId: { in: postIds } },
      });

      // Calculate scores
      const postScores = new Map<string, number>();
      for (const vote of votes) {
        const current = postScores.get(vote.postId) || 0;
        postScores.set(vote.postId, current + (vote.vote === 'up' ? 1 : -1));
      }

      // Sort by score
      postsWithReactions.sort((a, b) => {
        const scoreA = postScores.get(a.id) || 0;
        const scoreB = postScores.get(b.id) || 0;
        return scoreB - scoreA;
      });
    }

    return postsWithReactions;
  }

  async getPost(id: string): Promise<ForumPost | null> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id },
    });

    if (!post) {
      return null;
    }

    return this.mapPostToForumPost(post);
  }

  async createPost(post: Omit<ForumPost, 'id'>): Promise<ForumPost> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: post.threadId },
    });

    if (!thread) {
      throw new Error('Thread not found');
    }

    if (thread.isLocked) {
      throw new Error('Thread is locked');
    }

    const postId = `post_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const createdPost = await tx.forumPost.create({
        data: {
          id: postId,
          threadId: post.threadId,
          authorId: post.authorId,
          content: post.content,
          mentions: post.mentions || [],
        },
      });

      // Update thread stats
      await tx.forumThread.update({
        where: { id: post.threadId },
        data: {
          updatedAt: new Date(post.createdAt),
        },
      });

      return createdPost;
    });

    return this.mapPostToForumPost(result);
  }

  async updatePost(
    id: string,
    updates: Partial<ForumPost>,
    userId: string
  ): Promise<ForumPost | null> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id },
    });

    if (!post || post.authorId !== userId) {
      return null;
    }

    const updateData: Prisma.ForumPostUpdateInput = {};

    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.mentions !== undefined) updateData.mentions = updates.mentions;
    updateData.editedAt = new Date();

    try {
      const updated = await this.prisma.forumPost.update({
        where: { id },
        data: updateData,
      });

      return this.mapPostToForumPost(updated);
    } catch {
      return null;
    }
  }

  async deletePost(id: string, userId: string, force = false): Promise<boolean> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id },
    });

    if (!post) {
      return false;
    }

    if (!force && post.authorId !== userId) {
      return false;
    }

    await this.prisma.forumPost.delete({
      where: { id },
    });

    // Update thread stats
    const remainingPosts = await this.prisma.forumPost.findMany({
      where: { threadId: post.threadId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (remainingPosts.length > 0) {
      const lastPost = remainingPosts[0]!; // Non-null assertion: length check guarantees existence
      await this.prisma.forumThread.update({
        where: { id: post.threadId },
        data: {
          updatedAt: lastPost.createdAt,
        },
      });
    }

    return true;
  }

  // Reactions
  async addReaction(
    threadId: string | null,
    postId: string | null,
    emoji: string,
    userId: string
  ): Promise<boolean> {
    if (!threadId && !postId) {
      return false;
    }

    if (threadId) {
      const thread = await this.prisma.forumThread.findUnique({
        where: { id: threadId },
      });

      if (!thread) {
        return false;
      }

      // Upsert reaction (remove existing if exists, then add)
      await this.prisma.forumThreadReaction.deleteMany({
        where: {
          threadId,
          emoji,
          userId,
        },
      });

      await this.prisma.forumThreadReaction.create({
        data: {
          threadId,
          emoji,
          userId,
        },
      });

      return true;
    }

    if (postId) {
      const post = await this.prisma.forumPost.findUnique({
        where: { id: postId },
      });

      if (!post) {
        return false;
      }

      await this.prisma.forumPostReaction.deleteMany({
        where: {
          postId,
          emoji,
          userId,
        },
      });

      await this.prisma.forumPostReaction.create({
        data: {
          postId,
          emoji,
          userId,
        },
      });

      return true;
    }

    return false;
  }

  async removeReaction(
    threadId: string | null,
    postId: string | null,
    emoji: string,
    userId: string
  ): Promise<boolean> {
    if (!threadId && !postId) {
      return false;
    }

    if (threadId) {
      const result = await this.prisma.forumThreadReaction.deleteMany({
        where: {
          threadId,
          emoji,
          userId,
        },
      });

      return result.count > 0;
    }

    if (postId) {
      const result = await this.prisma.forumPostReaction.deleteMany({
        where: {
          postId,
          emoji,
          userId,
        },
      });

      return result.count > 0;
    }

    return false;
  }

  // Voting
  async voteThread(
    threadId: string,
    userId: string,
    vote: 'up' | 'down'
  ): Promise<{ score: number; upvotes: number; downvotes: number }> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new Error('Thread not found');
    }

    // Upsert vote
    await this.prisma.forumThreadVote.upsert({
      where: {
        threadId_userId: {
          threadId,
          userId,
        },
      },
      update: {
        vote,
      },
      create: {
        threadId,
        userId,
        vote,
      },
    });

    // Calculate score
    const votes = await this.prisma.forumThreadVote.findMany({
      where: { threadId },
    });

    const upvotes = votes.filter((v) => v.vote === 'up').length;
    const downvotes = votes.filter((v) => v.vote === 'down').length;
    const score = upvotes - downvotes;

    return { score, upvotes, downvotes };
  }

  async removeThreadVote(
    threadId: string,
    userId: string
  ): Promise<{ score: number; upvotes: number; downvotes: number }> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new Error('Thread not found');
    }

    await this.prisma.forumThreadVote.deleteMany({
      where: {
        threadId,
        userId,
      },
    });

    const votes = await this.prisma.forumThreadVote.findMany({
      where: { threadId },
    });

    const upvotes = votes.filter((v) => v.vote === 'up').length;
    const downvotes = votes.filter((v) => v.vote === 'down').length;
    const score = upvotes - downvotes;

    return { score, upvotes, downvotes };
  }

  async getThreadVote(threadId: string, userId: string): Promise<'up' | 'down' | null> {
    const vote = await this.prisma.forumThreadVote.findUnique({
      where: {
        threadId_userId: {
          threadId,
          userId,
        },
      },
    });

    return (vote?.vote as 'up' | 'down') ?? null;
  }

  async votePost(
    postId: string,
    userId: string,
    vote: 'up' | 'down'
  ): Promise<{ score: number; upvotes: number; downvotes: number }> {
    await this.prisma.forumPostVote.upsert({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
      update: {
        vote,
      },
      create: {
        postId,
        userId,
        vote,
      },
    });

    const votes = await this.prisma.forumPostVote.findMany({
      where: { postId },
    });

    const upvotes = votes.filter((v) => v.vote === 'up').length;
    const downvotes = votes.filter((v) => v.vote === 'down').length;
    const score = upvotes - downvotes;

    return { score, upvotes, downvotes };
  }

  async removePostVote(
    postId: string,
    userId: string
  ): Promise<{ score: number; upvotes: number; downvotes: number }> {
    await this.prisma.forumPostVote.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    const votes = await this.prisma.forumPostVote.findMany({
      where: { postId },
    });

    const upvotes = votes.filter((v) => v.vote === 'up').length;
    const downvotes = votes.filter((v) => v.vote === 'down').length;
    const score = upvotes - downvotes;

    return { score, upvotes, downvotes };
  }

  async getPostVote(postId: string, userId: string): Promise<'up' | 'down' | null> {
    const vote = await this.prisma.forumPostVote.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    return (vote?.vote as 'up' | 'down') ?? null;
  }

  // Search
  async searchThreads(query: string): Promise<ForumThread[]> {
    const lowerQuery = query.toLowerCase();

    const threads = await this.prisma.forumThread.findMany({
      where: {
        OR: [
          { title: { contains: lowerQuery, mode: 'insensitive' } },
          { content: { contains: lowerQuery, mode: 'insensitive' } },
          { tags: { hasSome: [lowerQuery] } },
        ],
      },
    });

    return Promise.all(threads.map((thread) => this.mapThreadToForumThread(thread)));
  }

  async searchPosts(query: string): Promise<ForumPost[]> {
    const lowerQuery = query.toLowerCase();

    const posts = await this.prisma.forumPost.findMany({
      where: {
        content: { contains: lowerQuery, mode: 'insensitive' },
      },
    });

    return Promise.all(posts.map((post) => this.mapPostToForumPost(post)));
  }

  // Helper methods
  private async mapThreadToForumThread(
    thread: Awaited<ReturnType<typeof this.prisma.forumThread.findUnique>>
  ): Promise<ForumThread> {
    if (!thread) {
      throw new Error('Thread is null');
    }

    const [postCount, lastPost, reactions, votes] = await Promise.all([
      this.prisma.forumPost.count({
        where: { threadId: thread.id },
      }),
      this.prisma.forumPost.findFirst({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.forumThreadReaction.findMany({
        where: { threadId: thread.id },
      }),
      this.prisma.forumThreadVote.findMany({
        where: { threadId: thread.id },
      }),
    ]);

    const upvotes = votes.filter((v) => v.vote === 'up').length;
    const downvotes = votes.filter((v) => v.vote === 'down').length;
    const score = upvotes - downvotes;

    return {
      id: thread.id,
      categoryId: thread.categoryId,
      authorId: thread.authorId,
      title: thread.title,
      content: thread.content,
      postCount: postCount, // Already includes the first post
      lastPostAt: lastPost ? lastPost.createdAt.getTime() : thread.createdAt.getTime(),
      lastPostBy: lastPost ? lastPost.authorId : thread.authorId,
      isPinned: thread.isPinned,
      isLocked: thread.isLocked,
      createdAt: thread.createdAt.getTime(),
      updatedAt: thread.updatedAt.getTime(),
      reactions: reactions.map((r) => ({
        emoji: r.emoji,
        userId: r.userId,
        createdAt: r.createdAt.getTime(),
      })),
      score,
      upvotes,
      downvotes,
      tags: thread.tags,
      ...(thread.marketplaceItemId !== null && { marketplaceItemId: thread.marketplaceItemId }),
      ...(thread.projectToken !== null && { projectToken: thread.projectToken }),
    };
  }

  private async mapPostToForumPost(
    post: Awaited<ReturnType<typeof this.prisma.forumPost.findUnique>>
  ): Promise<ForumPost> {
    if (!post) {
      throw new Error('Post is null');
    }

    const reactions = await this.prisma.forumPostReaction.findMany({
      where: { postId: post.id },
    });

    return {
      id: post.id,
      threadId: post.threadId,
      authorId: post.authorId,
      content: post.content,
      reactions: reactions.map((r) => ({
        emoji: r.emoji,
        userId: r.userId,
        createdAt: r.createdAt.getTime(),
      })),
      mentions: post.mentions,
      ...(post.editedAt !== null && { editedAt: post.editedAt.getTime() }),
      createdAt: post.createdAt.getTime(),
    };
  }
}

