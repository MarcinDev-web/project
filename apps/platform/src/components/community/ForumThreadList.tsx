import { Card } from '../shared/Card';
import { ThreadCard } from './ThreadCard';
import type { ForumThread } from '../../api/forum';

interface ForumThreadListProps {
  threads: ForumThread[];
  onThreadUpdate?: () => void;
}

export function ForumThreadList({ threads, onThreadUpdate }: ForumThreadListProps) {
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
          <ThreadCard
            key={thread.id}
            thread={thread}
            onVote={onThreadUpdate}
          />
        ))
      )}
    </div>
  );
}
