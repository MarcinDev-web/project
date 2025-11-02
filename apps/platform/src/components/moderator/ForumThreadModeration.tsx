import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import type { ForumThread } from '../../api/forum';

interface ForumThreadModerationProps {
  thread: ForumThread;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete?: () => void;
  onWarn?: () => void;
  onLock?: () => void;
  onUnlock?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
}

export function ForumThreadModeration({
  thread,
  onApprove,
  onReject,
  onDelete,
  onWarn,
  onLock,
  onUnlock,
  onPin,
  onUnpin,
}: ForumThreadModerationProps) {
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

  const contentPreview = thread.content.length > 200
    ? `${thread.content.substring(0, 200)}...`
    : thread.content;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.125rem', margin: 0 }}>
              <Link to={`/community/thread/${thread.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                {thread.title}
              </Link>
            </h3>
            {thread.isPinned && (
              <span style={{
                padding: '0.25rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-warning, #fff3e0)',
                fontSize: '0.75rem',
              }}>
                📌 Pinned
              </span>
            )}
            {thread.isLocked && (
              <span style={{
                padding: '0.25rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-error, #ffebee)',
                fontSize: '0.75rem',
              }}>
                🔒 Locked
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '0.5rem' }}>
            {contentPreview}
          </p>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)', marginBottom: '0.5rem' }}>
            Author: {thread.authorId} | 
            Created: {new Date(thread.createdAt).toLocaleString()} | 
            Posts: {thread.postCount} | 
            Score: {thread.score} ({thread.upvotes}↑ / {thread.downvotes}↓)
          </div>
          {thread.tags.length > 0 && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {thread.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-button)',
                    fontSize: '0.75rem',
                  }}
                >
                  {tag}
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
          {thread.isLocked ? (
            onUnlock && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleAction(onUnlock)}
                disabled={loading}
              >
                Unlock
              </Button>
            )
          ) : (
            onLock && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleAction(onLock)}
                disabled={loading}
              >
                Lock
              </Button>
            )
          )}
          {thread.isPinned ? (
            onUnpin && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleAction(onUnpin)}
                disabled={loading}
              >
                Unpin
              </Button>
            )
          ) : (
            onPin && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleAction(onPin)}
                disabled={loading}
              >
                Pin
              </Button>
            )
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

