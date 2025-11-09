/**
 * Forum API calls
 */

import { apiClient } from './client';

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
  mentions: string[];
  editedAt?: number;
  createdAt: number;
  score?: number; // From votes
  upvotes?: number;
  downvotes?: number;
  userVote?: 'up' | 'down' | null;
}

export interface ForumThread {
  id: string;
  categoryId: string;
  authorId: string;
  title: string;
  content: string;
  postCount: number;
  lastPostAt: number;
  lastPostBy: string;
  isPinned: boolean;
  isLocked: boolean;
  isSolved?: boolean;
  isFollowed?: boolean;
  isBookmarked?: boolean;
  createdAt: number;
  updatedAt: number;
  reactions: Reaction[];
  score: number;
  upvotes: number;
  downvotes: number;
  tags: string[];
  marketplaceItemId?: string;
  projectToken?: string;
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

export interface ThreadResponse {
  thread: ForumThread;
  posts: ForumPost[];
  userVote: 'up' | 'down' | null;
}

export interface CategoryResponse {
  category: ForumCategory;
  threads: ForumThread[];
}

export interface SearchResponse {
  threads: ForumThread[];
  posts: ForumPost[];
}

export interface VoteResult {
  score: number;
  upvotes: number;
  downvotes: number;
}

export const forumApi = {
  async getCategories(): Promise<ForumCategory[]> {
    return apiClient.get<ForumCategory[]>('/forum/categories');
  },

  async getCategory(id: string, sort: 'hot' | 'new' | 'top' = 'hot'): Promise<CategoryResponse> {
    return apiClient.get<CategoryResponse>(`/forum/categories/${id}?sort=${sort}`);
  },

  async createCategory(data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    order?: number;
    isLocked?: boolean;
  }): Promise<ForumCategory> {
    return apiClient.post<ForumCategory>('/forum/categories', data);
  },

  async getThread(id: string, sort: 'new' | 'top' = 'new'): Promise<ThreadResponse> {
    return apiClient.get<ThreadResponse>(`/forum/threads/${id}?sort=${sort}`);
  },

  async createThread(data: {
    categoryId: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<ForumThread> {
    return apiClient.post<ForumThread>('/forum/threads', data);
  },

  async updateThread(id: string, data: {
    title?: string;
    content?: string;
    tags?: string[];
  }): Promise<ForumThread> {
    return apiClient.put<ForumThread>(`/forum/threads/${id}`, data);
  },

  async deleteThread(id: string): Promise<void> {
    return apiClient.delete(`/forum/threads/${id}`);
  },

  async createPost(threadId: string, content: string): Promise<ForumPost> {
    return apiClient.post<ForumPost>(`/forum/threads/${threadId}/posts`, { content });
  },

  async updatePost(id: string, content: string): Promise<ForumPost> {
    return apiClient.put<ForumPost>(`/forum/posts/${id}`, { content });
  },

  async deletePost(id: string): Promise<void> {
    return apiClient.delete(`/forum/posts/${id}`);
  },

  async addPostReaction(postId: string, emoji: string): Promise<void> {
    return apiClient.post(`/forum/posts/${postId}/reactions`, { emoji });
  },

  async removePostReaction(postId: string, emoji: string): Promise<void> {
    return apiClient.delete(`/forum/posts/${postId}/reactions/${encodeURIComponent(emoji)}`);
  },

  async addThreadReaction(threadId: string, emoji: string): Promise<void> {
    // Note: Thread reactions use the same endpoint pattern but with thread ID
    // This needs backend support - for now, we'll use a placeholder
    return apiClient.post(`/forum/threads/${threadId}/reactions`, { emoji });
  },

  async removeThreadReaction(threadId: string, emoji: string): Promise<void> {
    return apiClient.delete(`/forum/threads/${threadId}/reactions/${encodeURIComponent(emoji)}`);
  },

  async voteThread(threadId: string, vote: 'up' | 'down'): Promise<VoteResult> {
    return apiClient.post<VoteResult>(`/forum/threads/${threadId}/vote`, { vote });
  },

  async removeThreadVote(threadId: string): Promise<VoteResult> {
    return apiClient.delete<VoteResult>(`/forum/threads/${threadId}/vote`);
  },

  async votePost(postId: string, vote: 'up' | 'down'): Promise<VoteResult> {
    return apiClient.post<VoteResult>(`/forum/posts/${postId}/vote`, { vote });
  },

  async removePostVote(postId: string): Promise<VoteResult> {
    return apiClient.delete<VoteResult>(`/forum/posts/${postId}/vote`);
  },

  async pinThread(threadId: string): Promise<void> {
    return apiClient.post(`/forum/threads/${threadId}/pin`);
  },

  async unpinThread(threadId: string): Promise<void> {
    return apiClient.delete(`/forum/threads/${threadId}/pin`);
  },

  async lockThread(threadId: string): Promise<void> {
    return apiClient.post(`/forum/threads/${threadId}/lock`);
  },

  async unlockThread(threadId: string): Promise<void> {
    return apiClient.delete(`/forum/threads/${threadId}/lock`);
  },

  async search(query: string): Promise<SearchResponse> {
    return apiClient.get<SearchResponse>(`/forum/search?q=${encodeURIComponent(query)}`);
  },

  // Engagement features
  async followThread(threadId: string): Promise<void> {
    return apiClient.post(`/forum/threads/${threadId}/follow`);
  },

  async unfollowThread(threadId: string): Promise<void> {
    return apiClient.delete(`/forum/threads/${threadId}/follow`);
  },

  async bookmarkThread(threadId: string): Promise<void> {
    return apiClient.post(`/forum/threads/${threadId}/save`);
  },

  async unbookmarkThread(threadId: string): Promise<void> {
    return apiClient.delete(`/forum/threads/${threadId}/save`);
  },

  async markThreadSolved(threadId: string): Promise<void> {
    return apiClient.post(`/forum/threads/${threadId}/mark-solved`);
  },

  async acceptAnswer(postId: string): Promise<void> {
    return apiClient.post(`/forum/posts/${postId}/accept`);
  },
};
