import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PostCard } from '../PostCard';
import { MemoryRouter } from 'react-router-dom';
import type { ForumPost } from '../../../api/forum';

const mockPost: ForumPost = {
  id: 'post-1',
  threadId: 'thread-1',
  authorId: 'user-1',
  content: 'This is a test post',
  reactions: [],
  mentions: [],
  createdAt: Date.now() - 3600000,
  score: 5,
  upvotes: 7,
  downvotes: 2,
  userVote: null,
};

describe('PostCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders post content', () => {
    render(
      <MemoryRouter>
        <PostCard post={mockPost} />
      </MemoryRouter>
    );

    expect(screen.getByText('This is a test post')).toBeInTheDocument();
  });

  it('renders post score', () => {
    render(
      <MemoryRouter>
        <PostCard post={mockPost} />
      </MemoryRouter>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows OP badge when post author is thread author', () => {
    render(
      <MemoryRouter>
        <PostCard post={mockPost} threadAuthorId="user-1" />
      </MemoryRouter>
    );

    expect(screen.getByText(/OP/i)).toBeInTheDocument();
  });
});

