import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import type { ForumThread } from '../../api/forum';

interface ForumThreadListProps {
  threads: ForumThread[];
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function ForumThreadList({ threads }: ForumThreadListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
      {threads.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--text-2)', margin: 0 }}>
            No threads yet. Be the first to start a discussion!
          </p>
        </Card>
      ) : (
        threads.map(thread => (
          <Link
            key={thread.id}
            to={`/community/thread/${thread.id}`}
            style={{ textDecoration: 'none' }}
          >
            <Card hoverable>
              <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
                {/* Voting section (Reddit-style) */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  gap: 'var(--spacing-1)',
                  minWidth: '40px',
                }}>
                  <div style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    color: thread.score > 0 ? '#4ade80' : thread.score < 0 ? '#ef4444' : 'var(--text-2)',
                  }}>
                    {thread.score}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-3)',
                  }}>
                    {thread.upvotes + thread.downvotes}
                  </div>
                </div>

                {/* Thread content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                    {thread.isPinned && (
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        background: 'var(--bg-button-primary)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 'var(--font-medium)',
                      }}>
                        PINNED
                      </span>
                    )}
                    {thread.isLocked && (
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        background: 'var(--bg-button)',
                        color: 'var(--text-2)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 'var(--font-medium)',
                      }}>
                        LOCKED
                      </span>
                    )}
                    {thread.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }}>
                        {thread.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 'var(--text-xs)',
                              background: 'var(--bg-button)',
                              color: 'var(--text-2)',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <h3 style={{
                    margin: 0,
                    marginBottom: 'var(--spacing-2)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--text-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {thread.title}
                  </h3>
                  
                  <p style={{
                    margin: 0,
                    marginBottom: 'var(--spacing-2)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {thread.content}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-3)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-3)',
                  }}>
                    <span>{thread.postCount} {thread.postCount === 1 ? 'reply' : 'replies'}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(thread.lastPostAt)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
