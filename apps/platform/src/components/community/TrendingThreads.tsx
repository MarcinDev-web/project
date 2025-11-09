import { Card } from '../shared/Card';
import { ThreadCard } from './ThreadCard';
import type { ForumThread } from '../../api/forum';

export interface TrendingThreadsProps {
  threads: ForumThread[];
  limit?: number;
}

/**
 * Trending Threads Widget
 * 
 * Displays trending/hot threads in a compact sidebar widget
 */
export function TrendingThreads({ threads, limit = 5 }: TrendingThreadsProps) {
  const displayThreads = threads.slice(0, limit);

  if (displayThreads.length === 0) {
    return (
      <Card>
        <h3 style={{ margin: '0 0 var(--spacing-3) 0', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
          🔥 Trending
        </h3>
        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 'var(--text-sm)' }}>
          No trending threads yet
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={{ margin: '0 0 var(--spacing-3) 0', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
        🔥 Trending
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
        {displayThreads.map(thread => (
          <div
            key={thread.id}
            style={{
              padding: 'var(--spacing-2)',
              background: 'var(--forum-bg-input)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--forum-border-default)',
            }}
          >
            <a
              href={`/community/thread/${thread.id}`}
              style={{
                textDecoration: 'none',
                color: 'var(--text-1)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                display: 'block',
                marginBottom: 'var(--spacing-1)',
              }}
            >
              {thread.title.length > 60 ? thread.title.substring(0, 60) + '...' : thread.title}
            </a>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', display: 'flex', gap: 'var(--spacing-2)' }}>
              <span>{thread.score} points</span>
              <span>•</span>
              <span>{thread.postCount} replies</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

