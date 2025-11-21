import { Link } from 'react-router-dom';
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
    <div className="forum-category-grid">
      {categories.map(category => (
        <Link
          key={category.id}
          to={`/community/category/${category.id}`}
          className="forum-category-card"
          aria-label={`Category: ${category.name}`}
        >
          <span 
            className="forum-category-card__icon"
            style={{ color: category.color || 'var(--text-1)' }}
          >
            {category.icon || '📁'}
          </span>
          <div className="forum-category-card__content">
            <h3 className="forum-category-card__title">
              {category.name}
            </h3>
            <p className="forum-category-card__description">
              {category.description}
            </p>
            <div className="forum-category-card__stats">
              <span>{category.threadCount} {category.threadCount === 1 ? 'thread' : 'threads'}</span>
              <span>{category.postCount} {category.postCount === 1 ? 'post' : 'posts'}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
