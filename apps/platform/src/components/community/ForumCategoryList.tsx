import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';
import type { ForumCategory } from '../../api/forum';

interface ForumCategoryListProps {
  categories: ForumCategory[];
  onCategoryUpdate?: () => void;
}

export function ForumCategoryList({ categories, onCategoryUpdate }: ForumCategoryListProps) {
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    // Listen for new threads in any category to refresh counts
    if (message.type === 'forum:thread:new' || message.type === 'forum:thread:deleted') {
      onCategoryUpdate?.();
    }
  };

  useWebSocket(handleWebSocketMessage, true);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-4)' }}>
      {categories.map(category => (
        <Link
          key={category.id}
          to={`/community/category/${category.id}`}
          style={{ textDecoration: 'none' }}
        >
          <Card hoverable>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-3)' }}>
              {category.icon && (
                <span style={{ 
                  fontSize: '2em', 
                  flexShrink: 0,
                  color: category.color,
                }}>
                  {category.icon}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ 
                  margin: 0, 
                  marginBottom: 'var(--spacing-2)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--text-1)',
                }}>
                  {category.name}
                </h3>
                <p style={{ 
                  margin: 0,
                  marginBottom: 'var(--spacing-3)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-2)',
                }}>
                  {category.description}
                </p>
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-4)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-3)',
                }}>
                  <span>{category.threadCount} {category.threadCount === 1 ? 'thread' : 'threads'}</span>
                  <span>{category.postCount} {category.postCount === 1 ? 'post' : 'posts'}</span>
                </div>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
