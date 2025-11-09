import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreadCard } from '../ThreadCard';
import { MemoryRouter } from 'react-router-dom';
import type { ForumThread } from '../../../api/forum';

const mockThread: ForumThread = {
  id: 'thread-1',
  categoryId: 'cat-1',
  authorId: 'user-1',
  title: 'Test Thread',
  content: 'This is a test thread content',
  postCount: 5,
  lastPostAt: Date.now() - 3600000,
  lastPostBy: 'user-2',
  isPinned: false,
  isLocked: false,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 86400000,
  reactions: [],
  score: 10,
  upvotes: 12,
  downvotes: 2,
  tags: ['test', 'help'],
};

describe('ThreadCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders thread title', () => {
    render(
      <MemoryRouter>
        <ThreadCard thread={mockThread} />
      </MemoryRouter>
    );

    expect(screen.getByText('Test Thread')).toBeInTheDocument();
  });

  it('renders thread preview', () => {
    render(
      <MemoryRouter>
        <ThreadCard thread={mockThread} />
      </MemoryRouter>
    );

    expect(screen.getByText(/This is a test thread content/)).toBeInTheDocument();
  });

  it('renders thread score', () => {
    render(
      <MemoryRouter>
        <ThreadCard thread={mockThread} />
      </MemoryRouter>
    );

    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders thread badges for pinned threads', () => {
    const pinnedThread = { ...mockThread, isPinned: true };
    render(
      <MemoryRouter>
        <ThreadCard thread={pinnedThread} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Pinned/i)).toBeInTheDocument();
  });

  it('renders thread badges for locked threads', () => {
    const lockedThread = { ...mockThread, isLocked: true };
    render(
      <MemoryRouter>
        <ThreadCard thread={lockedThread} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Locked/i)).toBeInTheDocument();
  });

  it('renders thread badges for solved threads', () => {
    const solvedThread = { ...mockThread, isSolved: true };
    render(
      <MemoryRouter>
        <ThreadCard thread={solvedThread} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Solved/i)).toBeInTheDocument();
  });
});

