import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import type { ForumPost } from '../../api/forum';

interface ForumPostModerationProps {
  post: ForumPost;
  threadTitle?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete?: () => void;
  onWarn?: () => void;
}

export function ForumPostModeration({
  post,
  threadTitle,
  onApprove,
  onReject,
  onDelete,
  onWarn,
}: ForumPostModerationProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: () => void | undefined) => {
    if (!action) return;
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  };

  const contentPreview = post.content.length > 200
    ? `${post.content.substring(0, 200)}...`
    : post.content;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          {threadTitle && (
            <div style={{ marginBottom: '0.5rem' }}>
              <Link
                to={`/community/thread/${post.threadId}`}
                style={{ color: 'var(--text-secondary, #666)', textDecoration: 'none', fontSize: '0.875rem' }}
              >
                Thread: {threadTitle}
              </Link>
            </div>
          )}
          <p style={{ color: 'var(--text-1)', marginBottom: '0.5rem' }}>
            {contentPreview}
          </p>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
            Author: {post.authorId} | 
            Created: {new Date(post.createdAt).toLocaleString()}
            {post.editedAt && ` | Edited: ${new Date(post.editedAt).toLocaleString()}`}
            {post.score !== undefined && ` | Score: ${post.score}`}
            {post.upvotes !== undefined && post.downvotes !== undefined && (
              ` (${post.upvotes}↑ / ${post.downvotes}↓)`
            )}
          </div>
          {post.reactions.length > 0 && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {post.reactions.map((reaction, idx) => (
                <span
                  key={`${reaction.emoji}-${idx}`}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-button)',
                    fontSize: '0.75rem',
                  }}
                >
                  {reaction.emoji}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onApprove && (
            <Button
              variant="primary"
              size="small"
              onClick={() => handleAction(onApprove)}
              disabled={loading}
            >
              Approve
            </Button>
          )}
          {onReject && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleAction(onReject)}
              disabled={loading}
            >
              Reject
            </Button>
          )}
          {onWarn && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleAction(onWarn)}
              disabled={loading}
            >
              Warn
            </Button>
          )}
          {onDelete && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleAction(onDelete)}
              disabled={loading}
              style={{ background: 'var(--bg-error, #ffebee)', color: 'var(--color-error, #c62828)' }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

