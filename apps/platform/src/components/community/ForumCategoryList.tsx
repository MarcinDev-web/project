import { Link } from 'react-router-dom';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';
import type { ForumCategory } from '../../api/forum';

interface ForumCategoryListProps {
  categories: ForumCategory[];
  onCategoryUpdate?: () => void;
}

export function ForumCategoryList({ categories, onCategoryUpdate }: ForumCategoryListProps) {
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    if (message.type === 'forum:thread:new' || message.type === 'forum:post:new' || message.type === 'forum:thread:deleted') {
      onCategoryUpdate?.();
    }
  };

  useWebSocket(handleWebSocketMessage, true);

  if (!categories || categories.length === 0) {
    return (
      <div className="forum-category-empty">
        <p>No categories yet</p>
      </div>
    );
  }

  return (
    <div className="forum-category-grid-clean">
      {categories.map((category) => (
        <Link
          key={category.id}
          to={`/community/category/${category.id}`}
          className="forum-category-card-clean"
        >
          <div className="forum-category-card-clean__icon">
            {category.icon || '💬'}
          </div>
          <div className="forum-category-card-clean__content">
            <h3 className="forum-category-card-clean__title">{category.name}</h3>
            <p className="forum-category-card-clean__description">{category.description}</p>
            <div className="forum-category-card-clean__meta">
              <span>{category.threadCount} threads</span>
              <span>·</span>
              <span>{category.postCount} posts</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
