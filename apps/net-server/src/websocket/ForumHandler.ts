/**
 * WebSocket handler for real-time forum updates.
 */

import { SessionManager } from './SessionManager';
import type { ForumStorage, ForumThread, ForumPost, Reaction } from '../storage/ForumStorage';
import type {
  ForumThreadNewMessage,
  ForumThreadUpdatedMessage,
  ForumThreadDeletedMessage,
  ForumPostNewMessage,
  ForumPostUpdatedMessage,
  ForumPostDeletedMessage,
  ForumReactionNewMessage,
  ForumReactionRemovedMessage,
  ForumVoteChangedMessage,
} from '../types/websocket';

export class ForumHandler {
  private readonly sessionManager: SessionManager;

  constructor(sessionManager: SessionManager, _forumStorage: ForumStorage) {
    this.sessionManager = sessionManager;
  }

  /**
   * Broadcast a message to all connected users.
   */
  private broadcastToAll(message: unknown, excludeUserId?: string): void {
    const onlineUsers = this.sessionManager.getOnlineUsers();
    for (const userId of onlineUsers) {
      if (userId === excludeUserId) {
        continue;
      }
      this.sessionManager.sendToUser(userId, message);
    }
  }

  /**
   * Handle new thread created.
   * Broadcast to all users (clients can filter by category if needed).
   */
  async handleThreadCreated(
    thread: ForumThread,
    categoryId: string,
    excludeUserId?: string
  ): Promise<void> {
    const message: ForumThreadNewMessage = {
      type: 'forum:thread:new',
      timestamp: Date.now(),
      thread: {
        id: thread.id,
        categoryId: thread.categoryId,
        authorId: thread.authorId,
        title: thread.title,
        content: thread.content,
        postCount: thread.postCount,
        lastPostAt: thread.lastPostAt,
        lastPostBy: thread.lastPostBy,
        isPinned: thread.isPinned,
        isLocked: thread.isLocked,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        score: thread.score,
        upvotes: thread.upvotes,
        downvotes: thread.downvotes,
        tags: thread.tags,
      },
      categoryId,
    };

    this.broadcastToAll(message, excludeUserId);
  }

  /**
   * Handle thread updated.
   * Broadcast to all users.
   */
  async handleThreadUpdated(thread: ForumThread, excludeUserId?: string): Promise<void> {
    const message: ForumThreadUpdatedMessage = {
      type: 'forum:thread:updated',
      timestamp: Date.now(),
      thread: {
        id: thread.id,
        categoryId: thread.categoryId,
        title: thread.title,
        content: thread.content,
        tags: thread.tags,
        isPinned: thread.isPinned,
        isLocked: thread.isLocked,
        updatedAt: thread.updatedAt,
      },
    };

    this.broadcastToAll(message, excludeUserId);
  }

  /**
   * Handle thread deleted.
   * Broadcast to all users.
   */
  async handleThreadDeleted(threadId: string, categoryId: string): Promise<void> {
    const message: ForumThreadDeletedMessage = {
      type: 'forum:thread:deleted',
      timestamp: Date.now(),
      threadId,
      categoryId,
    };

    this.broadcastToAll(message);
  }

  /**
   * Handle new post created.
   * Broadcast to all users (clients can filter by thread if needed).
   */
  async handlePostCreated(
    post: ForumPost,
    threadId: string,
    excludeUserId?: string
  ): Promise<void> {
    const message: ForumPostNewMessage = {
      type: 'forum:post:new',
      timestamp: Date.now(),
      post: {
        id: post.id,
        threadId: post.threadId,
        authorId: post.authorId,
        content: post.content,
        reactions: post.reactions,
        mentions: post.mentions,
        createdAt: post.createdAt,
      },
      threadId,
    };

    this.broadcastToAll(message, excludeUserId);
  }

  /**
   * Handle post updated.
   * Broadcast to all users.
   */
  async handlePostUpdated(
    post: ForumPost,
    _threadId: string,
    excludeUserId?: string
  ): Promise<void> {
    const message: ForumPostUpdatedMessage = {
      type: 'forum:post:updated',
      timestamp: Date.now(),
      post: {
        id: post.id,
        threadId: post.threadId,
        content: post.content,
        editedAt: post.editedAt || Date.now(),
      },
    };

    this.broadcastToAll(message, excludeUserId);
  }

  /**
   * Handle post deleted.
   * Broadcast to all users.
   */
  async handlePostDeleted(postId: string, threadId: string): Promise<void> {
    const message: ForumPostDeletedMessage = {
      type: 'forum:post:deleted',
      timestamp: Date.now(),
      postId,
      threadId,
    };

    this.broadcastToAll(message);
  }

  /**
   * Handle reaction added.
   * Broadcast to all users.
   */
  async handleReactionAdded(
    threadId: string | null,
    postId: string | null,
    reaction: Reaction,
    excludeUserId?: string
  ): Promise<void> {
    const message: Omit<ForumReactionNewMessage, 'timestamp'> = {
      type: 'forum:reaction:new',
      reaction: {
        emoji: reaction.emoji,
        userId: reaction.userId,
        createdAt: reaction.createdAt,
      },
    };
    if (threadId) message.threadId = threadId;
    if (postId) message.postId = postId;
    const fullMessage: ForumReactionNewMessage = {
      ...message,
      timestamp: Date.now(),
    };

    this.broadcastToAll(fullMessage, excludeUserId);
  }

  /**
   * Handle reaction removed.
   * Broadcast to all users.
   */
  async handleReactionRemoved(
    threadId: string | null,
    postId: string | null,
    emoji: string,
    userId: string,
    excludeUserId?: string
  ): Promise<void> {
    const message: Omit<ForumReactionRemovedMessage, 'timestamp'> = {
      type: 'forum:reaction:removed',
      emoji,
      userId,
    };
    if (threadId) message.threadId = threadId;
    if (postId) message.postId = postId;
    const fullMessage: ForumReactionRemovedMessage = {
      ...message,
      timestamp: Date.now(),
    };

    this.broadcastToAll(fullMessage, excludeUserId);
  }

  /**
   * Handle vote changed.
   * Broadcast to all users.
   */
  async handleVoteChanged(
    threadId: string | null,
    postId: string | null,
    score: number,
    upvotes: number,
    downvotes: number,
    excludeUserId?: string
  ): Promise<void> {
    const message: Omit<ForumVoteChangedMessage, 'timestamp'> = {
      type: 'forum:vote:changed',
      score,
      upvotes,
      downvotes,
    };
    if (threadId) message.threadId = threadId;
    if (postId) message.postId = postId;
    const fullMessage: ForumVoteChangedMessage = {
      ...message,
      timestamp: Date.now(),
    };

    this.broadcastToAll(fullMessage, excludeUserId);
  }
}
