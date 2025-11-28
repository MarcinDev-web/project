import { useState, useEffect } from 'react';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';
import { ForumCategoryCard } from '../community-hub/ForumCategoryCard';
import type { ForumCategory } from '../../api/forum';

interface ForumCategoryListProps {
  categories: ForumCategory[];
  onCategoryUpdate?: () => void;
}

export function ForumCategoryList({ categories, onCategoryUpdate }: ForumCategoryListProps) {
  // Track categories with recent activity (new posts in last 5 minutes)
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    // Listen for new threads/posts to show activity indicators
    if (message.type === 'forum:thread:new' || message.type === 'forum:post:new') {
      const categoryId = (message.payload as { categoryId?: string })?.categoryId;
      if (categoryId) {
        setActiveCategories(prev => new Set([...prev, categoryId]));
        // Clear activity indicator after 5 minutes
        setTimeout(() => {
          setActiveCategories(prev => {
            const next = new Set(prev);
            next.delete(categoryId);
            return next;
          });
        }, 5 * 60 * 1000);
      }
      onCategoryUpdate?.();
    }
    
    if (message.type === 'forum:thread:deleted') {
      onCategoryUpdate?.();
    }
  };

  useWebSocket(handleWebSocketMessage, true);

  // Initial active state based on recent activity
  useEffect(() => {
    // Categories with posts in the last hour are considered active
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    // This would need backend support to check lastPostAt
    // For now, we'll just show the animation on hover
  }, [categories]);
  
  return (
    <div className="forum-gaming-grid">
      {categories.map((category, index) => (
        <div 
          key={category.id}
          className="forum-gaming-grid__item"
          style={{ '--item-index': index } as React.CSSProperties}
        >
          <ForumCategoryCard 
            category={category}
            hasRecentActivity={activeCategories.has(category.id)}
          />
        </div>
      ))}
    </div>
  );
}
