import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VotingButtons } from '../VotingButtons';

describe('VotingButtons', () => {
  const mockOnVote = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders voting buttons with score', () => {
    render(
      <VotingButtons
        score={42}
        userVote={null}
        onVote={mockOnVote}
      />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByLabelText('Upvote')).toBeInTheDocument();
    expect(screen.getByLabelText('Downvote')).toBeInTheDocument();
  });

  it('calls onVote when upvote button is clicked', async () => {
    render(
      <VotingButtons
        score={0}
        userVote={null}
        onVote={mockOnVote}
      />
    );

    const upvoteButton = screen.getByLabelText('Upvote');
    fireEvent.click(upvoteButton);

    await waitFor(() => {
      expect(mockOnVote).toHaveBeenCalledWith('up');
    });
  });

  it('calls onVote when downvote button is clicked', async () => {
    render(
      <VotingButtons
        score={0}
        userVote={null}
        onVote={mockOnVote}
      />
    );

    const downvoteButton = screen.getByLabelText('Downvote');
    fireEvent.click(downvoteButton);

    await waitFor(() => {
      expect(mockOnVote).toHaveBeenCalledWith('down');
    });
  });

  it('disables buttons when disabled prop is true', () => {
    render(
      <VotingButtons
        score={0}
        userVote={null}
        onVote={mockOnVote}
        disabled={true}
      />
    );

    expect(screen.getByLabelText('Upvote')).toBeDisabled();
    expect(screen.getByLabelText('Downvote')).toBeDisabled();
  });

  it('shows active state for upvote when userVote is up', () => {
    render(
      <VotingButtons
        score={1}
        userVote="up"
        onVote={mockOnVote}
      />
    );

    const upvoteButton = screen.getByLabelText('Upvote');
    expect(upvoteButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows active state for downvote when userVote is down', () => {
    render(
      <VotingButtons
        score={-1}
        userVote="down"
        onVote={mockOnVote}
      />
    );

    const downvoteButton = screen.getByLabelText('Downvote');
    expect(downvoteButton).toHaveAttribute('aria-pressed', 'true');
  });
});

