/**
 * Forum Storage - manages forum categories, threads, posts, and reactions
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface Reaction {
  emoji: string;
  userId: string;
  createdAt: number;
}

export interface ForumPost {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  reactions: Reaction[];
  mentions: string[]; // User IDs
  editedAt?: number;
  createdAt: number;
}

export interface ForumThread {
  id: string;
  categoryId: string;
  authorId: string;
  title: string;
  content: string; // First post content
  postCount: number;
  lastPostAt: number;
  lastPostBy: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: number;
  updatedAt: number;
  reactions: Reaction[];
  score: number; // Reddit-style voting score (upvotes - downvotes)
  upvotes: number;
  downvotes: number;
  tags: string[]; // Optional tags for categorization
  marketplaceItemId?: string; // Links to marketplace item
  projectToken?: string; // Links to shared project
}

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  threadCount: number;
  postCount: number;
  order: number;
  isLocked: boolean;
}

export interface ThreadVote {
  threadId: string;
  userId: string;
  vote: 'up' | 'down';
  createdAt: number;
}

export interface PostVote {
  postId: string;
  userId: string;
  vote: 'up' | 'down';
  createdAt: number;
}

export class ForumStorage {
  private readonly dataDir: string;
  private readonly categoriesFile: string;
  private readonly threadsFile: string;
  private readonly postsFile: string;
  private readonly threadVotesFile: string;
  private readonly postVotesFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.categoriesFile = path.join(dataDir, 'forum_categories.json');
    this.threadsFile = path.join(dataDir, 'forum_threads.json');
    this.postsFile = path.join(dataDir, 'forum_posts.json');
    this.threadVotesFile = path.join(dataDir, 'forum_thread_votes.json');
    this.postVotesFile = path.join(dataDir, 'forum_post_votes.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    const files = [
      this.categoriesFile,
      this.threadsFile,
      this.postsFile,
      this.threadVotesFile,
      this.postVotesFile,
    ];

    for (const file of files) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify([], null, 2));
      }
    }

    // Initialize default categories if none exist
    const categories = await this.readCategories();
    if (categories.length === 0) {
      const defaultCategories: ForumCategory[] = [
        {
          id: 'cat_general',
          name: 'General Discussion',
          description: 'General discussions about FORGE',
          icon: '💬',
          color: '#4ade80',
          threadCount: 0,
          postCount: 0,
          order: 1,
          isLocked: false,
        },
        {
          id: 'cat_showcase',
          name: 'Showcase',
          description: 'Share your builds and creations',
          icon: '✨',
          color: '#fbbf24',
          threadCount: 0,
          postCount: 0,
          order: 2,
          isLocked: false,
        },
        {
          id: 'cat_help',
          name: 'Help & Support',
          description: 'Get help with using FORGE',
          icon: '❓',
          color: '#3b82f6',
          threadCount: 0,
          postCount: 0,
          order: 3,
          isLocked: false,
        },
        {
          id: 'cat_feature',
          name: 'Feature Requests',
          description: 'Suggest new features',
          icon: '💡',
          color: '#a855f7',
          threadCount: 0,
          postCount: 0,
          order: 4,
          isLocked: false,
        },
      ];
      await this.writeCategories(defaultCategories);
    }
  }

  // Categories
  private async readCategories(): Promise<ForumCategory[]> {
    try {
      const data = await fs.readFile(this.categoriesFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeCategories(categories: ForumCategory[]): Promise<void> {
    await fs.writeFile(this.categoriesFile, JSON.stringify(categories, null, 2));
  }

  async getCategories(): Promise<ForumCategory[]> {
    const categories = await this.readCategories();
    // Update counts from threads/posts
    const threads = await this.readThreads();
    const posts = await this.readPosts();

    return categories
      .map((cat) => {
        const categoryThreads = threads.filter((t) => t.categoryId === cat.id);
        const categoryPostIds = new Set(categoryThreads.map((t) => t.id));
        const categoryPosts = posts.filter((p) => categoryPostIds.has(p.threadId));

        return {
          ...cat,
          threadCount: categoryThreads.length,
          postCount: categoryPosts.length,
        };
      })
      .sort((a, b) => a.order - b.order);
  }

  async getCategory(id: string): Promise<ForumCategory | null> {
    const categories = await this.readCategories();
    return categories.find((c) => c.id === id) ?? null;
  }

  async createCategory(
    category: Omit<ForumCategory, 'threadCount' | 'postCount'>
  ): Promise<ForumCategory> {
    const categories = await this.readCategories();

    if (categories.some((c) => c.id === category.id)) {
      throw new Error('Category with this ID already exists');
    }

    const newCategory: ForumCategory = {
      ...category,
      threadCount: 0,
      postCount: 0,
    };

    categories.push(newCategory);
    await this.writeCategories(categories);
    return newCategory;
  }

  async updateCategory(id: string, updates: Partial<ForumCategory>): Promise<ForumCategory | null> {
    const categories = await this.readCategories();
    const category = categories.find((c) => c.id === id);

    if (!category) {
      return null;
    }

    Object.assign(category, updates);
    await this.writeCategories(categories);

    // Recalculate counts
    const threads = await this.readThreads();
    const posts = await this.readPosts();
    const categoryThreads = threads.filter((t) => t.categoryId === id);
    const categoryPostIds = new Set(categoryThreads.map((t) => t.id));
    const categoryPosts = posts.filter((p) => categoryPostIds.has(p.threadId));
    category.threadCount = categoryThreads.length;
    category.postCount = categoryPosts.length;

    return category;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const categories = await this.readCategories();
    const category = categories.find((c) => c.id === id);

    if (!category) {
      return false;
    }

    // Check if category has threads
    const threads = await this.readThreads();
    const categoryThreads = threads.filter((t) => t.categoryId === id);
    if (categoryThreads.length > 0) {
      throw new Error('Cannot delete category with existing threads');
    }

    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) {
      return false;
    }

    categories.splice(index, 1);
    await this.writeCategories(categories);
    return true;
  }

  async getAllThreads(params?: {
    limit?: number;
    offset?: number;
    categoryId?: string;
    authorId?: string;
    search?: string;
  }): Promise<{ threads: ForumThread[]; total: number }> {
    let threads = await this.readThreads();

    // Apply filters
    if (params?.categoryId) {
      threads = threads.filter((t) => t.categoryId === params.categoryId);
    }
    if (params?.authorId) {
      threads = threads.filter((t) => t.authorId === params.authorId);
    }
    if (params?.search) {
      const lowerQuery = params.search.toLowerCase();
      threads = threads.filter(
        (t) =>
          t.title.toLowerCase().includes(lowerQuery) ||
          t.content.toLowerCase().includes(lowerQuery) ||
          t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    }

    const total = threads.length;

    // Sort by most recent first
    threads.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    if (params?.offset !== undefined && params?.limit) {
      threads = threads.slice(params.offset, params.offset + params.limit);
    } else if (params?.limit) {
      threads = threads.slice(0, params.limit);
    }

    return { threads, total };
  }

  async getAllPosts(params?: {
    limit?: number;
    offset?: number;
    threadId?: string;
    authorId?: string;
    search?: string;
  }): Promise<{ posts: ForumPost[]; total: number }> {
    let posts = await this.readPosts();

    // Apply filters
    if (params?.threadId) {
      posts = posts.filter((p) => p.threadId === params.threadId);
    }
    if (params?.authorId) {
      posts = posts.filter((p) => p.authorId === params.authorId);
    }
    if (params?.search) {
      const lowerQuery = params.search.toLowerCase();
      posts = posts.filter((p) => p.content.toLowerCase().includes(lowerQuery));
    }

    const total = posts.length;

    // Sort by most recent first
    posts.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    if (params?.offset !== undefined && params?.limit) {
      posts = posts.slice(params.offset, params.offset + params.limit);
    } else if (params?.limit) {
      posts = posts.slice(0, params.limit);
    }

    return { posts, total };
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
    const categories = await this.readCategories();
    const threads = await this.readThreads();
    const posts = await this.readPosts();

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    const threadsLast24h = threads.filter((t) => now - t.createdAt < oneDay).length;
    const threadsLast7d = threads.filter((t) => now - t.createdAt < oneWeek).length;
    const threadsLast30d = threads.filter((t) => now - t.createdAt < oneMonth).length;

    const postsLast24h = posts.filter((p) => now - p.createdAt < oneDay).length;
    const postsLast7d = posts.filter((p) => now - p.createdAt < oneWeek).length;
    const postsLast30d = posts.filter((p) => now - p.createdAt < oneMonth).length;

    // Calculate top categories by thread count
    const categoryStats = categories
      .map((cat) => {
        const categoryThreads = threads.filter((t) => t.categoryId === cat.id);
        const categoryPostIds = new Set(categoryThreads.map((t) => t.id));
        const categoryPosts = posts.filter((p) => categoryPostIds.has(p.threadId));
        return {
          id: cat.id,
          name: cat.name,
          threadCount: categoryThreads.length,
          postCount: categoryPosts.length,
        };
      })
      .sort((a, b) => b.threadCount - a.threadCount)
      .slice(0, 5);

    return {
      categories: {
        total: categories.length,
      },
      threads: {
        total: threads.length,
        last24h: threadsLast24h,
        last7d: threadsLast7d,
        last30d: threadsLast30d,
      },
      posts: {
        total: posts.length,
        last24h: postsLast24h,
        last7d: postsLast7d,
        last30d: postsLast30d,
      },
      topCategories: categoryStats,
    };
  }

  // Threads
  private async readThreads(): Promise<ForumThread[]> {
    try {
      const data = await fs.readFile(this.threadsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeThreads(threads: ForumThread[]): Promise<void> {
    await fs.writeFile(this.threadsFile, JSON.stringify(threads, null, 2));
  }

  async getThreads(
    categoryId?: string,
    sortBy: 'hot' | 'new' | 'top' = 'hot'
  ): Promise<ForumThread[]> {
    const threads = await this.readThreads();
    let filtered = categoryId ? threads.filter((t) => t.categoryId === categoryId) : threads;

    // Sort by pinned first, then by sort option
    filtered = filtered.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      switch (sortBy) {
        case 'new':
          return b.createdAt - a.createdAt;
        case 'top':
          return b.score - a.score;
        case 'hot':
        default:
          // Hot = combination of score and recency
          const timeA = Date.now() - a.lastPostAt;
          const timeB = Date.now() - b.lastPostAt;
          const hoursA = timeA / (1000 * 60 * 60);
          const hoursB = timeB / (1000 * 60 * 60);
          // Formula: score / (hours + 2) ^ 1.5 (Reddit-style hot algorithm)
          const hotScoreA = a.score / Math.pow(hoursA + 2, 1.5);
          const hotScoreB = b.score / Math.pow(hoursB + 2, 1.5);
          return hotScoreB - hotScoreA;
      }
    });

    return filtered;
  }

  async getThread(id: string): Promise<ForumThread | null> {
    const threads = await this.readThreads();
    return threads.find((t) => t.id === id) ?? null;
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
    const threads = await this.readThreads();
    const now = Date.now();

    const newThread: ForumThread = {
      ...thread,
      id: `thread_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      postCount: 1, // First post is the thread content
      lastPostAt: now,
      lastPostBy: thread.authorId,
      createdAt: now,
      updatedAt: now,
      reactions: [],
      score: 0,
      upvotes: 0,
      downvotes: 0,
      tags: thread.tags || [],
    };

    threads.push(newThread);
    await this.writeThreads(threads);

    // Create first post (thread content)
    await this.createPost({
      threadId: newThread.id,
      authorId: thread.authorId,
      content: thread.content,
      reactions: [],
      mentions: [],
      createdAt: now,
    });

    return newThread;
  }

  async updateThread(
    id: string,
    updates: Partial<ForumThread>,
    _userId: string
  ): Promise<ForumThread | null> {
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === id);

    if (!thread) {
      return null;
    }

    // Check permissions (author or moderator)
    // Note: Moderator check would be done at API level

    Object.assign(thread, updates, { updatedAt: Date.now() });
    await this.writeThreads(threads);
    return thread;
  }

  async deleteThread(id: string, userId: string, force = false): Promise<boolean> {
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === id);

    if (!thread) {
      return false;
    }

    // Check permissions unless forced (admin/moderator)
    if (!force && thread.authorId !== userId) {
      return false;
    }

    const index = threads.findIndex((t) => t.id === id);
    if (index === -1) {
      return false;
    }

    threads.splice(index, 1);
    await this.writeThreads(threads);

    // Delete all posts in this thread
    const posts = await this.readPosts();
    const filteredPosts = posts.filter((p) => p.threadId !== id);
    await this.writePosts(filteredPosts);

    return true;
  }

  async pinThread(threadId: string): Promise<boolean> {
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === threadId);

    if (!thread) {
      return false;
    }

    thread.isPinned = true;
    await this.writeThreads(threads);
    return true;
  }

  async unpinThread(threadId: string): Promise<boolean> {
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === threadId);

    if (!thread) {
      return false;
    }

    thread.isPinned = false;
    await this.writeThreads(threads);
    return true;
  }

  async lockThread(threadId: string): Promise<boolean> {
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === threadId);

    if (!thread) {
      return false;
    }

    thread.isLocked = true;
    await this.writeThreads(threads);
    return true;
  }

  async unlockThread(threadId: string): Promise<boolean> {
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === threadId);

    if (!thread) {
      return false;
    }

    thread.isLocked = false;
    await this.writeThreads(threads);
    return true;
  }

  // Posts
  private async readPosts(): Promise<ForumPost[]> {
    try {
      const data = await fs.readFile(this.postsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writePosts(posts: ForumPost[]): Promise<void> {
    await fs.writeFile(this.postsFile, JSON.stringify(posts, null, 2));
  }

  async getPosts(threadId: string, sortBy: 'new' | 'top' = 'new'): Promise<ForumPost[]> {
    const posts = await this.readPosts();
    const filtered = posts.filter((p) => p.threadId === threadId);

    // Get votes for sorting
    const votes = await this.readPostVotes();
    const postsWithScores = filtered.map((post) => {
      const postVotes = votes.filter((v) => v.postId === post.id);
      const upvotes = postVotes.filter((v) => v.vote === 'up').length;
      const downvotes = postVotes.filter((v) => v.vote === 'down').length;
      const score = upvotes - downvotes;
      return { post, score, upvotes, downvotes };
    });

    if (sortBy === 'top') {
      postsWithScores.sort((a, b) => b.score - a.score);
    } else {
      // New - sort by creation time
      postsWithScores.sort((a, b) => a.post.createdAt - b.post.createdAt);
    }

    return postsWithScores.map((p) => p.post);
  }

  async getPost(id: string): Promise<ForumPost | null> {
    const posts = await this.readPosts();
    return posts.find((p) => p.id === id) ?? null;
  }

  async createPost(post: Omit<ForumPost, 'id'>): Promise<ForumPost> {
    const posts = await this.readPosts();
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === post.threadId);

    if (!thread) {
      throw new Error('Thread not found');
    }

    if (thread.isLocked) {
      throw new Error('Thread is locked');
    }

    const newPost: ForumPost = {
      ...post,
      id: `post_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };

    posts.push(newPost);
    await this.writePosts(posts);

    // Update thread stats
    thread.postCount++;
    thread.lastPostAt = newPost.createdAt;
    thread.lastPostBy = newPost.authorId;
    thread.updatedAt = newPost.createdAt;
    await this.writeThreads(threads);

    return newPost;
  }

  async updatePost(
    id: string,
    updates: Partial<ForumPost>,
    userId: string
  ): Promise<ForumPost | null> {
    const posts = await this.readPosts();
    const post = posts.find((p) => p.id === id);

    if (!post || post.authorId !== userId) {
      return null;
    }

    Object.assign(post, updates, { editedAt: Date.now() });
    await this.writePosts(posts);
    return post;
  }

  async deletePost(id: string, userId: string, force = false): Promise<boolean> {
    const posts = await this.readPosts();
    const post = posts.find((p) => p.id === id);

    if (!post) {
      return false;
    }

    // Check permissions unless forced (admin/moderator)
    if (!force && post.authorId !== userId) {
      return false;
    }

    const index = posts.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }

    posts.splice(index, 1);
    await this.writePosts(posts);

    // Update thread stats
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === post.threadId);
    if (thread) {
      thread.postCount = Math.max(0, thread.postCount - 1);
      // Update lastPostAt to most recent remaining post
      const remainingPosts = posts.filter((p) => p.threadId === thread.id);
      if (remainingPosts.length > 0) {
        const sorted = remainingPosts.sort((a, b) => b.createdAt - a.createdAt);
        const lastPost = sorted[0];
        if (lastPost) {
          thread.lastPostAt = lastPost.createdAt;
          thread.lastPostBy = lastPost.authorId;
        }
      } else {
        // No posts left, use thread creation time
        thread.lastPostAt = thread.createdAt;
        thread.lastPostBy = thread.authorId;
      }
      await this.writeThreads(threads);
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
      const threads = await this.readThreads();
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) {
        return false;
      }

      // Remove existing reaction from this user for this emoji
      thread.reactions = thread.reactions.filter(
        (r) => !(r.userId === userId && r.emoji === emoji)
      );

      // Add new reaction
      thread.reactions.push({
        emoji,
        userId,
        createdAt: Date.now(),
      });

      await this.writeThreads(threads);
      return true;
    }

    if (postId) {
      const posts = await this.readPosts();
      const post = posts.find((p) => p.id === postId);
      if (!post) {
        return false;
      }

      // Remove existing reaction from this user for this emoji
      post.reactions = post.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji));

      // Add new reaction
      post.reactions.push({
        emoji,
        userId,
        createdAt: Date.now(),
      });

      await this.writePosts(posts);
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
      const threads = await this.readThreads();
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) {
        return false;
      }

      thread.reactions = thread.reactions.filter(
        (r) => !(r.userId === userId && r.emoji === emoji)
      );
      await this.writeThreads(threads);
      return true;
    }

    if (postId) {
      const posts = await this.readPosts();
      const post = posts.find((p) => p.id === postId);
      if (!post) {
        return false;
      }

      post.reactions = post.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji));
      await this.writePosts(posts);
      return true;
    }

    return false;
  }

  // Voting (Reddit-style)
  private async readThreadVotes(): Promise<ThreadVote[]> {
    try {
      const data = await fs.readFile(this.threadVotesFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeThreadVotes(votes: ThreadVote[]): Promise<void> {
    await fs.writeFile(this.threadVotesFile, JSON.stringify(votes, null, 2));
  }

  private async readPostVotes(): Promise<PostVote[]> {
    try {
      const data = await fs.readFile(this.postVotesFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writePostVotes(votes: PostVote[]): Promise<void> {
    await fs.writeFile(this.postVotesFile, JSON.stringify(votes, null, 2));
  }

  async voteThread(
    threadId: string,
    userId: string,
    vote: 'up' | 'down'
  ): Promise<{ score: number; upvotes: number; downvotes: number }> {
    const votes = await this.readThreadVotes();
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === threadId);

    if (!thread) {
      throw new Error('Thread not found');
    }

    // Remove existing vote from this user
    const filteredVotes = votes.filter((v) => !(v.threadId === threadId && v.userId === userId));

    // Add new vote
    filteredVotes.push({
      threadId,
      userId,
      vote,
      createdAt: Date.now(),
    });

    await this.writeThreadVotes(filteredVotes);

    // Update thread score
    const threadVotes = filteredVotes.filter((v) => v.threadId === threadId);
    thread.upvotes = threadVotes.filter((v) => v.vote === 'up').length;
    thread.downvotes = threadVotes.filter((v) => v.vote === 'down').length;
    thread.score = thread.upvotes - thread.downvotes;
    await this.writeThreads(threads);

    return {
      score: thread.score,
      upvotes: thread.upvotes,
      downvotes: thread.downvotes,
    };
  }

  async removeThreadVote(
    threadId: string,
    userId: string
  ): Promise<{ score: number; upvotes: number; downvotes: number }> {
    const votes = await this.readThreadVotes();
    const threads = await this.readThreads();
    const thread = threads.find((t) => t.id === threadId);

    if (!thread) {
      throw new Error('Thread not found');
    }

    const filteredVotes = votes.filter((v) => !(v.threadId === threadId && v.userId === userId));
    await this.writeThreadVotes(filteredVotes);

    // Update thread score
    const threadVotes = filteredVotes.filter((v) => v.threadId === threadId);
    thread.upvotes = threadVotes.filter((v) => v.vote === 'up').length;
    thread.downvotes = threadVotes.filter((v) => v.vote === 'down').length;
    thread.score = thread.upvotes - thread.downvotes;
    await this.writeThreads(threads);

    return {
      score: thread.score,
      upvotes: thread.upvotes,
      downvotes: thread.downvotes,
    };
  }

  async getThreadVote(threadId: string, userId: string): Promise<'up' | 'down' | null> {
    const votes = await this.readThreadVotes();
    const vote = votes.find((v) => v.threadId === threadId && v.userId === userId);
    return vote?.vote ?? null;
  }

  async votePost(
    postId: string,
    userId: string,
    vote: 'up' | 'down'
  ): Promise<{ score: number; upvotes: number; downvotes: number }> {
    const votes = await this.readPostVotes();

    // Remove existing vote from this user
    const filteredVotes = votes.filter((v) => !(v.postId === postId && v.userId === userId));

    // Add new vote
    filteredVotes.push({
      postId,
      userId,
      vote,
      createdAt: Date.now(),
    });

    await this.writePostVotes(filteredVotes);

    // Calculate score
    const postVotes = filteredVotes.filter((v) => v.postId === postId);
    const upvotes = postVotes.filter((v) => v.vote === 'up').length;
    const downvotes = postVotes.filter((v) => v.vote === 'down').length;
    const score = upvotes - downvotes;

    return { score, upvotes, downvotes };
  }

  async removePostVote(
    postId: string,
    userId: string
  ): Promise<{ score: number; upvotes: number; downvotes: number }> {
    const votes = await this.readPostVotes();
    const filteredVotes = votes.filter((v) => !(v.postId === postId && v.userId === userId));
    await this.writePostVotes(filteredVotes);

    const postVotes = filteredVotes.filter((v) => v.postId === postId);
    const upvotes = postVotes.filter((v) => v.vote === 'up').length;
    const downvotes = postVotes.filter((v) => v.vote === 'down').length;
    const score = upvotes - downvotes;

    return { score, upvotes, downvotes };
  }

  async getPostVote(postId: string, userId: string): Promise<'up' | 'down' | null> {
    const votes = await this.readPostVotes();
    const vote = votes.find((v) => v.postId === postId && v.userId === userId);
    return vote?.vote ?? null;
  }

  // Search
  async searchThreads(query: string): Promise<ForumThread[]> {
    const threads = await this.readThreads();
    const lowerQuery = query.toLowerCase();

    return threads.filter(
      (thread) =>
        thread.title.toLowerCase().includes(lowerQuery) ||
        thread.content.toLowerCase().includes(lowerQuery) ||
        thread.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async searchPosts(query: string): Promise<ForumPost[]> {
    const posts = await this.readPosts();
    const lowerQuery = query.toLowerCase();

    return posts.filter((post) => post.content.toLowerCase().includes(lowerQuery));
  }
}
